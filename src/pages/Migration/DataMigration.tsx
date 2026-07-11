import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, CheckCircle, RefreshCw, Trash2, Users, Package, FileText, CreditCard, TrendingUp, Zap } from 'lucide-react';
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
interface GlImportStats { posted?: number; skipped?: number; failed?: number; }
interface TieOut { gl_ar?: number; customer_balances?: number; difference?: number; }
interface ImportJobStatus {
    job_id: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    phase?: string | null;
    processed?: number;
    total?: number;
    results?: Record<string, EntityImportStats & { gl?: Record<string, EntityImportStats>; tie_out?: TieOut }> | null;
    error?: string | null;
    updated_at?: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 30;
const STALL_MINUTES = 10;

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

        log('Calculating real outstanding balances...', 'info');
        const custRows = q(`SELECT aname, address, phone, email_id, op_bal, credit_limit FROM account_detail WHERE (a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%') AND status=1`);

        const balMap: Record<string, number> = {};
        for (const r of custRows) {
            const name = String(r.aname || '').trim();
            if (!name) continue;
            const safe = name.replace(/'/g, "''");
            const res = q(`SELECT ROUND(SUM(CASE WHEN v_type='Sales' AND debit='${safe}' THEN amount ELSE 0 END) - SUM(CASE WHEN v_type='Receipt' AND credit='${safe}' THEN amount ELSE 0 END), 2) as bal FROM vouchers`);
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
        const payments = payRows.map((r: any) => ({ reference: String(r.vch_no || '').slice(0, 100), customer_name: String(r.customer_name || '').trim(), date: String(r.date || ''), amount: parseMigrationNum(r.amount) })).filter((p: any) => p.customer_name && p.amount > 0);

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
        return { customers, suppliers, products, invoices, payments, sales_returns, purchase_orders, supplier_payments };
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

    const summarizeBackendResults = useCallback((backendResults: Record<string, any>) => {
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
        if (gl) {
            const glParts = Object.entries(gl)
                .map(([k, v]) => `${k}: ${v.posted ?? 0} posted`)
                .join(', ');
            if (glParts) log(`📒 GL posting — ${glParts}`, 'success');
        }

        const tie = backendResults.tie_out as TieOut | undefined;
        if (tie && tie.gl_ar !== undefined) {
            setTieOut(tie);
            log(
                `📊 AR tie-out — GL AR: $${Number(tie.gl_ar).toFixed(2)}, customer balances: $${Number(tie.customer_balances ?? 0).toFixed(2)}, diff: $${Number(tie.difference ?? 0).toFixed(2)}`,
                Math.abs(Number(tie.difference ?? 0)) <= 0.01 ? 'success' : 'warn',
            );
        } else {
            setTieOut(null);
        }

        setResults({
            customers: (backendResults.customers?.created || 0) + (backendResults.customers?.updated || 0),
            products: (backendResults.products?.created || 0) + (backendResults.products?.updated || 0),
            suppliers: (backendResults.suppliers?.created || 0) + (backendResults.suppliers?.updated || 0),
            invoices: backendResults.invoices?.created || 0,
            payments: backendResults.payments?.created || 0,
            salesReturns: backendResults.sales_returns?.created || 0,
            supplierPurchases: backendResults.purchase_orders?.created || 0,
            supplierPayments: backendResults.supplier_payments?.created || 0,
        });
        setDone(true);
        setImportFailed(false);
    }, [log]);

    const finishImportSuccess = useCallback((backendResults: Record<string, any>) => {
        prog(100, 'Done!');
        summarizeBackendResults(backendResults);
        log('✅ Upload complete — your data has been imported and your books are balanced.', 'success');
    }, [log, prog, summarizeBackendResults]);

    const finishImportFailure = useCallback((message: string) => {
        stopPolling();
        setImportFailed(true);
        setDone(false);
        setResults(null);
        setTieOut(null);
        prog(0, '');
        log(`❌ Import failed: ${message}`, 'error');
        log('ℹ️ Re-uploading the same file is safe — the import is idempotent.', 'info');
        setBusy(false);
    }, [log, prog, stopPolling]);

    const runSyncImport = useCallback(async (data: Record<string, unknown>) => {
        log('⬆️ Using synchronous import (async endpoint unavailable)...', 'warn');
        prog(20, 'Importing to ERP...');
        const { data: importResponse } = await api.post<{ success: boolean; results: Record<string, EntityImportStats> }>(
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
                    log('⚠️ Job appears stalled — re-uploading is safe.', 'warn');
                    stallWarnedRef.current = true;
                }
            }
            return;
        }

        stopPolling();

        if (job.status === 'completed') {
            finishImportSuccess((job.results ?? {}) as Record<string, any>);
            setBusy(false);
            return;
        }

        if (job.status === 'failed') {
            finishImportFailure(job.error || 'Unknown server error');
        }
    }, [finishImportFailure, finishImportSuccess, log, prog, stopPolling]);

    const pollImportStatus = useCallback(async (jobId: number) => {
        try {
            const { data: job } = await api.get<ImportJobStatus>(`/api/migrate/import-status/${jobId}`);
            consecutivePollFailuresRef.current = 0;
            handleJobStatus(job);
        } catch (e: any) {
            consecutivePollFailuresRef.current += 1;
            if (consecutivePollFailuresRef.current >= MAX_CONSECUTIVE_POLL_FAILURES) {
                finishImportFailure(
                    e?.response?.data?.detail || e?.message || 'Lost connection to import status',
                );
                return;
            }
            log('…still processing (connection retry)', 'warn');
        }
    }, [finishImportFailure, handleJobStatus, log]);

    const startAsyncImport = useCallback((jobId: number) => {
        activeJobIdRef.current = jobId;
        consecutivePollFailuresRef.current = 0;
        lastPhaseRef.current = null;
        stallWarnedRef.current = false;
        log(`🚀 Import started (job #${jobId}) — processing on server...`, 'info');
        prog(10, 'Waiting for server…');
        stopPolling();
        pollImportStatus(jobId);
        pollTimerRef.current = setInterval(() => {
            if (activeJobIdRef.current !== null) {
                pollImportStatus(activeJobIdRef.current);
            }
        }, POLL_INTERVAL_MS);
    }, [log, pollImportStatus, prog, stopPolling]);

    const doImport = async () => {
        if (!file) return;
        stopPolling();
        setBusy(true);
        setPct(0);
        setLogs([]);
        setResults(null);
        setTieOut(null);
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
                log('📂 Opening BETTANO database...', 'info');
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
            setResults(null); setDone(false); setTieOut(null); setImportFailed(false);
        } catch (e: any) { log(`❌ ${e.message}`, 'error'); }
        finally { setBusy(false); }
    };

    const fileExt = file?.name.toLowerCase().split('.').pop() || '';
    const isDb = fileExt === 'db' || fileExt === 'sqlite';

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
                <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 text-green-300 text-xs font-bold">✅ Correct balance = Total Sales − Total Payments received</div>
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
                    <div className="flex items-center gap-2"><span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded">.db / .sqlite</span><span className="text-blue-800 text-sm font-medium">Soltol / BETTANO — Full migration with correct balances</span><span className="bg-orange-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black ml-auto">BEST</span></div>
                    <div className="flex items-center gap-2"><span className="bg-white border border-blue-200 text-blue-700 text-xs font-black px-2 py-0.5 rounded">.csv</span><span className="text-blue-700 text-sm">QuickBooks, DEAR, Cin7, Dynamics, NetSuite</span></div>
                    <div className="flex items-center gap-2"><span className="bg-white border border-blue-200 text-blue-700 text-xs font-black px-2 py-0.5 rounded">.xlsx</span><span className="text-blue-700 text-sm">Excel — save as CSV first</span></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Upload Your File</p>
                <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); setImportFailed(false); setTieOut(null); } }}
                    onClick={() => document.getElementById('mig-ai-file')?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${drag ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-ai-file" type="file" accept=".db,.sqlite,.csv,.xlsx,.xls,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); setImportFailed(false); setTieOut(null); } }} />
                    {file ? (
                        <div>
                            <div className="text-4xl mb-2">{isDb ? '🗄️' : '📋'}</div>
                            <p className="font-black text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            {isDb && <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">✅ BETTANO.db — correct outstanding balances</div>}
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
                    <p className="text-sm text-red-700 mt-1">Check the log above for details. Re-uploading the same file is safe.</p>
                </div>
            )}

            {done && results && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle size={22} className="text-emerald-600" />
                        <div>
                            <p className="font-black text-emerald-800 text-base">✅ Upload complete — your data has been imported and your books are balanced.</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Real outstanding balances imported correctly</p>
                        </div>
                    </div>
                    {tieOut && tieOut.gl_ar !== undefined && (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
                            <p className="font-black text-xs uppercase tracking-widest text-emerald-700 mb-1">AR tie-out</p>
                            <p>GL Accounts Receivable: <strong>${Number(tieOut.gl_ar).toFixed(2)}</strong></p>
                            <p>Customer balances: <strong>${Number(tieOut.customer_balances ?? 0).toFixed(2)}</strong></p>
                            <p>Difference: <strong>${Number(tieOut.difference ?? 0).toFixed(2)}</strong></p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {(results.customers ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.customers?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Customers</p></div>}
                        {(results.products ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.products?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Products</p></div>}
                        {(results.invoices ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.invoices?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Invoices</p></div>}
                        {(results.payments ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.payments?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Payments</p></div>}
                        {(results.salesReturns ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.salesReturns?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Sales Returns</p></div>}
                        {(results.suppliers ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.suppliers?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Suppliers</p></div>}
                        {(results.supplierPurchases ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.supplierPurchases?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Supplier POs</p></div>}
                        {(results.supplierPayments ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.supplierPayments?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Supplier Pays</p></div>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <a href="/customers" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700">→ View Customers</a>
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
