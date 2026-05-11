import { useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://bettano-erp-backend.onrender.com').replace(/\/$/, '');

async function createCustomerViaAPI(customer: any): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: customer.name,
                email: customer.email || '',
                phone: customer.phone || '',
                address: customer.address || '',
                balance: customer.balance || 0,
                opening_balance: customer.opening_balance || customer.balance || 0,
                credit_limit: customer.credit_limit || 0,
                category: 'Imported',
                notes: `Imported from ${customer.src || 'Migration'}`
            })
        });
        return res.ok;
    } catch { return false; }
}
import { Upload, Database, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';

const CK = 'bettano_customers_imported';
const SK = 'bettano_suppliers_imported';
const PK = 'bettano_imported_products';
const IK = 'bettano_invoices_imported';
const HK = 'soltol_import_history';

const SOURCES = [
    { id:'soltol_db',  icon:'🗄️', name:'Soltol / Bettano DB',   fmt:'.db,.sqlite', color:'bg-orange-50 border-orange-200 text-orange-700',
      steps:['Open your old Soltol/Bettano ERP software','Go to Settings → Backup → Export Database','Save the .db file to your desktop','Upload that file here — all data transfers automatically'] },
    { id:'quickbooks', icon:'📊', name:'QuickBooks',              fmt:'.csv,.iif,.xlsx', color:'bg-green-50 border-green-200 text-green-700',
      steps:['In QuickBooks: File → Utilities → Export → Lists to IIF Files','For customers: Lists → Customer List → Export','For invoices: Reports → Sales → Export to CSV','Upload the file(s) here'] },
    { id:'dynamics',   icon:'🔷', name:'MS Dynamics 365',        fmt:'.csv,.xlsx,.xml', color:'bg-blue-50 border-blue-200 text-blue-700',
      steps:['Dynamics 365 → Settings → Data Management → Export Data','Select entities: Accounts, Products, Invoices','Choose CSV format and download','Upload each file here'] },
    { id:'netsuite',   icon:'🔴', name:'Oracle NetSuite',        fmt:'.csv,.xlsx', color:'bg-red-50 border-red-200 text-red-700',
      steps:['NetSuite → Reports → Saved Searches','Create search for Customers or Items','Set columns: Name, Email, Phone, Address','Click Export → CSV and upload here'] },
    { id:'cin7',       icon:'📦', name:'Cin7 Core / DEAR',       fmt:'.csv,.xlsx', color:'bg-purple-50 border-purple-200 text-purple-700',
      steps:['Cin7 → Settings → Data Export tool','Select: Customers, Products, Sales Orders','Export as CSV or Excel','Upload here'] },
    { id:'csv',        icon:'📋', name:'Generic CSV / Excel',    fmt:'.csv,.xlsx,.xls', color:'bg-gray-50 border-gray-200 text-gray-700',
      steps:['Download the CSV template below','Fill in your data in the same column format','Save as CSV (.csv) file','Upload here'] },
];

function getCount(k: string) {
    try { return JSON.parse(localStorage.getItem(k) || '[]').length; } catch { return 0; }
}

export default function DataMigration() {
    const [sel, setSel]     = useState('soltol_db');
    const [file, setFile]   = useState<File | null>(null);
    const [drag, setDrag]   = useState(false);
    const [busy, setBusy]   = useState(false);
    const [pct, setPct]     = useState(0);
    const [result, setResult] = useState<{ok: boolean; msg: string} | null>(null);
    const [counts, setCounts] = useState({
        c: getCount(CK), s: getCount(SK), p: getCount(PK), i: getCount(IK)
    });

    const src = SOURCES.find(s => s.id === sel)!;

    const pick = (f: File) => { setFile(f); setResult(null); };

    const doImport = async () => {
        if (!file) return;
        setBusy(true); setPct(5); setResult(null);
        const log: string[] = [];
        try {
            const ext = file.name.toLowerCase().split('.').pop() || '';

            if (ext === 'db' || ext === 'sqlite') {
                // Load SQL.js from CDN
                setPct(15);
                const sqljs: any = await new Promise((resolve) => {
                    if ((window as any).initSqlJs) { resolve((window as any).initSqlJs); return; }
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
                    script.onload = () => setTimeout(() => resolve((window as any).initSqlJs), 500);
                    script.onerror = () => resolve(null);
                    document.head.appendChild(script);
                });
                if (!sqljs) throw new Error('Could not load SQL.js. Please check your internet and try again.');

                setPct(30);
                const buf = await file.arrayBuffer();
                const SQL = await sqljs({
                    locateFile: (fn: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${fn}`
                });
                const db = new SQL.Database(new Uint8Array(buf));

                // Customers
                setPct(45);
                // Get customers WITH calculated balance from vouchers
                const cr = db.exec("SELECT aname, address, phone, email_id, op_bal, cl_bal, credit_limit, credit_period FROM account_detail WHERE a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%'");
                
                // Calculate balance per customer from vouchers
                const balQuery = db.exec("SELECT debit, SUM(CASE WHEN v_type='Sales' OR v_type='Sales Return' THEN amount ELSE 0 END) - SUM(CASE WHEN v_type='Receipt' OR v_type='Payment' THEN amount ELSE 0 END) as bal FROM vouchers WHERE v_type IN ('Sales','Receipt','Sales Return','Payment') GROUP BY debit");
                const balMap: Record<string,number> = {};
                if (balQuery[0]) {
                    balQuery[0].values.forEach((r: any[]) => { if (r[0]) balMap[r[0].trim()] = Number(r[1]) || 0; });
                }
                if (cr[0]?.values?.length) {
                    const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = cr[0].values
                        .map((r: any[], i: number) => ({ id: `C${Date.now()}${i}`, name: r[0] || '', address: r[1] || '', phone: r[2] || '', email: r[3] || '', opening_balance: r[4] || 0, balance: balMap[r[0]?.trim()] ?? (r[5] || 0), credit_limit: r[6] || 0, credit_period: r[7] || 30, src: 'Soltol DB' }))
                        .filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(CK, JSON.stringify([...ex, ...add]));
                    // Also create in backend API so customers appear in the main list
                    let apiCreated = 0;
                    for (const cust of add.slice(0, 200)) {
                        const ok = await createCustomerViaAPI(cust);
                        if (ok) apiCreated++;
                    }
                    log.push(`${add.length} customers (${apiCreated} synced to ERP)`);
                }

                // Suppliers
                setPct(58);
                const sr = db.exec("SELECT aname, address, phone, email_id FROM account_detail WHERE a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%'");
                if (sr[0]?.values?.length) {
                    const ex: any[] = JSON.parse(localStorage.getItem(SK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = sr[0].values
                        .map((r: any[], i: number) => ({ id: `S${Date.now()}${i}`, name: r[0] || '', address: r[1] || '', phone: r[2] || '', src: 'Soltol DB' }))
                        .filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(SK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} suppliers`);
                }

                // Products
                setPct(70);
                const pr = db.exec("SELECT item, units_name, sku, item_desc FROM item_measure WHERE item IS NOT NULL AND TRIM(item) != ''");
                if (pr[0]?.values?.length) {
                    const ex: any[] = JSON.parse(localStorage.getItem(PK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = pr[0].values
                        .map((r: any[], i: number) => ({
                            id: `P${Date.now()}${i}`, name: r[0] || '', sku: r[2] || '', description: r[1] || '',
                            category: 'Imported', pricing: { sellingPrice: 0, purchasePriceExWorks: 0 },
                            locations: [{ name: 'Main Warehouse', currentStock: 0 }], src: 'Soltol DB'
                        }))
                        .filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(PK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} products`);
                }

                // Transactions
                setPct(85);
                const tr = db.exec("SELECT v_id, amount, date, narration, v_type, vch_no FROM vouchers WHERE v_type IN ('Sales','Receipt','Purchase','Sales Return','Payment','Journal') LIMIT 2000");
                if (tr[0]?.values?.length) {
                    const ex: any[] = JSON.parse(localStorage.getItem(IK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.vno));
                    const add = tr[0].values
                        .map((r: any[]) => ({ id: `I${r[0]}`, vno: r[5] || `I${r[0]}`, amount: r[1] || 0, date: r[2] || '', type: r[4] || '', note: r[3] || '', src: 'Soltol DB' }))
                        .filter((x: any) => !exN.has(x.vno));
                    localStorage.setItem(IK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} transactions`);
                }

                db.close();

            } else if (ext === 'csv') {
                setPct(40);
                const text = await file.text();
                const rows = text.split(/\r?\n/).filter(l => l.trim());
                if (rows.length < 2) throw new Error('CSV is empty — needs at least a header row and one data row');
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                const nameF = headers.find(h => h === 'name' || h.includes('company') || h.includes('customer') || h.includes('account')) || headers[0];
                const emailF = headers.find(h => h.includes('email')) || '';
                const phoneF = headers.find(h => h.includes('phone') || h.includes('mobile')) || '';
                const addrF  = headers.find(h => h.includes('address') || h.includes('street')) || '';

                setPct(70);
                const parsed = rows.slice(1).map((l, i) => {
                    const v = l.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
                    return { id: `CSV${Date.now()}${i}`, name: v[headers.indexOf(nameF)] || '', email: emailF ? v[headers.indexOf(emailF)] || '' : '', phone: phoneF ? v[headers.indexOf(phoneF)] || '' : '', address: addrF ? v[headers.indexOf(addrF)] || '' : '', src: `CSV: ${file.name}` };
                }).filter(x => x.name);

                const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                const add = parsed.filter((x: any) => !exN.has(x.name.toLowerCase()));
                localStorage.setItem(CK, JSON.stringify([...ex, ...add]));
                log.push(`${add.length} records`);

            } else if (ext === 'xlsx' || ext === 'xls') {
                throw new Error('Excel files: please open in Excel/Google Sheets, File → Save As → CSV (.csv), then upload the CSV here');
            } else if (ext === 'iif') {
                const text = await file.text();
                const lines = text.split(/\r?\n/);
                let headers: string[] = [];
                const customers: any[] = [];
                setPct(40);
                lines.forEach(line => {
                    if (line.startsWith('!CUST')) { headers = line.split('\t').map(h => h.slice(1)); return; }
                    if (line.startsWith('CUST')) {
                        const v = line.split('\t');
                        const obj: any = {};
                        headers.forEach((h, i) => obj[h] = v[i] || '');
                        if (obj.NAME) customers.push(obj);
                    }
                });
                if (customers.length) {
                    const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = customers.map((c, i) => ({ id: `IIF${Date.now()}${i}`, name: c.NAME || '', email: c.EMAIL || '', phone: c.PHONE1 || '', address: c.ADDR1 || '', src: 'QuickBooks IIF' })).filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(CK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} customers`);
                }
            } else if (ext === 'xml') {
                const text = await file.text();
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'application/xml');
                const nodes = xml.querySelectorAll('Customer, Account, Party, Contact');
                const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                const add: any[] = [];
                nodes.forEach((n, i) => {
                    const name = n.querySelector('Name, CompanyName, FullName, AccountName')?.textContent?.trim() || '';
                    if (name && !exN.has(name.toLowerCase())) {
                        add.push({ id: `XML${Date.now()}${i}`, name, email: n.querySelector('Email, EmailAddress')?.textContent?.trim() || '', phone: n.querySelector('Phone, PhoneNumber, Telephone')?.textContent?.trim() || '', src: 'XML Export' });
                    }
                });
                if (add.length) { localStorage.setItem(CK, JSON.stringify([...ex, ...add])); log.push(`${add.length} records`); }
            }

            setPct(100);
            const total = log.reduce((s, l) => s + (parseInt(l) || 0), 0);

            // Save history
            const hist = JSON.parse(localStorage.getItem(HK) || '[]');
            hist.unshift({ file: file.name, imported: total, detail: log.join(' · '), ts: new Date().toISOString() });
            localStorage.setItem(HK, JSON.stringify(hist.slice(0, 20)));

            setCounts({ c: getCount(CK), s: getCount(SK), p: getCount(PK), i: getCount(IK) });

            if (total > 0) {
                setResult({ ok: true, msg: `✅ ${log.join(' · ')} imported! View in Customers, Products, Suppliers.` });
            } else {
                setResult({ ok: false, msg: 'File read OK but no new records found. All records may already exist.' });
            }
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setBusy(false);
        }
    };

    const downloadTemplate = () => {
        const csv = 'Name,Email,Phone,Address,City,State,ZIP\nJohn Auto Shop,john@test.com,555-0001,123 Main St,New York,NY,10001\nFleet Service Inc,fleet@test.com,555-0002,456 Oak Ave,Brooklyn,NY,11201\n';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'soltol_import_template.csv';
        a.click();
    };

    return (
        <div className="max-w-3xl mx-auto px-4 pb-16 pt-4 space-y-6 animate-in fade-in duration-300">

            {/* Header */}
            <div className="rounded-2xl bg-gray-900 text-white p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Database size={24} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">📥 Data Migration</h1>
                        <p className="text-gray-400 text-sm mt-0.5">Import all your data from your old ERP in one click</p>
                    </div>
                </div>
            </div>

            {/* Import stats */}
            <div className="grid grid-cols-4 gap-3">
                {[['👥', 'Customers', counts.c], ['🏭', 'Suppliers', counts.s], ['📦', 'Products', counts.p], ['📄', 'Transactions', counts.i]].map(([icon, label, count]) => (
                    <div key={label as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                        <div className="text-2xl mb-1">{icon}</div>
                        <p className="text-2xl font-black text-gray-900">{count}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Step 1 — Source */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 1 — Where is your data coming from?</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SOURCES.map(s => (
                        <button key={s.id} onClick={() => { setSel(s.id); setFile(null); setResult(null); }}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${sel === s.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                            <span className="text-2xl flex-shrink-0">{s.icon}</span>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{s.name}</p>
                                <p className="text-[10px] text-gray-400">{s.fmt.replace(/,/g, ' ')}</p>
                            </div>
                            {sel === s.id && <CheckCircle size={14} className="text-gray-900 ml-auto flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2 — Instructions */}
            <div className={`rounded-2xl border p-5 ${src.color}`}>
                <p className="text-xs font-black uppercase tracking-widest mb-3">Step 2 — How to export from {src.name}</p>
                <ol className="space-y-2">
                    {src.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                            <span className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Step 3 — Upload */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 3 — Upload your file</p>
                <div
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
                    onClick={() => document.getElementById('mig-input')?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                        ${drag ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-input" type="file" accept={src.fmt} className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
                    {file ? (
                        <div>
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-base font-black text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB · Ready to import</p>
                            <button onClick={e => { e.stopPropagation(); setFile(null); }}
                                className="mt-3 text-xs text-red-400 hover:text-red-600 font-bold px-3 py-1 border border-red-200 rounded-lg">
                                ✕ Remove file
                            </button>
                        </div>
                    ) : (
                        <div>
                            <Upload size={40} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-base font-black text-gray-600">Drop your file here</p>
                            <p className="text-sm text-gray-400 mt-1">or click to browse your computer</p>
                            <p className="text-xs text-gray-300 mt-3 bg-gray-100 inline-block px-3 py-1 rounded-full">
                                Accepted: {src.fmt.replace(/,/g, '  ')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress */}
            {busy && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <RefreshCw size={18} className="animate-spin text-blue-500" />
                        <span className="text-sm font-black text-gray-700">Importing your data... {pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Please wait — do not close this page</p>
                </div>
            )}

            {/* Result */}
            {result && !busy && (
                <div className={`rounded-2xl border p-5 flex items-start gap-4 ${result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    {result.ok
                        ? <CheckCircle size={24} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        : <AlertCircle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                    <div>
                        <p className={`text-sm font-black ${result.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {result.ok ? 'Import Complete!' : 'Import Notice'}
                        </p>
                        <p className={`text-sm mt-1 ${result.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{result.msg}</p>
                    </div>
                </div>
            )}

            {/* Import Button */}
            <button
                onClick={doImport}
                disabled={!file || busy}
                className="w-full py-5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all shadow-md flex items-center justify-center gap-3">
                {busy
                    ? <><RefreshCw size={20} className="animate-spin" /> Importing — please wait...</>
                    : <><Upload size={20} /> Import from {src.name}</>
                }
            </button>

            {/* Template download */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-sm font-black text-gray-800">📋 No file? Use our CSV template</p>
                    <p className="text-xs text-gray-500 mt-0.5">Download, fill in your customers/products data, then upload above</p>
                </div>
                <button onClick={downloadTemplate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-black hover:bg-gray-100 transition-all">
                    <Download size={14} /> Download Template
                </button>
            </div>

        </div>
    );
}
