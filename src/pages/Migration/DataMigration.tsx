import { useState } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, RefreshCw, Download, Trash2 } from 'lucide-react';

const CK = 'bettano_customers_imported';
const SK = 'bettano_suppliers_imported';
const PK = 'bettano_imported_products';
const IK = 'bettano_invoices_imported';
const HK = 'soltol_import_history';

const API_BASE = ((import.meta.env.VITE_API_URL as string) || 'https://bettano-erp-backend.onrender.com').replace(/\/$/, '');

const SOURCES = [
    { id:'soltol_db',  icon:'🗄️', name:'Soltol / Bettano .db',  fmt:'.db,.sqlite',
      steps:['Open your old Soltol/Bettano ERP','Go to Settings → Backup → Export Database','Save the .db file','Upload it here — everything transfers automatically'] },
    { id:'quickbooks', icon:'📊', name:'QuickBooks',              fmt:'.csv,.iif,.xlsx',
      steps:['QuickBooks → File → Utilities → Export → Lists to IIF Files','For customers: Lists → Customer List → Export','For invoices: Reports → Sales → Export to CSV','Upload here'] },
    { id:'dynamics',   icon:'🔷', name:'MS Dynamics 365',        fmt:'.csv,.xlsx,.xml',
      steps:['Dynamics → Settings → Data Management → Export Data','Select: Accounts, Products, Invoices','Choose CSV format','Upload here'] },
    { id:'netsuite',   icon:'🔴', name:'Oracle NetSuite',        fmt:'.csv,.xlsx',
      steps:['NetSuite → Reports → Saved Searches','Create search for Customers or Items','Export → CSV','Upload here'] },
    { id:'cin7',       icon:'📦', name:'Cin7 Core / DEAR',       fmt:'.csv,.xlsx',
      steps:['Cin7 → Settings → Data Export','Select: Customers, Products, Sales','Export as CSV','Upload here'] },
    { id:'csv',        icon:'📋', name:'Generic CSV / Excel',    fmt:'.csv,.xlsx,.xls',
      steps:['Download the CSV template below','Fill in your data','Save as CSV','Upload here'] },
];

function getCount(k: string) { try { return JSON.parse(localStorage.getItem(k) || '[]').length; } catch { return 0; } }

export default function DataMigration() {
    const [sel, setSel]       = useState('soltol_db');
    const [file, setFile]     = useState<File | null>(null);
    const [drag, setDrag]     = useState(false);
    const [busy, setBusy]     = useState(false);
    const [pct, setPct]       = useState(0);
    const [result, setResult] = useState<{ok:boolean; lines:string[]} | null>(null);
    const [counts, setCounts] = useState({ c:getCount(CK), s:getCount(SK), p:getCount(PK), i:getCount(IK) });

    const src = SOURCES.find(s => s.id === sel)!;

    const refreshCounts = () => setCounts({ c:getCount(CK), s:getCount(SK), p:getCount(PK), i:getCount(IK) });

    // ── CLEAR ALL IMPORTED DATA ──────────────────────────────
    const clearAll = async () => {
        if (!window.confirm('⚠️ This will DELETE all imported customers, suppliers, products and transactions from the ERP.\n\nAre you sure? This cannot be undone.')) return;

        // Clear localStorage
        [CK, SK, PK, IK, HK].forEach(k => localStorage.removeItem(k));

        // Clear from backend API
        setBusy(true);
        setPct(20);
        try {
            // Delete all customers from backend that were imported
            const res = await fetch(`${API_BASE}/customers/`, { headers: { 'Content-Type': 'application/json' } });
            if (res.ok) {
                const customers = await res.json();
                const importedOnes = customers.filter((c: any) => c.notes?.includes('Imported from') || c.category === 'Imported');
                setPct(40);
                let deleted = 0;
                for (const c of importedOnes) {
                    await fetch(`${API_BASE}/customers/${c.id}`, { method: 'DELETE' });
                    deleted++;
                }
                setPct(100);
                refreshCounts();
                setFile(null);
                setResult({ ok: true, lines: [`✅ Cleared ${deleted} imported customers from ERP`, `✅ Cleared all local imported data`, `Ready for fresh import`] });
            }
        } catch {
            // Even if API fails, localStorage is cleared
            refreshCounts();
            setResult({ ok: true, lines: ['✅ Local imported data cleared', 'Note: Backend may need manual cleanup', 'Ready for fresh import'] });
        } finally {
            setBusy(false);
            setPct(0);
        }
    };

    // ── MAIN IMPORT ──────────────────────────────────────────
    const doImport = async () => {
        if (!file) return;
        setBusy(true); setPct(5); setResult(null);
        const log: string[] = [];

        try {
            const ext = file.name.toLowerCase().split('.').pop() || '';

            if (ext === 'db' || ext === 'sqlite') {
                // Load SQL.js
                setPct(15);
                const initSqlJs: any = await new Promise((res) => {
                    if ((window as any).initSqlJs) { res((window as any).initSqlJs); return; }
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
                    s.onload = () => setTimeout(() => res((window as any).initSqlJs), 500);
                    s.onerror = () => res(null);
                    document.head.appendChild(s);
                });
                if (!initSqlJs) throw new Error('SQL.js failed to load — check internet and try again');

                setPct(25);
                const buf = await file.arrayBuffer();
                const SQL = await initSqlJs({ locateFile: (fn: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${fn}` });
                const db = new SQL.Database(new Uint8Array(buf));

                // ── Get customer balances from vouchers ──
                setPct(35);
                const balRes = db.exec(`
                    SELECT debit,
                        SUM(CASE WHEN v_type='Sales' THEN amount ELSE 0 END) -
                        SUM(CASE WHEN v_type='Receipt' THEN amount ELSE 0 END) as balance
                    FROM vouchers
                    WHERE v_type IN ('Sales','Receipt')
                    GROUP BY debit
                `);
                const balMap: Record<string, number> = {};
                if (balRes[0]) {
                    balRes[0].values.forEach((r: any[]) => {
                        if (r[0]) balMap[String(r[0]).trim()] = Math.round((Number(r[1]) || 0) * 100) / 100;
                    });
                }

                // ── Import Customers ──
                setPct(45);
                const cr = db.exec(`SELECT aname, address, phone, email_id, op_bal, credit_limit, credit_period FROM account_detail WHERE (a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%') AND status=1`);
                if (cr[0]?.values?.length) {
                    const added: any[] = [];
                    let apiSynced = 0;
                    for (let i = 0; i < cr[0].values.length; i++) {
                        const r = cr[0].values[i] as any[];
                        const name = (r[0] || '').trim();
                        if (!name) continue;
                        const balance = balMap[name] ?? (Number(r[4]) || 0);
                        const cust = {
                            id: `IMP-C-${Date.now()}-${i}`,
                            name,
                            address: r[1] || '',
                            phone: r[2] || '',
                            email: r[3] || '',
                            opening_balance: Number(r[4]) || 0,
                            balance: balance,
                            credit_limit: Number(r[5]) || 0,
                            credit_period: Number(r[6]) || 30,
                            category: 'Imported',
                            notes: `Imported from Soltol DB`,
                            src: 'Soltol DB'
                        };
                        added.push(cust);
                        // Sync to backend API
                        try {
                            const res = await fetch(`${API_BASE}/customers`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: cust.name,
                                    email: cust.email,
                                    phone: cust.phone,
                                    address: cust.address,
                                    balance: cust.balance,
                                    opening_balance: cust.opening_balance,
                                    credit_limit: cust.credit_limit,
                                    category: 'Imported',
                                    notes: 'Imported from Soltol DB'
                                })
                            });
                            if (res.ok) apiSynced++;
                        } catch { /* continue */ }
                    }
                    localStorage.setItem(CK, JSON.stringify(added));
                    log.push(`✅ ${added.length} customers imported (${apiSynced} synced to ERP with balances)`);
                }

                // ── Import Suppliers ──
                setPct(60);
                const sr = db.exec(`SELECT aname, address, phone, email_id FROM account_detail WHERE (a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%') AND status=1`);
                if (sr[0]?.values?.length) {
                    const added = sr[0].values.map((r: any[], i: number) => ({
                        id: `IMP-S-${Date.now()}-${i}`, name: (r[0]||'').trim(), address: r[1]||'', phone: r[2]||'', email: r[3]||'', src: 'Soltol DB'
                    })).filter((x: any) => x.name);
                    localStorage.setItem(SK, JSON.stringify(added));
                    log.push(`✅ ${added.length} suppliers imported`);
                }

                // ── Import Products ──
                setPct(72);
                const pr = db.exec(`SELECT item, units_name, sku, item_desc FROM item_measure WHERE item IS NOT NULL AND TRIM(item) != ''`);
                if (pr[0]?.values?.length) {
                    const added = pr[0].values.map((r: any[], i: number) => ({
                        id: `IMP-P-${Date.now()}-${i}`,
                        name: (r[0]||'').trim(), sku: r[2]||'', description: r[1]||'',
                        category: 'Imported',
                        pricing: { sellingPrice: 0, purchasePriceExWorks: 0 },
                        locations: [{ name: 'Main Warehouse', currentStock: 0 }],
                        src: 'Soltol DB'
                    })).filter((x: any) => x.name);
                    localStorage.setItem(PK, JSON.stringify(added));
                    log.push(`✅ ${added.length} products imported`);
                }

                // ── Import Transactions ──
                setPct(85);
                const tr = db.exec(`SELECT v_id, amount, date, narration, v_type, vch_no, debit, credit FROM vouchers WHERE v_type IN ('Sales','Receipt','Purchase','Sales Return','Payment','Journal') LIMIT 2000`);
                if (tr[0]?.values?.length) {
                    const added = tr[0].values.map((r: any[]) => ({
                        id: `IMP-I-${r[0]}`, vno: r[5]||`I-${r[0]}`, amount: Number(r[1])||0,
                        date: r[2]||'', type: r[4]||'', note: r[3]||'', debit: r[6]||'', credit: r[7]||'', src: 'Soltol DB'
                    }));
                    localStorage.setItem(IK, JSON.stringify(added));
                    log.push(`✅ ${added.length} transactions imported`);
                }

                db.close();

                // Save history
                const hist = JSON.parse(localStorage.getItem(HK) || '[]');
                hist.unshift({ file: file.name, imported: log.length, detail: log.join(' | '), ts: new Date().toISOString() });
                localStorage.setItem(HK, JSON.stringify(hist.slice(0, 20)));

            } else if (ext === 'csv') {
                setPct(40);
                const text = await file.text();
                const rows = text.split(/\r?\n/).filter(l => l.trim());
                if (rows.length < 2) throw new Error('CSV is empty — needs header row + data rows');
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                const nameF = headers.find(h => h === 'name' || h.includes('company') || h.includes('customer')) || headers[0];
                const emailF = headers.find(h => h.includes('email')) || '';
                const phoneF = headers.find(h => h.includes('phone') || h.includes('mobile')) || '';
                const addrF  = headers.find(h => h.includes('address') || h.includes('street')) || '';

                setPct(70);
                const parsed = rows.slice(1).map((l, i) => {
                    const v = l.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
                    return { id:`CSV-${Date.now()}-${i}`, name:v[headers.indexOf(nameF)]||'', email:emailF?v[headers.indexOf(emailF)]||'':'', phone:phoneF?v[headers.indexOf(phoneF)]||'':'', address:addrF?v[headers.indexOf(addrF)]||'':'', category:'Imported', notes:'Imported from CSV', src:`CSV: ${file.name}` };
                }).filter(x => x.name);

                let apiSynced = 0;
                for (const c of parsed) {
                    try {
                        const res = await fetch(`${API_BASE}/customers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c) });
                        if (res.ok) apiSynced++;
                    } catch { /* continue */ }
                }
                localStorage.setItem(CK, JSON.stringify(parsed));
                log.push(`✅ ${parsed.length} customers imported (${apiSynced} synced to ERP)`);

            } else if (ext === 'xlsx' || ext === 'xls') {
                throw new Error('Excel: open in Excel → File → Save As → CSV, then upload the .csv file');
            } else if (ext === 'iif') {
                const text = await file.text();
                const lines = text.split(/\r?\n/);
                let headers: string[] = [];
                const customers: any[] = [];
                lines.forEach(line => {
                    if (line.startsWith('!CUST')) { headers = line.split('\t').map(h => h.slice(1)); return; }
                    if (line.startsWith('CUST')) {
                        const v = line.split('\t'); const obj: any = {}; headers.forEach((h, i) => obj[h] = v[i]||'');
                        if (obj.NAME) customers.push(obj);
                    }
                });
                const added = customers.map((c, i) => ({ id:`IIF-${Date.now()}-${i}`, name:c.NAME||'', email:c.EMAIL||'', phone:c.PHONE1||'', address:c.ADDR1||'', src:'QuickBooks IIF' }));
                localStorage.setItem(CK, JSON.stringify(added));
                log.push(`✅ ${added.length} customers from QuickBooks IIF`);
            }

            setPct(100);
            refreshCounts();
            setResult({ ok: log.length > 0, lines: log.length ? log : ['File read OK — no new records found'] });

        } catch (e: any) {
            setResult({ ok: false, lines: [`❌ ${e.message}`] });
        } finally {
            setBusy(false);
        }
    };

    const downloadTemplate = () => {
        const csv = 'Name,Email,Phone,Address,City,State,ZIP\nJohn Auto Shop,john@test.com,555-0001,123 Main St,New York,NY,10001\n';
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='soltol_import_template.csv'; a.click();
    };

    return (
        <div className="max-w-3xl mx-auto px-4 pb-16 pt-4 space-y-5 animate-in fade-in duration-300">

            {/* Header */}
            <div className="rounded-2xl bg-gray-900 text-white p-6 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Database size={24} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">📥 Data Migration</h1>
                        <p className="text-gray-400 text-sm mt-0.5">Import from Soltol DB · QuickBooks · Dynamics · NetSuite · Cin7 · CSV</p>
                    </div>
                </div>
                {/* CLEAR ALL BUTTON */}
                <button onClick={clearAll} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50">
                    <Trash2 size={14} /> Clear All Imported Data
                </button>
            </div>

            {/* Import stats */}
            <div className="grid grid-cols-4 gap-3">
                {[['👥','Customers',counts.c],['🏭','Suppliers',counts.s],['📦','Products',counts.p],['📄','Transactions',counts.i]].map(([icon,label,count]) => (
                    <div key={label as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                        <div className="text-2xl mb-1">{icon}</div>
                        <p className={`text-2xl font-black ${Number(count) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{count}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Step 1 — Source */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 1 — Select your previous software</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SOURCES.map(s => (
                        <button key={s.id} onClick={() => { setSel(s.id); setFile(null); setResult(null); }}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${sel===s.id?'border-gray-900 bg-gray-50':'border-gray-100 bg-white hover:border-gray-200'}`}>
                            <span className="text-2xl flex-shrink-0">{s.icon}</span>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{s.name}</p>
                                <p className="text-[10px] text-gray-400">{s.fmt.replace(/,/g,' ')}</p>
                            </div>
                            {sel===s.id && <CheckCircle size={14} className="text-gray-900 ml-auto flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2 — How to export */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Step 2 — How to export from {src.name}</p>
                <ol className="space-y-2">
                    {src.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-blue-800">
                            <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{i+1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Step 3 — Upload */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 3 — Upload your file</p>
                <div
                    onDragOver={e=>{e.preventDefault();setDrag(true);}}
                    onDragLeave={()=>setDrag(false)}
                    onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f){setFile(f);setResult(null);}}}
                    onClick={()=>document.getElementById('mig-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${drag?'border-blue-400 bg-blue-50':file?'border-emerald-400 bg-emerald-50':'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-input" type="file" accept={src.fmt} className="hidden"
                        onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setResult(null);}}} />
                    {file ? (
                        <>
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-base font-black text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-400 mt-1">{(file.size/1024).toFixed(1)} KB · Ready to import</p>
                            <button onClick={e=>{e.stopPropagation();setFile(null);}} className="mt-3 text-xs text-red-400 font-bold px-3 py-1 border border-red-200 rounded-lg hover:text-red-600">✕ Remove</button>
                        </>
                    ) : (
                        <>
                            <Upload size={40} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-base font-black text-gray-600">Drop your file here or click to browse</p>
                            <p className="text-sm text-gray-400 mt-1">Accepted: {src.fmt.replace(/,/g,'  ')}</p>
                        </>
                    )}
                </div>
            </div>

            {/* Progress */}
            {busy && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <RefreshCw size={18} className="animate-spin text-orange-500" />
                        <span className="text-sm font-black text-gray-700">{pct < 50 ? 'Reading file...' : pct < 80 ? 'Importing records...' : pct < 100 ? 'Syncing to ERP...' : 'Complete!'} {pct}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500" style={{width:`${pct}%`}} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Please wait — do not close this page</p>
                </div>
            )}

            {/* Result */}
            {result && !busy && (
                <div className={`rounded-2xl border p-5 ${result.ok?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                        {result.ok ? <CheckCircle size={22} className="text-emerald-600 flex-shrink-0 mt-0.5"/> : <AlertCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5"/>}
                        <div className="space-y-1">
                            {result.lines.map((line, i) => (
                                <p key={i} className={`text-sm ${result.ok?'text-emerald-800':'text-red-700'} ${i===0?'font-black':'font-medium'}`}>{line}</p>
                            ))}
                        </div>
                    </div>
                    {result.ok && result.lines.some(l=>l.includes('customers')) && (
                        <div className="mt-3 pt-3 border-t border-emerald-200">
                            <p className="text-xs text-emerald-700 font-bold">→ Go to <strong>Customers</strong> to see imported data with balances</p>
                        </div>
                    )}
                </div>
            )}

            {/* Import Button */}
            <button onClick={doImport} disabled={!file||busy}
                className="w-full py-5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all shadow-md flex items-center justify-center gap-3">
                {busy ? <><RefreshCw size={20} className="animate-spin"/> Importing — please wait...</> : <><Upload size={20}/> Import from {src.name}</>}
            </button>

            {/* Template download */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-sm font-black text-gray-800">📋 No file? Download our CSV template</p>
                    <p className="text-xs text-gray-500 mt-0.5">Fill in your data, upload above</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-black hover:bg-gray-100 transition-all">
                    <Download size={14}/> Download Template
                </button>
            </div>
        </div>
    );
}
