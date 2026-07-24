import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, CheckCircle, RefreshCw, Trash2, Users, Package, FileText, CreditCard, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';

interface LogEntry { time: string; msg: string; type: 'info' | 'success' | 'error' | 'warn'; }
interface Results {
    customers?: number;
    products?: number;
    suppliers?: number;
    invoices?: number;
    payments?: number;
    salesReturns?: number;
    supplierPurchases?: number;
    supplierPayments?: number;
}
interface EntityImportStats { created?: number; updated?: number; skipped?: number; failed?: number; errors?: string[]; }
interface GlFailureSample { source_type: string; source_id: string; message: string; }
interface GlImportStats {
    posted?: number;
    skipped?: number;
    skipped_already_posted?: number;
    skipped_ineligible?: number;
    failed?: number;
    failure_samples?: GlFailureSample[];
}
interface TieOut {
    gl_ar?: number;
    customer_balances?: number;
    difference?: number;
    ar_ok?: boolean;
    gl_ap?: number;
    operational_ap?: number;
    ap_difference?: number;
    ap_ok?: boolean;
    gl_bank?: number;
}
interface CompletenessCheck { count?: number; sample?: string[]; difference?: number; ok?: boolean; gl_ar?: number; customer_balances?: number; }
interface ImportCompleteness {
    complete: boolean;
    checks: Record<string, CompletenessCheck>;
    warnings: string[];
}
interface BackendImportResults {
    gl?: Record<string, GlImportStats>;
    tie_out?: TieOut;
    completeness?: ImportCompleteness;
    cogs_trueup_amount?: number;
    [key: string]: EntityImportStats | ImportCompleteness | TieOut | Record<string, GlImportStats> | number | undefined;
}
interface ImportJobStatus {
    job_id: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    phase?: string | null;
    processed?: number;
    total?: number;
    results?: BackendImportResults | null;
    error?: string | null;
    updated_at?: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 30;
const STALL_MINUTES = 10;

/** BETTANO.db self-check: Receipt→Sales rows in bill_receipt_payment (verified offline). */
const PAYMENT_ALLOCATION_EXPECTED_ROWS = 983;
const PAYMENT_ALLOCATION_EXPECTED_TOTAL = 379814.03;

/** C3.1a — required for correct AR books. Optional tables warn only, never block. */
const REQUIRED_SCHEMA: Record<string, readonly string[]> = {
    account_detail: ['aname', 'a_type', 'status'],
    vouchers: ['v_id', 'v_type', 'amount', 'debit', 'credit', 'date', 'vch_no'],
    bill_receipt_payment: ['r_p_v_id', 'b_v_id', 'amount'],
};
const OPTIONAL_SCHEMA_TABLES = ['purchases', 'sales', 'item_measure'] as const;

interface SchemaProbeResult {
    ok: boolean;
    missingTables: string[];
    missingColumns: Record<string, string[]>;
    rowCounts: Record<string, number>;
    warnings: string[];
}

const ts = () => new Date().toLocaleTimeString();

/** Parse BETTANO numeric strings; strips comma thousands separators. */
const parseMigrationNum = (raw: unknown, fallback = 0): number => {
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
    const cleaned = String(raw).trim().replace(/,/g, '');
    if (!cleaned) return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
};

const GL_DISPLAY_ORDER = [
    'opening_balances',
    'grn',
    'invoices',
    'payments',
    'sales_returns',
    'supplier_payments',
    'cogs_trueup',
];

const sortGlResultEntries = (gl: Record<string, GlImportStats>): [string, GlImportStats][] =>
    Object.entries(gl).sort(([a], [b]) => {
        const ia = GL_DISPLAY_ORDER.indexOf(a);
        const ib = GL_DISPLAY_ORDER.indexOf(b);
        const rankA = ia === -1 ? GL_DISPLAY_ORDER.length : ia;
        const rankB = ib === -1 ? GL_DISPLAY_ORDER.length : ib;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
    });

const formatEntityCounts = (stats: EntityImportStats): string => {
    const parts: string[] = [];
    parts.push(`${stats.created ?? 0} created`);
    if (stats.updated) parts.push(`${stats.updated} updated`);
    if (stats.skipped) parts.push(`${stats.skipped} skipped`);
    if (stats.failed) parts.push(`${stats.failed} failed`);
    return parts.join(', ');
};

const formatPhaseLabel = (phase: string): string =>
    phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatGlEntityLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatGlEntitySummary = (stats: GlImportStats): string => {
    const parts: string[] = [];
    if (stats.posted) parts.push(`${stats.posted} posted`);
    if (stats.skipped_already_posted) parts.push(`${stats.skipped_already_posted} already posted`);
    if (stats.skipped_ineligible) parts.push(`${stats.skipped_ineligible} ineligible`);
    if (stats.skipped && !stats.skipped_already_posted && !stats.skipped_ineligible) {
        parts.push(`${stats.skipped} skipped`);
    }
    if (stats.failed) parts.push(`${stats.failed} failed`);
    return parts.length ? parts.join(', ') : '0 posted';
};

const ENTITY_IMPORT_LOGS: { key: string; emoji: string; label: string }[] = [
    { key: 'customers', emoji: '👥', label: 'Customers' },
    { key: 'products', emoji: '📦', label: 'Products' },
    { key: 'suppliers', emoji: '🏭', label: 'Suppliers' },
    { key: 'invoices', emoji: '📄', label: 'Invoices' },
    { key: 'payments', emoji: '💳', label: 'Payments' },
    { key: 'sales_returns', emoji: '↩️', label: 'Sales returns' },
    { key: 'purchase_orders', emoji: '🛒', label: 'POs' },
    { key: 'supplier_payments', emoji: '🏦', label: 'Supplier payments' },
];

export default function DataMigration() {
    const [file, setFile] = useState<File | null>(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState(false);
    const [pct, setPct] = useState(0);
    const [step, setStep] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [results, setResults] = useState<Results | null>(null);
    const [tieOut, setTieOut] = useState<TieOut | null>(null);
    const [cogsTrueupAmount, setCogsTrueupAmount] = useState<number | null>(null);
    const [glResults, setGlResults] = useState<Record<string, GlImportStats> | null>(null);
    const [completeness, setCompleteness] = useState<ImportCompleteness | null>(null);
    const [done, setDone] = useState(false);
    const [importFailed, setImportFailed] = useState(false);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const consecutivePollFailuresRef = useRef(0);
    const lastPhaseRef = useRef<string | null>(null);
    const stallWarnedRef = useRef(false);
    const activeJobIdRef = useRef<number | null>(null);

    const log = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, { time: ts(), msg, type }]);
    }, []);

    const prog = useCallback((p: number, s: string) => {
        setPct(p);
        setStep(s);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        activeJobIdRef.current = null;
    }, []);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const loadSqlJs = (): Promise<any> => new Promise((res, rej) => {
        if ((window as any).initSqlJs) return res((window as any).initSqlJs);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
        s.onload = () => setTimeout(() => (window as any).initSqlJs ? res((window as any).initSqlJs) : rej(new Error('SQL.js failed')), 800);
        s.onerror = () => rej(new Error('SQL.js CDN failed'));
        document.head.appendChild(s);
    });

    const extractAllData = async (buf: ArrayBuffer) => {
        const initSqlJs = await loadSqlJs();
        const SQL = await initSqlJs({ locateFile: (fn: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${fn}` });
        const db = new SQL.Database(new Uint8Array(buf));

        const q = (sql: string) => {
            try {
                const r = db.exec(sql);
                if (!r[0]) return [];
                return r[0].values.map((row: any[]) => Object.fromEntries(r[0].columns.map((c: string, i: number) => [c, row[i]])));
            } catch { return []; }
        };

        // C3.1a — same row mapping as q, but SQL errors throw (empty result still []).
        const qStrict = (sql: string) => {
            const r = db.exec(sql);
            if (!r[0]) return [];
            return r[0].values.map((row: any[]) => Object.fromEntries(r[0].columns.map((c: string, i: number) => [c, row[i]])));
        };

        const probeSchema = (_database: typeof db): SchemaProbeResult => {
            const missingTables: string[] = [];
            const missingColumns: Record<string, string[]> = {};
            const rowCounts: Record<string, number> = {};
            const warnings: string[] = [];

            const existing = new Set(
                qStrict(`SELECT name FROM sqlite_master WHERE type='table'`).map((row: { name?: unknown }) => String(row.name)),
            );

            for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
                if (!existing.has(table)) {
                    missingTables.push(table);
                    continue;
                }
                const presentCols = new Set(
                    qStrict(`PRAGMA table_info(${table})`).map((row: { name?: unknown }) => String(row.name)),
                );
                const missing = requiredCols.filter((col) => !presentCols.has(col));
                if (missing.length > 0) missingColumns[table] = missing;

                const count = Number(qStrict(`SELECT COUNT(*) AS c FROM ${table}`)[0]?.c ?? 0);
                rowCounts[table] = count;
                if (count === 0) {
                    warnings.push(`Table '${table}' exists but has 0 rows — import will skip that entity.`);
                }
            }

            for (const table of OPTIONAL_SCHEMA_TABLES) {
                if (!existing.has(table)) {
                    warnings.push(`Optional table '${table}' is missing — related entities will be skipped.`);
                    continue;
                }
                const count = Number(qStrict(`SELECT COUNT(*) AS c FROM ${table}`)[0]?.c ?? 0);
                rowCounts[table] = count;
                if (count === 0) {
                    warnings.push(`Optional table '${table}' exists but has 0 rows — related entities will be skipped.`);
                }
            }

            return {
                ok: missingTables.length === 0 && Object.keys(missingColumns).length === 0,
                missingTables,
                missingColumns,
                rowCounts,
                warnings,
            };
        };

        const probe = probeSchema(db);
        if (!probe.ok) {
            for (const table of probe.missingTables) {
                log(`Missing required table: ${table}`, 'error');
            }
            for (const [table, cols] of Object.entries(probe.missingColumns)) {
                log(`Missing columns on ${table}: ${cols.join(', ')}`, 'error');
            }
            const missingList = [
                ...probe.missingTables,
                ...Object.entries(probe.missingColumns).map(([table, cols]) => `${table}(${cols.join(', ')})`),
            ].join(', ');
            throw new Error(
                `Unsupported export format. Missing: ${missingList}. SOLTOL currently supports SQLite exports from Soltol / Tally-style packages (required tables: account_detail, vouchers, bill_receipt_payment).`,
            );
        }
        log('Schema OK', 'success');
        for (const [table, count] of Object.entries(probe.rowCounts)) {
            log(`${table}: ${count} rows`, 'info');
        }
        for (const warning of probe.warnings) {
            log(warning, 'warn');
        }

        log('Calculating real outstanding balances...', 'info');
        const custRows = q(`SELECT aname, address, phone, email_id, op_bal, credit_limit FROM account_detail WHERE (a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%') AND status=1`);

        const balMap: Record<string, number> = {};
        for (const r of custRows) {
            const name = String(r.aname || '').trim();
            if (!name) continue;
            const safe = name.replace(/'/g, "''");
            const res = q(`SELECT ROUND(
                SUM(CASE WHEN debit='${safe}' THEN amount ELSE 0 END)
              - SUM(CASE WHEN credit='${safe}' THEN amount ELSE 0 END), 2) AS bal
              FROM vouchers
              WHERE v_type IN ('Sales','Receipt','Journal','Sales Return')`);
            balMap[name] = parseMigrationNum(res[0]?.bal);
        }

        const customers = custRows.map((r: any) => {
            const name = String(r.aname || '').trim();
            const bal = balMap[name] ?? 0;
            return { name: name.slice(0, 150), address: String(r.address || '').trim().slice(0, 300) || null, phone: String(r.phone || '').trim().slice(0, 50) || null, email: null, opening_balance: parseMigrationNum(r.op_bal), balance: bal, credit_limit: parseMigrationNum(r.credit_limit), category: 'retail', notes: `BETTANO | Owes: $${bal.toFixed(2)}` };
        }).filter((c: any) => c.name);

        log(`👥 ${customers.length} customers — real outstanding balances calculated`, 'success');

        const suppRows = q(`SELECT aname, address, phone, email_id, op_bal, credit_limit, remarks FROM account_detail WHERE (a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%') AND status=1`);

        const suppBalMap: Record<string, number> = {};
        for (const r of suppRows) {
            const name = String(r.aname || '').trim();
            if (!name) continue;
            const safe = name.replace(/'/g, "''");
            const res = q(`SELECT ROUND(SUM(CASE WHEN v_type='Purchase' AND credit='${safe}' THEN amount ELSE 0 END) - SUM(CASE WHEN v_type='Payment' AND debit='${safe}' THEN amount ELSE 0 END), 2) as bal FROM vouchers`);
            suppBalMap[name] = parseMigrationNum(res[0]?.bal);
        }

        const suppliers = suppRows.map((r: any) => {
            const name = String(r.aname || '').trim();
            const apBal = suppBalMap[name] ?? 0;
            const remark = String(r.remarks || '').trim();
            const notesParts = [`BETTANO | AP: $${apBal.toFixed(2)}`];
            if (remark) notesParts.push(remark);
            return {
                name: name.slice(0, 150),
                address: String(r.address || '').trim().slice(0, 300) || null,
                phone: String(r.phone || '').trim().slice(0, 50) || null,
                email: String(r.email_id || '').trim() || null,
                opening_balance: parseMigrationNum(r.op_bal),
                credit_limit: parseMigrationNum(r.credit_limit),
                notes: notesParts.join(' | ').slice(0, 500),
            };
        }).filter((s: any) => s.name);
        const supplierNameSet = new Set(suppliers.map((s: any) => s.name));

        const poHeaders = q(`SELECT v_id, date, vch_no, amount, credit AS supplier_name FROM vouchers WHERE v_type='Purchase'`);
        const poItemsRows = q(`SELECT v_id, item, units, cost_per_unit FROM purchases`);
        const itemsByVoucher: Record<string, any[]> = {};
        for (const it of poItemsRows) {
            const k = String(it.v_id);
            (itemsByVoucher[k] = itemsByVoucher[k] || []).push(it);
        }
        const purchase_orders = poHeaders
            .filter((h: any) => supplierNameSet.has(String(h.supplier_name || '').trim()))
            .map((h: any) => {
                const sName = String(h.supplier_name || '').trim();
                const grand = parseMigrationNum(h.amount);
                const items = (itemsByVoucher[String(h.v_id)] || []).map((it: any) => {
                    const qty = parseMigrationNum(it.units);
                    const price = parseMigrationNum(it.cost_per_unit);
                    return {
                        product_id: '', product_name: String(it.item || '').slice(0, 200),
                        uom: 'unit', quantity: qty, unit_price: price,
                        tax_rate: 0, discount: 0, total: qty * price,
                    };
                });
                return {
                    po_number: String(h.vch_no || '').slice(0, 100),
                    supplier_name: sName,
                    date: String(h.date || '').slice(0, 20),
                    expected_date: String(h.date || '').slice(0, 20),
                    status: 'Received',
                    payment_status: 'Unpaid',
                    subtotal: grand,
                    tax_total: 0,
                    grand_total: grand,
                    amount_paid: 0,
                    notes: 'BETTANO import',
                    items,
                };
            });

        const supplierPayRows = q(`SELECT v_id, date, vch_no, amount, debit AS supplier_name, credit AS bank, payment_reference FROM vouchers WHERE v_type='Payment'`);
        const supplier_payments = supplierPayRows
            .filter((p: any) => supplierNameSet.has(String(p.supplier_name || '').trim()))
            .map((p: any) => ({
                supplier_name: String(p.supplier_name || '').trim(),
                date: String(p.date || '').slice(0, 20),
                reference: String(p.vch_no || '').slice(0, 100),
                amount: parseMigrationNum(p.amount),
                payment_method: 'Bank Transfer',
                notes: `BETTANO import · ${String(p.bank || '').trim()}`,
            }));

        const prodRows = q(`SELECT item, units_name, sku, item_desc, defaultsellingprice, defaultpurchaseprice FROM item_measure WHERE item IS NOT NULL AND TRIM(item) != '' ORDER BY item ASC, units_name ASC`);
        const stockNetRows = q(`
            SELECT item, SUM(u) AS net FROM (
                SELECT item, units AS u FROM purchases
                UNION ALL SELECT item, -units AS u FROM sales
            ) GROUP BY item
        `);
        const stockByItem: Record<string, number> = {};
        for (const r of stockNetRows) {
            const itemName = String(r.item || '').trim();
            if (!itemName) continue;
            stockByItem[itemName] = Math.max(0, Math.round(parseMigrationNum(r.net)));
        }
        const productByName = new Map<string, Record<string, unknown>>();
        for (const r of prodRows) {
            const name = String(r.item || '').trim().slice(0, 150);
            if (!name || productByName.has(name)) continue;
            productByName.set(name, r);
        }
        const products = Array.from(productByName.values()).map((r: any) => {
            const name = String(r.item || '').trim().slice(0, 150);
            return {
            name,
            sku: String(r.sku || '').replace('SKU:', '').trim().slice(0, 100),
            description: String(r.item_desc || r.units_name || '').slice(0, 300),
            price: parseMigrationNum(r.defaultsellingprice),
            cost: parseMigrationNum(r.defaultpurchaseprice),
            stock: stockByItem[name] ?? 0,
            category: 'Imported',
            unit: String(r.units_name || 'unit').slice(0, 50),
        };
        }).filter((p: any) => p.name);

        const invRows = q(`SELECT v_id, date, vch_no, debit as customer_name, amount, narration FROM vouchers WHERE v_type='Sales' ORDER BY date`);
        const paidByBillVId: Record<string, number> = {};
        const paidRows = q(`SELECT b_v_id, SUM(amount) AS paid FROM bill_receipt_payment GROUP BY b_v_id`);
        for (const r of paidRows) {
            const billVId = String(r.b_v_id ?? '').trim();
            if (!billVId) continue;
            paidByBillVId[billVId] = parseMigrationNum(r.paid);
        }
        const invoices = invRows.map((r: any) => {
            const total = parseMigrationNum(r.amount);
            const vId = String(r.v_id ?? '').trim();
            const paid_amount = Math.min(paidByBillVId[vId] ?? 0, total);
            const status = paid_amount >= total - 0.01 ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid';
            return {
                invoice_number: String(r.vch_no || '').slice(0, 100),
                customer_name: String(r.customer_name || '').trim(),
                date: String(r.date || ''),
                amount: total,
                paid_amount,
                notes: String(r.narration || ''),
                status,
            };
        }).filter((i: any) => i.customer_name && i.amount > 0);

        const payRows = q(`SELECT date, vch_no, credit as customer_name, amount FROM vouchers WHERE v_type='Receipt' ORDER BY date`);
        const payments = payRows.map((r: any) => ({ reference: String(r.vch_no || '').slice(0, 100), customer_name: String(r.customer_name || '').trim(), date: String(r.date || ''), amount: parseMigrationNum(r.amount) })).filter((p: any) => p.customer_name && p.amount !== 0);

        const receiptVchByVId: Record<string, string> = {};
        for (const r of q(`SELECT v_id, vch_no FROM vouchers WHERE v_type='Receipt'`)) {
            const vid = String(r.v_id ?? '').trim();
            if (!vid) continue;
            receiptVchByVId[vid] = String(r.vch_no || '').slice(0, 100);
        }
        const invVchByVId: Record<string, string> = {};
        for (const r of q(`SELECT v_id, vch_no FROM vouchers WHERE v_type='Sales'`)) {
            const vid = String(r.v_id ?? '').trim();
            if (!vid) continue;
            invVchByVId[vid] = String(r.vch_no || '').slice(0, 100);
        }
        const payment_allocations = q(`SELECT r_p_v_id, b_v_id, amount FROM bill_receipt_payment`)
            .map((r: any) => {
                const rpv = String(r.r_p_v_id ?? '').trim();
                const bvid = String(r.b_v_id ?? '').trim();
                const receiptRef = receiptVchByVId[rpv];
                const invoiceNo = invVchByVId[bvid];
                const amount = parseMigrationNum(r.amount);
                if (!receiptRef || !invoiceNo || amount <= 0) return null;
                return { payment_reference: receiptRef, invoice_number: invoiceNo, amount };
            })
            .filter((a: any): a is { payment_reference: string; invoice_number: string; amount: number } => a !== null);
        const paymentAllocTotal = payment_allocations.reduce((sum: number, a: { payment_reference: string; invoice_number: string; amount: number }) => sum + a.amount, 0);
        log(
            `💳 ${payment_allocations.length} payment allocation rows ($${paymentAllocTotal.toFixed(2)} total; expected ${PAYMENT_ALLOCATION_EXPECTED_ROWS} rows / $${PAYMENT_ALLOCATION_EXPECTED_TOTAL.toFixed(2)})`,
            payment_allocations.length === PAYMENT_ALLOCATION_EXPECTED_ROWS ? 'success' : 'error',
        );
        if (payment_allocations.length !== PAYMENT_ALLOCATION_EXPECTED_ROWS) {
            throw new Error(
                `payment_allocations self-check failed: expected exactly ${PAYMENT_ALLOCATION_EXPECTED_ROWS} Receipt→Sales rows, got ${payment_allocations.length}. This may not be the verified BETTANO.db — import stopped.`,
            );
        }

        const debtorNameSet = new Set(customers.map((c: any) => c.name));
        const srRows = q(`SELECT date, vch_no, debit, credit, amount, narration FROM vouchers WHERE v_type='Sales Return' ORDER BY date`);
        const sales_returns = srRows.map((r: any) => {
            const debit = String(r.debit || '').trim();
            const credit = String(r.credit || '').trim();
            const customer_name = debtorNameSet.has(credit) ? credit : debtorNameSet.has(debit) ? debit : '';
            return {
                reference: String(r.vch_no || '').slice(0, 100),
                customer_name,
                date: String(r.date || ''),
                amount: parseMigrationNum(r.amount),
                notes: String(r.narration || ''),
            };
        }).filter((sr: any) => sr.customer_name && sr.amount > 0);

        db.close();
        const stockedCount = products.filter((p: any) => (p.stock ?? 0) > 0).length;
        const paidInvoices = invoices.filter((i: any) => i.status === 'paid').length;
        const partialInvoices = invoices.filter((i: any) => i.status === 'partial').length;
        const unpaidInvoices = invoices.filter((i: any) => i.status === 'unpaid').length;
        log(`📦 ${products.length} products (${stockedCount} with stock from purchases−sales), ${suppliers.length} suppliers, ${invoices.length} invoices (${paidInvoices} paid / ${partialInvoices} partial / ${unpaidInvoices} unpaid), ${payments.length} payments, ${sales_returns.length} sales returns`, 'info');
        log(`🛒 ${purchase_orders.length} supplier POs, ${supplier_payments.length} supplier payments`, 'info');
        return { customers, suppliers, products, invoices, payments, payment_allocations, sales_returns, purchase_orders, supplier_payments };
    };


    const parseCsv = async (text: string) => {
        const rows = text.split(/\r?\n/).filter(l => l.trim());
        if (rows.length < 2) throw new Error('CSV needs a header row + data');
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const find = (...keys: string[]) => headers.find(h => keys.some(k => h.includes(k))) || '';
        const nf = find('name', 'company', 'customer') || headers[0];
        const pf = find('phone', 'mobile');
        const af = find('address');
        const bf = find('balance', 'amount', 'outstanding');
        const customers = rows.slice(1).map(l => {
            const v = l.split(',').map(x => x.trim().replace(/^['"]|['"]$/g, ''));
            const get = (f: string) => f ? v[headers.indexOf(f)] || '' : '';
            return { name: get(nf), email: null, phone: get(pf) || null, address: get(af) || null, balance: parseMigrationNum(get(bf)), opening_balance: parseMigrationNum(get(bf)), category: 'retail', notes: 'CSV import' };
        }).filter(c => c.name);
        return { customers, suppliers: [], products: [], invoices: [], payments: [] };
    };

    const summarizeBackendResults = useCallback((backendResults: BackendImportResults) => {
        for (const { key, emoji, label } of ENTITY_IMPORT_LOGS) {
            const stats = backendResults[key] as EntityImportStats | undefined;
            if (!stats) continue;
            const hasErrors = (stats.errors?.length ?? 0) > 0 || (stats.failed ?? 0) > 0;
            log(`${emoji} ${label}: ${formatEntityCounts(stats)}`, hasErrors ? 'warn' : 'success');
            for (const err of stats.errors ?? []) {
                log(`   ↳ ${err}`, 'error');
            }
        }

        const gl = backendResults.gl as Record<string, GlImportStats> | undefined;
        setGlResults(gl ?? null);
        if (gl) {
            for (const [entity, stats] of Object.entries(gl)) {
                const summary = formatGlEntitySummary(stats);
                const hasFailures = (stats.failed ?? 0) > 0 || (stats.failure_samples?.length ?? 0) > 0;
                log(`📒 GL ${formatGlEntityLabel(entity)} — ${summary}`, hasFailures ? 'warn' : 'success');
                for (const sample of stats.failure_samples ?? []) {
                    log(
                        `   ↳ ${sample.source_type} ${sample.source_id}: ${sample.message}`,
                        'error',
                    );
                }
            }
        } else {
            setGlResults(null);
        }

        const tie = backendResults.tie_out;
        const completenessResult = backendResults.completeness;
        setCompleteness(completenessResult ?? null);

        const arTieOut = completenessResult?.checks?.ar_tie_out;
        let tieForDisplay: TieOut | undefined = tie ? { ...tie } : undefined;
        if (arTieOut?.gl_ar !== undefined) {
            tieForDisplay = {
                ...(tieForDisplay ?? {}),
                gl_ar: arTieOut.gl_ar,
                customer_balances: arTieOut.customer_balances,
                difference: arTieOut.difference,
                ar_ok: arTieOut.ok,
            };
        }

        const cogsAmount = parseMigrationNum(backendResults.cogs_trueup_amount, 0);
        setCogsTrueupAmount(cogsAmount > 0 ? cogsAmount : null);

        if (tieForDisplay && tieForDisplay.gl_ar !== undefined) {
            setTieOut(tieForDisplay);
            const arBalanced = tieForDisplay.ar_ok ?? Math.abs(Number(tieForDisplay.difference ?? 0)) <= 0.01;
            log(
                `📊 AR tie-out — GL AR: $${Number(tieForDisplay.gl_ar).toFixed(2)}, customer balances: $${Number(tieForDisplay.customer_balances ?? 0).toFixed(2)}, diff: $${Number(tieForDisplay.difference ?? 0).toFixed(2)}`,
                arBalanced ? 'success' : 'warn',
            );
            if (tieForDisplay.gl_ap !== undefined) {
                const apBalanced = tieForDisplay.ap_ok ?? Math.abs(Number(tieForDisplay.ap_difference ?? 0)) <= 0.01;
                log(
                    `📊 AP tie-out — GL AP: $${Number(tieForDisplay.gl_ap).toFixed(2)}, operational AP: $${Number(tieForDisplay.operational_ap ?? 0).toFixed(2)}, diff: $${Number(tieForDisplay.ap_difference ?? 0).toFixed(2)}`,
                    apBalanced ? 'success' : 'warn',
                );
            }
            if (tieForDisplay.gl_bank !== undefined) {
                log(`🏦 Bank (GL): $${Number(tieForDisplay.gl_bank).toFixed(2)}`, 'success');
            }
        } else {
            setTieOut(null);
            setCogsTrueupAmount(null);
        }

        if (cogsAmount > 0) {
            log(`🧾 COGS true-up posted: $${cogsAmount.toFixed(2)}`, 'success');
        }

        if (completenessResult && !completenessResult.complete) {
            for (const warning of completenessResult.warnings) {
                log(`⚠️ ${warning}`, 'warn');
            }
        }

        setResults({
            customers: ((backendResults.customers as EntityImportStats | undefined)?.created || 0) + ((backendResults.customers as EntityImportStats | undefined)?.updated || 0),
            products: ((backendResults.products as EntityImportStats | undefined)?.created || 0) + ((backendResults.products as EntityImportStats | undefined)?.updated || 0),
            suppliers: ((backendResults.suppliers as EntityImportStats | undefined)?.created || 0) + ((backendResults.suppliers as EntityImportStats | undefined)?.updated || 0),
            invoices: (backendResults.invoices as EntityImportStats | undefined)?.created || 0,
            payments: (backendResults.payments as EntityImportStats | undefined)?.created || 0,
            salesReturns: (backendResults.sales_returns as EntityImportStats | undefined)?.created || 0,
            supplierPurchases: (backendResults.purchase_orders as EntityImportStats | undefined)?.created || 0,
            supplierPayments: (backendResults.supplier_payments as EntityImportStats | undefined)?.created || 0,
        });
        setDone(true);
        setImportFailed(false);
    }, [log]);

    const finishImportSuccess = useCallback((backendResults: BackendImportResults) => {
        prog(100, 'Done!');
        summarizeBackendResults(backendResults);
        const completenessResult = backendResults.completeness;
        if (completenessResult && !completenessResult.complete) {
            const n = completenessResult.warnings.length;
            log(`⚠️ Import completed with ${n} warning(s) — review before going live.`, 'warn');
        } else {
            log('✅ Upload complete — your data has been imported and your books are balanced.', 'success');
        }
    }, [log, prog, summarizeBackendResults]);

    const finishImportFailure = useCallback((message: string) => {
        stopPolling();
        setImportFailed(true);
        setDone(false);
        setResults(null);
        setTieOut(null);
        setCogsTrueupAmount(null);
        setGlResults(null);
        setCompleteness(null);
        prog(0, '');
        log(`❌ Import failed: ${message}`, 'error');
        log('ℹ️ Safe to re-run: re-uploading the SAME file updates existing records instead of duplicating them. Uploading a DIFFERENT file will add its records to this tenant. Check back or contact support.', 'warn');
        setBusy(false);
    }, [log, prog, stopPolling]);

    const runSyncImport = useCallback(async (data: Record<string, unknown>) => {
        log('⬆️ Using synchronous import (async endpoint unavailable)...', 'warn');
        prog(20, 'Importing to ERP...');
        const { data: importResponse } = await api.post<{ success: boolean; results: BackendImportResults }>(
            '/api/migrate/full-import',
            data,
        );
        finishImportSuccess(importResponse.results ?? {});
        setBusy(false);
    }, [finishImportSuccess, log, prog]);

    const handleJobStatus = useCallback((job: ImportJobStatus) => {
        const processed = job.processed ?? 0;
        const total = job.total ?? 0;
        const phase = job.phase || job.status;

        if (phase && phase !== lastPhaseRef.current) {
            const label = formatPhaseLabel(phase);
            log(`⚙️ Importing ${label}… (${processed}/${total || '?'})`, 'info');
            lastPhaseRef.current = phase;
        }

        if (job.status === 'running' || job.status === 'pending') {
            const jobPct = total > 0
                ? Math.min(99, Math.round((processed / total) * 100))
                : job.status === 'running' ? 15 : 10;
            prog(jobPct, `Importing ${formatPhaseLabel(phase)}… (${processed}/${total || '?'})`);

            if (job.status === 'running' && job.updated_at && !stallWarnedRef.current) {
                const ageMs = Date.now() - new Date(job.updated_at).getTime();
                if (ageMs > STALL_MINUTES * 60 * 1000) {
                    log('⚠️ No progress update for 10+ minutes — the job may still be running on the server. Do NOT re-upload while it may still be in progress. Check back later or contact support.', 'warn');
                    stallWarnedRef.current = true;
                }
            }
            return;
        }

        if (job.status === 'completed') {
            finishImportSuccess((job.results ?? {}) as BackendImportResults);
            setBusy(false);
            return;
        }

        if (job.status === 'failed') {
            finishImportFailure(job.error || 'Unknown server error');
        }
    }, [finishImportFailure, finishImportSuccess, log, prog]);

    const pollImportStatus = useCallback(async (jobId: number) => {
        const pollUrl = `/api/migrate/import-status/${jobId}`;
        try {
            const { data: job } = await api.get<ImportJobStatus>(pollUrl);
            console.debug('[migration poll]', pollUrl, job.status, {
                job_id: job.job_id,
                phase: job.phase,
                processed: job.processed,
                total: job.total,
            });
            consecutivePollFailuresRef.current = 0;

            if (job.status === 'completed' || job.status === 'failed') {
                stopPolling();
            }

            handleJobStatus(job);
        } catch (e: any) {
            consecutivePollFailuresRef.current += 1;
            const errDetail = e?.response?.data?.detail;
            const errMsg = typeof errDetail === 'string'
                ? errDetail
                : errDetail
                    ? JSON.stringify(errDetail)
                    : e?.message || 'poll request failed';
            console.debug('[migration poll error]', pollUrl, errMsg, e?.response?.status);
            if (consecutivePollFailuresRef.current >= MAX_CONSECUTIVE_POLL_FAILURES) {
                finishImportFailure(errMsg || 'Lost connection to import status');
                return;
            }
            log(`…still processing (connection retry: ${errMsg})`, 'warn');
        }
    }, [finishImportFailure, handleJobStatus, log, stopPolling]);

    const startAsyncImport = useCallback((jobId: number) => {
        stopPolling();
        activeJobIdRef.current = jobId;
        consecutivePollFailuresRef.current = 0;
        lastPhaseRef.current = null;
        stallWarnedRef.current = false;
        log(`🚀 Import started (job #${jobId}) — processing on server...`, 'info');
        prog(10, 'Waiting for server…');
        pollImportStatus(jobId);
        pollTimerRef.current = setInterval(() => pollImportStatus(jobId), POLL_INTERVAL_MS);
    }, [log, pollImportStatus, prog, stopPolling]);

    const doImport = async () => {
        if (!file) return;
        stopPolling();
        setBusy(true);
        setPct(0);
        setLogs([]);
        setResults(null);
        setTieOut(null);
        setCogsTrueupAmount(null);
        setGlResults(null);
        setCompleteness(null);
        setDone(false);
        setImportFailed(false);
        consecutivePollFailuresRef.current = 0;
        lastPhaseRef.current = null;
        stallWarnedRef.current = false;

        try {
            prog(5, 'Reading file...');
            const ext = file.name.toLowerCase().split('.').pop() || '';
            let data: Record<string, unknown>;
            if (ext === 'db' || ext === 'sqlite') {
                prog(8, 'Opening database...');
                log(`📂 Opening ${file.name}...`, 'info');
                data = await extractAllData(await file.arrayBuffer());
            } else if (ext === 'csv' || ext === 'txt') {
                prog(8, 'Parsing CSV...');
                data = await parseCsv(await file.text());
                log(`📋 Found ${(data.customers as unknown[])?.length ?? 0} customers in CSV`, 'info');
            } else {
                throw new Error('For Excel: Save As → CSV first, then upload');
            }

            prog(12, 'Starting server import...');
            log('⬆️ Sending to ERP backend...', 'info');

            try {
                const { data: asyncStart } = await api.post<{ job_id: number; status: string }>(
                    '/api/migrate/full-import-async',
                    data,
                );
                if (asyncStart?.job_id) {
                    startAsyncImport(asyncStart.job_id);
                    return;
                }
                throw new Error('Async import did not return a job id');
            } catch (asyncErr: any) {
                if (asyncErr?.response?.status === 404) {
                    await runSyncImport(data);
                    return;
                }
                throw asyncErr;
            }
        } catch (e: any) {
            stopPolling();
            const msg = e?.response?.data?.detail || e?.message || 'Import failed';
            finishImportFailure(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
    };

    const clearAll = async () => {
        if (!confirm('Clear ALL customers from ERP? Cannot be undone.')) return;
        setBusy(true);
        try {
            const { data } = await api.delete<{ deleted: number }>('/api/migrate/clear-all');
            log(`✅ Cleared ${data.deleted} customers`, 'success');
            setResults(null); setDone(false); setTieOut(null); setCogsTrueupAmount(null); setGlResults(null); setCompleteness(null); setImportFailed(false);
        } catch (e: any) { log(`❌ ${e.message}`, 'error'); }
        finally { setBusy(false); }
    };

    const fileExt = file?.name.toLowerCase().split('.').pop() || '';
    const isDb = fileExt === 'db' || fileExt === 'sqlite';
    const importFullyComplete = !completeness || completeness.complete;
    const tieOutDiff = Math.abs(Number(tieOut?.difference ?? 0));
    const tieOutBalanced = tieOut?.ar_ok ?? tieOutDiff < 0.01;
    const apTieOutDiff = Math.abs(Number(tieOut?.ap_difference ?? 0));
    const apTieOutBalanced = tieOut?.ap_ok ?? apTieOutDiff < 0.01;
    const glFailureSamples = glResults
        ? Object.entries(glResults).flatMap(([entity, stats]) =>
            (stats.failure_samples ?? []).map((sample) => ({ entity, ...sample })),
        )
        : [];

    return (
        <div className="max-w-3xl mx-auto px-4 pb-16 pt-4 space-y-4 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-gray-900 text-white p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center"><Zap size={24} className="text-orange-400" /></div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">🤖 AI Data Migration</h1>
                            <p className="text-gray-400 text-sm mt-0.5">Import customers, invoices, products — with correct balances</p>
                        </div>
                    </div>
                    <button onClick={clearAll} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"><Trash2 size={14} /> Clear All</button>
                </div>
                <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 text-green-300 text-xs font-bold">✅ Correct balance = Full customer ledger (all voucher types)</div>
            </div>

            <div className="grid grid-cols-5 gap-2">
                {[{ icon: <Users size={14}/>, label: 'Customers', sub: 'Real balance' }, { icon: <Package size={14}/>, label: 'Products', sub: '+ Pricing' }, { icon: <FileText size={14}/>, label: 'Invoices', sub: '+ Ledger' }, { icon: <CreditCard size={14}/>, label: 'Payments', sub: '+ History' }, { icon: <TrendingUp size={14}/>, label: 'Suppliers', sub: '+ Details' }].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                        <div className="flex justify-center mb-1 text-gray-500">{item.icon}</div>
                        <p className="text-[11px] font-black text-gray-800">{item.label}</p>
                        <p className="text-[9px] text-orange-500 font-bold">{item.sub}</p>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2">Supported Formats</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded">.db / .sqlite</span><span className="text-blue-800 text-sm font-medium">Data migration — import from a legacy accounting export</span><span className="bg-orange-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black ml-auto">BEST</span></div>
                    <div className="flex items-center gap-2"><span className="bg-white border border-blue-200 text-blue-700 text-xs font-black px-2 py-0.5 rounded">.csv</span><span className="text-blue-700 text-sm">QuickBooks, DEAR, Cin7, Dynamics, NetSuite</span></div>
                    <div className="flex items-center gap-2"><span className="bg-white border border-blue-200 text-blue-700 text-xs font-black px-2 py-0.5 rounded">.xlsx</span><span className="text-blue-700 text-sm">Excel — save as CSV first</span></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Upload Your File</p>
                <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); setImportFailed(false); setTieOut(null); setCogsTrueupAmount(null); setGlResults(null); setCompleteness(null); } }}
                    onClick={() => document.getElementById('mig-ai-file')?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${drag ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-ai-file" type="file" accept=".db,.sqlite,.csv,.xlsx,.xls,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); setImportFailed(false); setTieOut(null); setCogsTrueupAmount(null); setGlResults(null); setCompleteness(null); } }} />
                    {file ? (
                        <div>
                            <div className="text-4xl mb-2">{isDb ? '🗄️' : '📋'}</div>
                            <p className="font-black text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            {isDb && <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">SQLite database selected — {file.name}</div>}
                            <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-3 block mx-auto text-xs text-red-400 font-bold">✕ Remove</button>
                        </div>
                    ) : (
                        <div>
                            <Upload size={36} className="text-gray-300 mx-auto mb-3" />
                            <p className="font-black text-gray-600">Drop file here or click to browse</p>
                            <p className="text-xs text-gray-400 mt-1">.db · .sqlite · .csv · .xlsx</p>
                        </div>
                    )}
                </div>
            </div>

            {busy && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <RefreshCw size={16} className="animate-spin text-orange-500" />
                        <span className="text-sm font-black text-gray-700">{step} {pct > 0 ? `${pct}%` : ''}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Please wait — do not close this tab (import continues on the server)</p>
                </div>
            )}

            {logs.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs space-y-1 max-h-56 overflow-y-auto">
                    {logs.map((l, i) => (
                        <div key={i} className={`flex gap-2 ${l.type === 'success' ? 'text-emerald-400' : l.type === 'error' ? 'text-red-400' : l.type === 'warn' ? 'text-yellow-400' : 'text-gray-400'}`}>
                            <span className="text-gray-600 flex-shrink-0">{l.time}</span>
                            <span>{l.msg}</span>
                        </div>
                    ))}
                </div>
            )}

            {importFailed && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                    <p className="font-black text-red-800 text-base">Import did not complete</p>
                    <p className="text-sm text-red-700 mt-1">Check the log above for details. Safe to re-run: re-uploading the SAME file updates existing records instead of duplicating them. Uploading a DIFFERENT file will add its records to this tenant.</p>
                </div>
            )}

            {done && results && (
                <div className={`rounded-2xl p-5 border ${importFullyComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start gap-3 mb-4">
                        {importFullyComplete
                            ? <CheckCircle size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                            : <AlertTriangle size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                        <div>
                            {importFullyComplete ? (
                                <>
                                    <p className="font-black text-emerald-800 text-base">✅ Upload complete — your data has been imported and your books are balanced.</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">Real outstanding balances imported correctly</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-black text-amber-900 text-base">
                                        ⚠️ Import completed with {completeness?.warnings.length ?? 0} warning(s) — review before going live
                                    </p>
                                    <p className="text-xs text-amber-700 mt-0.5">Data was imported successfully; the items below need attention before you rely on the books.</p>
                                    {completeness && completeness.warnings.length > 0 && (
                                        <ul className="mt-2 space-y-1 text-sm text-amber-900 list-disc list-inside">
                                            {completeness.warnings.map((warning, idx) => (
                                                <li key={idx}>{warning}</li>
                                            ))}
                                        </ul>
                                    )}
                                    <p className="text-xs text-amber-700 mt-2">
                                        Tip: review <a href="/reports/trial-balance" className="font-bold underline hover:text-amber-900">Trial Balance</a> and ask your admin to run the GL integrity health check.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                    {tieOut && tieOut.gl_ar !== undefined && (
                        <div
                            className="mb-4 rounded-xl border px-4 py-3 text-sm"
                            style={{
                                backgroundColor: tieOutBalanced ? 'rgba(79, 142, 247, 0.08)' : 'rgba(245, 158, 11, 0.12)',
                                borderColor: tieOutBalanced ? '#4F8EF7' : '#F59E0B',
                                color: '#060f1c',
                            }}
                        >
                            <p className="font-black text-xs uppercase tracking-widest mb-2" style={{ color: tieOutBalanced ? '#4F8EF7' : '#F59E0B' }}>
                                AR tie-out {tieOutBalanced ? '✓' : '⚠'}
                            </p>
                            <p>GL Accounts Receivable: <strong>${Number(tieOut.gl_ar).toFixed(2)}</strong></p>
                            <p>Customer balances: <strong>${Number(tieOut.customer_balances ?? 0).toFixed(2)}</strong></p>
                            <p>
                                Difference: <strong>${Number(tieOut.difference ?? 0).toFixed(2)}</strong>
                                {tieOutBalanced
                                    ? <span className="ml-2 font-black" style={{ color: '#4F8EF7' }}>✓ balanced</span>
                                    : <span className="ml-2 font-black" style={{ color: '#F59E0B' }}>review required</span>}
                            </p>
                        </div>
                    )}
                    {tieOut && tieOut.gl_ap !== undefined && (
                        <div
                            className="mb-4 rounded-xl border px-4 py-3 text-sm"
                            style={{
                                backgroundColor: apTieOutBalanced ? 'rgba(79, 142, 247, 0.08)' : 'rgba(245, 158, 11, 0.12)',
                                borderColor: apTieOutBalanced ? '#4F8EF7' : '#F59E0B',
                                color: '#060f1c',
                            }}
                        >
                            <p className="font-black text-xs uppercase tracking-widest mb-2" style={{ color: apTieOutBalanced ? '#4F8EF7' : '#F59E0B' }}>
                                AP tie-out {apTieOutBalanced ? '✓' : '⚠'}
                            </p>
                            <p>GL Accounts Payable: <strong>${Number(tieOut.gl_ap).toFixed(2)}</strong></p>
                            <p>Operational AP: <strong>${Number(tieOut.operational_ap ?? 0).toFixed(2)}</strong></p>
                            <p>
                                Difference: <strong>${Number(tieOut.ap_difference ?? 0).toFixed(2)}</strong>
                                {apTieOutBalanced
                                    ? <span className="ml-2 font-black" style={{ color: '#4F8EF7' }}>✓ balanced</span>
                                    : <span className="ml-2 font-black" style={{ color: '#F59E0B' }}>review required</span>}
                            </p>
                        </div>
                    )}
                    {(tieOut?.gl_bank !== undefined || cogsTrueupAmount !== null) && (
                        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                            {tieOut?.gl_bank !== undefined && (
                                <p>🏦 Bank (GL): <strong>${Number(tieOut.gl_bank).toFixed(2)}</strong></p>
                            )}
                            {cogsTrueupAmount !== null && (
                                <p className={tieOut?.gl_bank !== undefined ? 'mt-1' : ''}>
                                    🧾 COGS true-up posted: <strong>${cogsTrueupAmount.toFixed(2)}</strong>
                                </p>
                            )}
                        </div>
                    )}
                    {glResults && Object.keys(glResults).length > 0 && (
                        <div className="mb-4 rounded-xl border p-4 text-sm" style={{ backgroundColor: '#060f1c', borderColor: '#1e293b', color: '#e2e8f0' }}>
                            <p className="font-black text-xs uppercase tracking-widest mb-3" style={{ color: '#4F8EF7' }}>General ledger posting</p>
                            <div className="space-y-2">
                                {sortGlResultEntries(glResults).map(([entity, stats]) => (
                                    <div key={entity} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(79, 142, 247, 0.08)' }}>
                                        <p className="font-black text-white">{formatGlEntityLabel(entity)}</p>
                                        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{formatGlEntitySummary(stats)}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            <span>Posted: <strong className="text-white">{stats.posted ?? 0}</strong></span>
                                            <span>Failed: <strong style={{ color: (stats.failed ?? 0) > 0 ? '#F59E0B' : '#e2e8f0' }}>{stats.failed ?? 0}</strong></span>
                                            <span>Already posted: <strong className="text-white">{stats.skipped_already_posted ?? 0}</strong></span>
                                            <span>Ineligible: <strong className="text-white">{stats.skipped_ineligible ?? 0}</strong></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {glFailureSamples.length > 0 && (
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1e293b' }}>
                                    <p className="font-black text-xs uppercase tracking-widest mb-2" style={{ color: '#F59E0B' }}>GL failure samples</p>
                                    <ul className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
                                        {glFailureSamples.slice(0, 10).map((sample, idx) => (
                                            <li key={`${sample.entity}-${sample.source_type}-${sample.source_id}-${idx}`} style={{ color: '#fcd34d' }}>
                                                <span className="font-bold text-white">{formatGlEntityLabel(sample.entity)}</span>
                                                {' · '}
                                                {sample.source_type} {sample.source_id}: {sample.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {(results.customers ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.customers?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Customers</p></div>}
                        {(results.products ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.products?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Products</p></div>}
                        {(results.invoices ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.invoices?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Invoices</p></div>}
                        {(results.payments ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.payments?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Payments</p></div>}
                        {(results.salesReturns ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.salesReturns?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Sales Returns</p></div>}
                        {(results.suppliers ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.suppliers?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Suppliers</p></div>}
                        {(results.supplierPurchases ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.supplierPurchases?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Supplier POs</p></div>}
                        {(results.supplierPayments ?? 0) > 0 && <div className={`bg-white rounded-xl p-3 text-center border ${importFullyComplete ? 'border-emerald-100' : 'border-amber-100'}`}><p className="text-2xl font-black">{results.supplierPayments?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Supplier Pays</p></div>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <a href="/customers" className={`px-4 py-2 text-white rounded-xl text-xs font-black ${importFullyComplete ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>→ View Customers</a>
                        <a href="/invoices" className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-gray-700">→ View Invoices</a>
                        <a href="/product-catalog" className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-gray-700">→ View Products</a>
                    </div>
                </div>
            )}

            <button onClick={doImport} disabled={!file || busy}
                className="w-full py-5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3">
                {busy ? <><RefreshCw size={20} className="animate-spin" /> Importing — please wait...</>
                    : <><Zap size={20} /> {isDb ? '🤖 Import Full Database (Correct Balances + Products + Invoices)' : '🤖 Import Data'}</>}
            </button>
        </div>
    );
}
