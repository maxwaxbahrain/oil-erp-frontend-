import { useState, useCallback } from 'react';
import { Upload, CheckCircle, RefreshCw, Trash2, Users, Package, FileText, CreditCard, TrendingUp, Zap } from 'lucide-react';
import { createSupplier, getSuppliers } from '../../services/purchasesService';
import { saveImportedProduct } from '../../services/productService';

const API = (import.meta.env.VITE_API_URL as string || 'http://localhost:8000').replace(/\/$/, '');

interface LogEntry { time: string; msg: string; type: 'info' | 'success' | 'error' | 'warn'; }
interface Results { customers?: number; products?: number; suppliers?: number; invoices?: number; supplierPurchases?: number; supplierPayments?: number; }

const ts = () => new Date().toLocaleTimeString();

export default function DataMigration() {
    const [file, setFile] = useState<File | null>(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState(false);
    const [pct, setPct] = useState(0);
    const [step, setStep] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [results, setResults] = useState<Results | null>(null);
    const [done, setDone] = useState(false);

    const log = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, { time: ts(), msg, type }]);
    }, []);

    const prog = (p: number, s: string) => { setPct(p); setStep(s); };

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
            balMap[name] = Number(res[0]?.bal) || 0;
        }

        const customers = custRows.map((r: any) => {
            const name = String(r.aname || '').trim();
            const bal = balMap[name] ?? 0;
            return { name: name.slice(0, 150), address: String(r.address || '').trim().slice(0, 300) || null, phone: String(r.phone || '').trim().slice(0, 50) || null, email: null, opening_balance: Number(r.op_bal || 0), balance: bal, credit_limit: Number(r.credit_limit || 0), category: 'retail', notes: `BETTANO | Owes: $${bal.toFixed(2)}` };
        }).filter((c: any) => c.name);

        log(`👥 ${customers.length} customers — real outstanding balances calculated`, 'success');

        const suppRows = q(`SELECT aname, address, phone FROM account_detail WHERE (a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%') AND status=1`);
        const suppliers = suppRows.map((r: any) => ({ name: String(r.aname || '').trim().slice(0, 150), address: String(r.address || '').slice(0, 300) || null, phone: String(r.phone || '').slice(0, 50) || null, email: null, notes: 'BETTANO import' })).filter((s: any) => s.name);
        const supplierNameSet = new Set(suppliers.map((s: any) => s.name));

        // ── Per-supplier PURCHASES (v_type='Purchase') ──────────────────────
        // Vouchers in BETTANO use `debit='Purchase'` and `credit=<supplier>`.
        // Pull the header + join the line items from the purchases table.
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
                const grand = Number(h.amount) || 0;
                const items = (itemsByVoucher[String(h.v_id)] || []).map((it: any) => {
                    const qty = Number(it.units) || 0;
                    const price = Number(it.cost_per_unit) || 0;
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

        // ── Per-supplier PAYMENTS (v_type='Payment') ────────────────────────
        // Vouchers in BETTANO use `debit=<supplier>` (decreasing AP) and
        // `credit=<bank account>`. Match by supplier name.
        const supplierPayRows = q(`SELECT v_id, date, vch_no, amount, debit AS supplier_name, credit AS bank, payment_reference FROM vouchers WHERE v_type='Payment'`);
        const supplier_payments = supplierPayRows
            .filter((p: any) => supplierNameSet.has(String(p.supplier_name || '').trim()))
            .map((p: any) => ({
                supplier_name: String(p.supplier_name || '').trim(),
                date: String(p.date || '').slice(0, 20),
                reference: String(p.vch_no || '').slice(0, 100),
                amount: Number(p.amount) || 0,
                payment_method: 'Bank Transfer',
                notes: `BETTANO import · ${String(p.bank || '').trim()}`,
            }));

        const prodRows = q(`SELECT item, units_name, sku, item_desc, defaultsellingprice, defaultpurchaseprice FROM item_measure WHERE item IS NOT NULL AND TRIM(item) != ''`);
        const products = prodRows.map((r: any) => ({ name: String(r.item || '').trim().slice(0, 150), sku: String(r.sku || '').replace('SKU:', '').trim().slice(0, 100), description: String(r.item_desc || r.units_name || '').slice(0, 300), price: Number(r.defaultsellingprice || 0), cost: Number(r.defaultpurchaseprice || 0), stock: 0, category: 'Imported', unit: String(r.units_name || 'unit').slice(0, 50) })).filter((p: any) => p.name);

        const invRows = q(`SELECT date, vch_no, debit as customer_name, amount, narration FROM vouchers WHERE v_type='Sales' ORDER BY date`);
        const invoices = invRows.map((r: any) => ({ invoice_number: String(r.vch_no || '').slice(0, 100), customer_name: String(r.customer_name || '').trim(), date: String(r.date || ''), amount: Number(r.amount || 0), notes: String(r.narration || ''), status: 'paid' })).filter((i: any) => i.customer_name && i.amount > 0);

        const payRows = q(`SELECT date, vch_no, credit as customer_name, amount FROM vouchers WHERE v_type='Receipt' ORDER BY date`);
        const payments = payRows.map((r: any) => ({ reference: String(r.vch_no || '').slice(0, 100), customer_name: String(r.customer_name || '').trim(), date: String(r.date || ''), amount: Number(r.amount || 0) })).filter((p: any) => p.customer_name && p.amount > 0);

        db.close();
        log(`📦 ${products.length} products, ${suppliers.length} suppliers, ${invoices.length} invoices, ${payments.length} payments`, 'info');
        log(`🛒 ${purchase_orders.length} supplier POs, ${supplier_payments.length} supplier payments`, 'info');
        return { customers, suppliers, products, invoices, payments, purchase_orders, supplier_payments };
    };

    const importProductsDirect = async (products: any[]) => {
        // Fetch existing products ONCE so we dedupe by name (case-insensitive).
        // Without this every re-import multiplied every product by another copy
        // because the previous SKU-key generated a fresh IMP-... id each time.
        const existingByName: Record<string, any> = {};
        try {
            const r = await fetch(`${API}/api/products/`);
            if (r.ok) {
                const list = await r.json();
                const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                for (const ex of arr) {
                    const key = String(ex.name || '').trim().toLowerCase();
                    if (key) existingByName[key] = ex;
                }
            }
        } catch { /* continue */ }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            const nameKey = String(p.name || '').trim().toLowerCase();
            if (!nameKey) { skipped++; continue; }
            const existing = existingByName[nameKey];
            const uniqueSku = (p.sku && p.sku.trim()) || existing?.sku || `IMP-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
            const payload = { name: p.name, sku: uniqueSku, category: p.category || 'Imported', price: Number(p.price) || 0, cost: Number(p.cost) || 0, stock: Number(p.stock) || 0, min_stock: 10, unit: p.unit || 'unit', description: p.description || '' };
            try {
                let prod: any = null;
                if (existing) {
                    // Update existing product instead of creating a duplicate.
                    const r = await fetch(`${API}/api/products/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...existing, ...payload }) });
                    if (r.ok) { prod = await r.json().catch(() => existing); updated++; }
                } else {
                    const r = await fetch(`${API}/api/products/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (r.ok) { prod = await r.json().catch(() => null); created++; existingByName[nameKey] = prod || payload; }
                }
                if (prod) {
                    saveImportedProduct({
                        id: String(prod?.id || `LOCAL-${Date.now()}-${i}`),
                        name: p.name, sku: prod?.sku || uniqueSku, category: payload.category, status: 'Active' as const,
                        uom: payload.unit, description: payload.description || p.name, shortDescription: payload.description?.slice(0, 80) || '',
                        velocityStatus: 'Medium' as const, salesVelocity: 0, salesTrend: 0, revenueContribution: 0,
                        grossMarginPercent: 30, netProfitPerUnit: 0, avgDailySales: 0, daysStockRemaining: 0,
                        reorderLevel: 10, overstockRisk: 'Low' as const, leadTimeDays: 7, minOrderQty: 1,
                        locations: [], priceHistory: [], images: [],
                        pricing: { purchasePriceExWorks: payload.cost, freightShipping: 0, importDuty: 0, otherDirectCosts: 0, landedCost: payload.cost, operatingExpenseAllocation: 0, sellingPrice: payload.price, taxRate: 0, taxIncluded: false },
                        aiEnabled: false, aiDemandPrediction: 0, aiConfidenceLevel: 0,
                    } as any);
                }
            } catch { /* continue */ }
            if (i % 20 === 0) prog(70 + Math.round((i / products.length) * 10), `Importing ${i + 1}/${products.length} products...`);
        }
        log(`📦 Products: ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}`, 'success');
        return created + updated;
    };

    const importInvoicesDirect = async (invoices: any[]) => {
        let custMap: Record<string, string> = {};
        try {
            const r = await fetch(`${API}/api/customers/`);
            if (r.ok) {
                const list = await r.json();
                const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                for (const c of arr) {
                    const nm = String(c.name || '').trim().toLowerCase();
                    if (nm && c.id != null) custMap[nm] = String(c.id);
                }
            }
        } catch { /* continue */ }

        let created = 0;
        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const custName = String(inv.customer_name || '').trim();
            const customerId = custMap[custName.toLowerCase()];
            if (!customerId) continue;
            const grand = Number(inv.amount) || 0;
            const payload = {
                invoiceNumber: inv.invoice_number || `INV-${Date.now()}-${i}`,
                customerId, customerName: custName,
                invoiceDate: inv.date || new Date().toISOString().split('T')[0],
                dueDate: null,
                lineItems: [{ product: 'Imported', description: inv.notes || '', quantity: 1, rate: grand, amount: grand, productId: null, itemCode: null }],
                subtotal: grand, taxRate: 0, taxAmount: 0, discount: 0, grandTotal: grand,
                notes: inv.notes || 'BETTANO import', salesman: '', van: '',
                payment_status: inv.status === 'paid' ? 'Paid' : 'Unpaid',
                payment_method: 'Cash',
                amount_paid: inv.status === 'paid' ? grand : 0,
                remaining_balance: inv.status === 'paid' ? 0 : grand,
                status: inv.status || 'paid',
            };
            try {
                const r = await fetch(`${API}/api/invoices/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (r.ok) created++;
            } catch { /* continue */ }
            if (i % 25 === 0) prog(90 + Math.round((i / invoices.length) * 8), `Importing ${i + 1}/${invoices.length} invoices...`);
        }
        return created;
    };

    const importSuppliersDirect = async (suppliers: any[]) => {
        const existing = await getSuppliers();
        const existingNames = new Set(existing.map(s => s.name.toLowerCase().trim()));
        let created = 0;
        for (let i = 0; i < suppliers.length; i++) {
            const s = suppliers[i];
            const name = String(s.name || '').trim();
            if (!name || existingNames.has(name.toLowerCase())) continue;
            try {
                await createSupplier({ name, code: `SUP-${Date.now().toString().slice(-6)}-${i}`, contactPerson: '', email: s.email || '', phone: s.phone || '', address: s.address || '', taxId: '', status: 'Active', paymentTerms: 'Net 30', currency: 'USD', rating: 'A', notes: s.notes || 'BETTANO import' });
                existingNames.add(name.toLowerCase());
                created++;
            } catch { /* continue */ }
            if (i % 20 === 0) prog(80 + Math.round((i / suppliers.length) * 10), `Importing ${i + 1}/${suppliers.length} suppliers...`);
        }
        return created;
    };

    // Builds a supplier-name → id map by hitting the backend list endpoint.
    // POs and supplier payments reference suppliers by NAME in BETTANO; we
    // need the freshly-assigned backend int id to POST them.
    const buildSupplierNameMap = async (): Promise<Record<string, string>> => {
        const map: Record<string, string> = {};
        try {
            const r = await fetch(`${API}/api/suppliers/`);
            if (r.ok) {
                const list = await r.json();
                if (Array.isArray(list)) {
                    for (const s of list) {
                        const key = String(s.name || '').trim().toLowerCase();
                        if (key && s.id != null) map[key] = String(s.id);
                    }
                }
            }
        } catch { /* continue */ }
        return map;
    };

    const importSupplierPurchasesDirect = async (purchaseOrders: any[]) => {
        const nameToId = await buildSupplierNameMap();
        let created = 0;
        let skipped = 0;
        for (let i = 0; i < purchaseOrders.length; i++) {
            const po = purchaseOrders[i];
            const sid = nameToId[String(po.supplier_name || '').trim().toLowerCase()];
            if (!sid) { skipped++; continue; }
            const payload = {
                poNumber: po.po_number || `PUR-${Date.now()}-${i}`,
                date: po.date,
                expectedDate: po.expected_date || po.date,
                status: po.status || 'Received',
                payment_status: po.payment_status || 'Unpaid',
                subtotal: Number(po.subtotal) || 0,
                taxTotal: Number(po.tax_total) || 0,
                grandTotal: Number(po.grand_total) || 0,
                amount_paid: Number(po.amount_paid) || 0,
                notes: po.notes || 'BETTANO import',
                items: (po.items || []).map((it: any) => ({
                    productId: it.product_id || '',
                    productName: it.product_name || '',
                    uom: it.uom || 'unit',
                    quantity: Number(it.quantity) || 0,
                    unitPrice: Number(it.unit_price) || 0,
                    taxRate: 0, discount: 0,
                    total: Number(it.total) || 0,
                })),
            };
            try {
                const r = await fetch(`${API}/api/suppliers/${sid}/purchases`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (r.ok) created++; else skipped++;
            } catch { skipped++; }
            if (i % 10 === 0) prog(85 + Math.round((i / purchaseOrders.length) * 5), `Importing ${i + 1}/${purchaseOrders.length} supplier POs...`);
        }
        return { created, skipped };
    };

    const importSupplierPaymentsDirect = async (supplierPayments: any[]) => {
        const nameToId = await buildSupplierNameMap();
        let created = 0;
        let skipped = 0;
        for (let i = 0; i < supplierPayments.length; i++) {
            const p = supplierPayments[i];
            const sid = nameToId[String(p.supplier_name || '').trim().toLowerCase()];
            if (!sid) { skipped++; continue; }
            const payload = {
                amount: Number(p.amount) || 0,
                date: p.date,
                paymentMethod: p.payment_method || 'Bank Transfer',
                reference: p.reference || '',
                notes: p.notes || 'BETTANO import',
            };
            try {
                const r = await fetch(`${API}/api/suppliers/${sid}/payments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (r.ok) created++; else skipped++;
            } catch { skipped++; }
            if (i % 10 === 0) prog(90 + Math.round((i / supplierPayments.length) * 3), `Importing ${i + 1}/${supplierPayments.length} supplier payments...`);
        }
        return { created, skipped };
    };

    const importPaymentsIdempotent = async (payments: any[]) => {
        // Match payments to customers by name; skip if a payment with the same reference already exists.
        const nameToId: Record<string, number> = {};
        try {
            const r = await fetch(`${API}/api/customers/`);
            if (r.ok) {
                const list = await r.json();
                const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                for (const c of arr) {
                    const key = String(c.name || '').trim().toLowerCase();
                    if (key) nameToId[key] = c.id;
                }
            }
        } catch { /* continue */ }

        const existingRefs = new Set<string>();
        for (const cid of new Set(Object.values(nameToId))) {
            try {
                const r = await fetch(`${API}/api/customers/${cid}/payments`);
                if (r.ok) {
                    const pays = await r.json();
                    for (const p of pays) {
                        const ref = String(p.reference || '').trim().toLowerCase();
                        if (ref) existingRefs.add(`${cid}::${ref}`);
                    }
                }
            } catch { /* continue */ }
        }

        let created = 0;
        let skipped = 0;
        for (let i = 0; i < payments.length; i++) {
            const p = payments[i];
            const key = String(p.customer_name || '').trim().toLowerCase();
            const cid = nameToId[key];
            if (!cid) { skipped++; continue; }
            const ref = String(p.reference || '').trim();
            if (ref && existingRefs.has(`${cid}::${ref.toLowerCase()}`)) { skipped++; continue; }
            const payload = {
                customer_id: cid,
                amount: Number(p.amount) || 0,
                payment_date: String(p.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
                payment_method: 'Cash',
                reference: ref,
                notes: 'BETTANO import',
            };
            try {
                const r = await fetch(`${API}/api/customers/${cid}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (r.ok) {
                    created++;
                    if (ref) existingRefs.add(`${cid}::${ref.toLowerCase()}`);
                }
            } catch { /* continue */ }
            if (i % 25 === 0) prog(95 + Math.round((i / payments.length) * 4), `Importing ${i + 1}/${payments.length} payments...`);
        }
        return { created, skipped };
    };

    const importCustomersIdempotent = async (customers: any[]) => {
        // Fetch existing customers ONCE so we can update-by-name instead of duplicating.
        const existingByName: Record<string, any> = {};
        try {
            const r = await fetch(`${API}/api/customers/`);
            if (r.ok) {
                const list = await r.json();
                const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                for (const c of arr) {
                    const key = String(c.name || '').trim().toLowerCase();
                    if (key) existingByName[key] = c;
                }
            }
        } catch { /* continue */ }

        let created = 0;
        let updated = 0;
        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const key = String(c.name || '').trim().toLowerCase();
            const existing = key ? existingByName[key] : null;
            try {
                if (existing) {
                    const payload = { ...existing, ...c, balance: c.balance, opening_balance: c.opening_balance ?? c.balance };
                    const r = await fetch(`${API}/api/customers/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (r.ok) updated++;
                } else {
                    const r = await fetch(`${API}/api/customers/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
                    if (r.ok) {
                        const made = await r.json();
                        existingByName[key] = made;
                        if (c.balance !== 0) await fetch(`${API}/api/customers/${made.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...made, balance: c.balance, opening_balance: c.balance }) });
                        created++;
                    }
                }
            } catch { /* continue */ }
            if (i % 20 === 0) prog(55 + Math.round((i / customers.length) * 10), `Importing ${i + 1}/${customers.length} customers...`);
        }
        return { created, updated };
    };

    const postToBackend = async (data: any) => {
        const backendResults: any = {};

        if (data.customers?.length) {
            log(`👥 Importing ${data.customers.length} customers (dedup by name)...`, 'info');
            backendResults.customers = await importCustomersIdempotent(data.customers);
        }

        if (!backendResults.products?.created && data.products?.length) {
            log(`📦 Importing ${data.products.length} products directly...`, 'info');
            const productsCreated = await importProductsDirect(data.products);
            backendResults.products = { created: productsCreated };
        }

        if (!backendResults.suppliers?.created && data.suppliers?.length) {
            log(`🏭 Importing ${data.suppliers.length} suppliers directly...`, 'info');
            const suppliersCreated = await importSuppliersDirect(data.suppliers);
            backendResults.suppliers = { created: suppliersCreated };
        }

        // Per-supplier purchases (POs) + payments. Must run AFTER suppliers
        // exist so the name → id lookup resolves. Both endpoints are
        // idempotent so re-runs are safe.
        if (data.purchase_orders?.length) {
            log(`🛒 Importing ${data.purchase_orders.length} supplier POs into respective profiles...`, 'info');
            backendResults.supplierPurchases = await importSupplierPurchasesDirect(data.purchase_orders);
            log(`🛒 POs: ${backendResults.supplierPurchases.created} created${backendResults.supplierPurchases.skipped ? `, ${backendResults.supplierPurchases.skipped} skipped` : ''}`, 'success');
        }

        if (data.supplier_payments?.length) {
            log(`🏦 Importing ${data.supplier_payments.length} supplier payments into respective profiles...`, 'info');
            backendResults.supplierPayments = await importSupplierPaymentsDirect(data.supplier_payments);
            log(`🏦 Supplier payments: ${backendResults.supplierPayments.created} created${backendResults.supplierPayments.skipped ? `, ${backendResults.supplierPayments.skipped} skipped` : ''}`, 'success');
        }

        if (!backendResults.invoices?.created && data.invoices?.length) {
            log(`📄 Importing ${data.invoices.length} invoices directly...`, 'info');
            const invoicesCreated = await importInvoicesDirect(data.invoices);
            backendResults.invoices = { created: invoicesCreated };
            if (invoicesCreated === 0) log('⚠️ No invoices matched existing customers — skipped', 'warn');
        }

        if (data.payments?.length) {
            log(`💵 Importing ${data.payments.length} payments (dedup by reference)...`, 'info');
            backendResults.payments = await importPaymentsIdempotent(data.payments);
            log(`💵 Payments: ${backendResults.payments.created} created, ${backendResults.payments.skipped} skipped`, 'success');
        }

        return backendResults;
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
            return { name: get(nf), email: null, phone: get(pf) || null, address: get(af) || null, balance: parseFloat(get(bf)) || 0, opening_balance: parseFloat(get(bf)) || 0, category: 'retail', notes: 'CSV import' };
        }).filter(c => c.name);
        return { customers, suppliers: [], products: [], invoices: [], payments: [] };
    };

    const doImport = async () => {
        if (!file) return;
        setBusy(true); setPct(0); setLogs([]); setResults(null); setDone(false);
        try {
            prog(5, 'Reading file...');
            const ext = file.name.toLowerCase().split('.').pop() || '';
            let data: any;
            if (ext === 'db' || ext === 'sqlite') { prog(10, 'Opening database...'); log('📂 Opening BETTANO database...', 'info'); data = await extractAllData(await file.arrayBuffer()); }
            else if (ext === 'csv' || ext === 'txt') { prog(15, 'Parsing CSV...'); data = await parseCsv(await file.text()); log(`📋 Found ${data.customers.length} customers in CSV`, 'info'); }
            else throw new Error('For Excel: Save As → CSV first, then upload');

            prog(50, 'Importing to ERP...');
            log('⬆️ Sending to ERP backend...', 'info');
            const backendResults = await postToBackend(data);

            if (backendResults.customers) log(`👥 Customers: ${backendResults.customers.created || 0} created, ${backendResults.customers.updated || 0} updated`, 'success');
            if (backendResults.products) log(`📦 Products: ${backendResults.products.created || 0} created`, 'success');
            if (backendResults.suppliers) log(`🏭 Suppliers: ${backendResults.suppliers.created || 0} created`, 'success');
            if (backendResults.invoices) log(`📄 Invoices: ${backendResults.invoices.created || 0} created`, 'success');

            prog(100, 'Done!');
            setDone(true);
            setResults({
                customers: (backendResults.customers?.created || 0) + (backendResults.customers?.updated || 0),
                products: backendResults.products?.created || 0,
                suppliers: backendResults.suppliers?.created || 0,
                invoices: backendResults.invoices?.created || 0,
                supplierPurchases: backendResults.supplierPurchases?.created || 0,
                supplierPayments: backendResults.supplierPayments?.created || 0,
            });
            log('🎉 Migration complete! Suppliers populated with their POs and payments.', 'success');
        } catch (e: any) { log(`❌ ${e.message}`, 'error'); prog(0, ''); }
        finally { setBusy(false); }
    };

    const clearAll = async () => {
        if (!confirm('Clear ALL customers from ERP? Cannot be undone.')) return;
        setBusy(true);
        try {
            const r = await fetch(`${API}/api/customers/bulk/clear-all`, { method: 'DELETE' });
            const d = await r.json();
            log(`✅ Cleared ${d.deleted} customers`, 'success');
            setResults(null); setDone(false);
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
                    onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); } }}
                    onClick={() => document.getElementById('mig-ai-file')?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${drag ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-ai-file" type="file" accept=".db,.sqlite,.csv,.xlsx,.xls,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResults(null); setDone(false); setLogs([]); } }} />
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
                    <p className="text-xs text-gray-400 mt-2">Please wait — do not close this tab</p>
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

            {done && results && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle size={22} className="text-emerald-600" />
                        <div>
                            <p className="font-black text-emerald-800 text-base">🎉 Migration Complete!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Real outstanding balances imported correctly</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {(results.customers ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.customers?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Customers</p></div>}
                        {(results.products ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.products?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Products</p></div>}
                        {(results.invoices ?? 0) > 0 && <div className="bg-white rounded-xl p-3 text-center border border-emerald-100"><p className="text-2xl font-black">{results.invoices?.toLocaleString()}</p><p className="text-xs text-gray-500 font-bold">Invoices</p></div>}
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
