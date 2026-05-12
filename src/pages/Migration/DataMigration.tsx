import { useState } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, RefreshCw, Download, Trash2 } from 'lucide-react';

const API_BASE = ((import.meta.env.VITE_API_URL as string) || 'https://bettano-erp-backend.onrender.com').replace(/\/$/, '');
const CK = 'bettano_customers_imported';
const SK = 'bettano_suppliers_imported';
const PK = 'bettano_imported_products';
const IK = 'bettano_invoices_imported';

const SOURCES = [
    { id:'soltol_db',  icon:'🗄️', name:'Soltol / Bettano .db',  fmt:'.db,.sqlite',
      steps:['Open your old Soltol/Bettano ERP software','Go to Settings → Backup → Export Database','Save the .db file to your computer','Upload it here — all data imports automatically'] },
    { id:'quickbooks', icon:'📊', name:'QuickBooks',              fmt:'.csv,.iif,.xlsx',
      steps:['QuickBooks → File → Utilities → Export → Lists to IIF','Or: Reports → any report → Export to CSV','Upload here'] },
    { id:'dynamics',   icon:'🔷', name:'MS Dynamics 365',        fmt:'.csv,.xlsx,.xml',
      steps:['Dynamics → Settings → Data Management → Export Data','Select entities and download CSV','Upload here'] },
    { id:'netsuite',   icon:'🔴', name:'Oracle NetSuite',        fmt:'.csv,.xlsx',
      steps:['NetSuite → Reports → Saved Searches → Export CSV','Upload here'] },
    { id:'cin7',       icon:'📦', name:'Cin7 Core / DEAR',       fmt:'.csv,.xlsx',
      steps:['Cin7 → Settings → Data Export → Select modules → Export','Upload here'] },
    { id:'csv',        icon:'📋', name:'Generic CSV / Excel',    fmt:'.csv,.xlsx,.xls',
      steps:['Download our template below','Fill in your data','Upload here'] },
];

function getCount(k: string) { try { return JSON.parse(localStorage.getItem(k)||'[]').length; } catch { return 0; } }

export default function DataMigration() {
    const [sel, setSel]       = useState('soltol_db');
    const [file, setFile]     = useState<File|null>(null);
    const [drag, setDrag]     = useState(false);
    const [busy, setBusy]     = useState(false);
    const [pct, setPct]       = useState(0);
    const [step, setStep]     = useState('');
    const [result, setResult] = useState<{ok:boolean; lines:string[]}|null>(null);
    const [counts, setCounts] = useState({ c:getCount(CK), s:getCount(SK), p:getCount(PK), i:getCount(IK) });

    const src = SOURCES.find(s => s.id === sel)!;
    const refresh = () => setCounts({ c:getCount(CK), s:getCount(SK), p:getCount(PK), i:getCount(IK) });

    // ── CLEAR ALL CUSTOMERS FROM ERP ─────────────────────────
    const clearAll = async () => {
        const yes = window.confirm(
            '⚠️ CLEAR ALL CUSTOMERS?\n\nThis will:\n• Delete ALL customers from the ERP customer list\n• Clear all imported records\n\n⚠️ This will NOT touch:\n• Chart of Accounts\n• Journal Vouchers\n• Banking records\n• Invoices\n• Any accounting data\n\nClick OK to continue.'
        );
        if (!yes) return;

        setBusy(true); setPct(10); setStep('Clearing customer list...');
        const log: string[] = [];

        try {
            // 1. Clear from backend API (bulk delete)
            const clearRes = await fetch(`${API_BASE}/api/customers/bulk/clear-all`, { method: 'DELETE' });
            if (clearRes.ok) {
                const data = await clearRes.json();
                log.push(`✅ Removed ${data.deleted} customers from ERP`);
            } else {
                // Fallback: delete one by one
                setStep('Fetching customer list...');
                setPct(20);
                const getRes = await fetch(`${API_BASE}/customers/`);
                if (getRes.ok) {
                    const customers = await getRes.json();
                    log.push(`Found ${customers.length} customers to delete`);
                    let deleted = 0;
                    for (const c of customers) {
                        await fetch(`${API_BASE}/customers/${c.id}`, { method: 'DELETE' });
                        deleted++;
                        setPct(20 + Math.round((deleted / customers.length) * 60));
                        setStep(`Deleting ${deleted}/${customers.length}...`);
                    }
                    log.push(`✅ Deleted ${deleted} customers from ERP`);
                }
            }

            // 2. Clear localStorage
            setPct(85); setStep('Clearing local data...');
            [CK, SK, PK, IK, 'soltol_import_history'].forEach(k => localStorage.removeItem(k));
            log.push('✅ Local imported data cleared');

            setPct(100); setStep('Done');
            refresh();
            setFile(null);
            setResult({ ok: true, lines: [...log, '', '✅ ERP is clean — ready for fresh import', 'Upload your .db file below and click Import'] });
        } catch (e: any) {
            setResult({ ok: false, lines: [`❌ Error: ${e.message}`] });
        } finally {
            setBusy(false); setStep('');
        }
    };

    // ── IMPORT ───────────────────────────────────────────────
    const doImport = async () => {
        if (!file) return;
        setBusy(true); setPct(5); setStep('Reading file...'); setResult(null);
        const log: string[] = [];

        try {
            const ext = file.name.toLowerCase().split('.').pop() || '';

            if (ext === 'db' || ext === 'sqlite') {
                // Load SQL.js from CDN
                setStep('Loading database engine...');
                const initSqlJs: any = await new Promise((res) => {
                    if ((window as any).initSqlJs) { res((window as any).initSqlJs); return; }
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
                    s.onload = () => setTimeout(() => res((window as any).initSqlJs), 600);
                    s.onerror = () => res(null);
                    document.head.appendChild(s);
                });
                if (!initSqlJs) throw new Error('SQL.js library could not load. Check your internet connection and try again.');

                setStep('Opening database...'); setPct(20);
                const buf = await file.arrayBuffer();
                const SQL = await initSqlJs({ locateFile: (fn: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${fn}` });
                const db = new SQL.Database(new Uint8Array(buf));

                // ── Calculate balances per customer from vouchers ──
                setStep('Calculating customer balances...'); setPct(30);
                const balRes = db.exec(`
                    SELECT debit,
                        SUM(CASE WHEN v_type='Sales' THEN amount ELSE 0 END) -
                        SUM(CASE WHEN v_type='Receipt' THEN amount ELSE 0 END) as balance
                    FROM vouchers WHERE v_type IN ('Sales','Receipt')
                    GROUP BY debit
                `);
                const balMap: Record<string, number> = {};
                if (balRes[0]) {
                    balRes[0].values.forEach((r: any[]) => {
                        if (r[0]) balMap[String(r[0]).trim()] = Math.round((Number(r[1])||0)*100)/100;
                    });
                }

                // ── Import Customers ──
                setStep('Importing customers...'); setPct(40);
                const cr = db.exec(`
                    SELECT aname, address, phone, email_id, op_bal, credit_limit, credit_period
                    FROM account_detail
                    WHERE (a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%') AND status=1
                `);

                if (cr[0]?.values?.length) {
                    const total = cr[0].values.length;
                    let apiOk = 0;
                    const localList: any[] = [];

                    for (let i = 0; i < total; i++) {
                        const r = cr[0].values[i] as any[];
                        const name = String(r[0]||'').trim();
                        if (!name) continue;

                        const balance = balMap[name] ?? (Number(r[4])||0);
                        const payload = {
                            name,
                            address: String(r[1]||''),
                            phone: String(r[2]||''),
                            email: String(r[3]||''),
                            opening_balance: Number(r[4])||0,
                            balance: balance,
                            credit_limit: Number(r[5])||0,
                            category: 'Customer',
                            notes: `Imported from Soltol DB | Balance: $${balance.toFixed(2)}`
                        };

                        // POST to backend API
                        try {
                            const res = await fetch(`${API_BASE}/customers/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (res.ok) { apiOk++; }
                        } catch { /* continue */ }

                        localList.push({ ...payload, id: `IMP-C-${i}` });

                        // Update progress
                        const progress = 40 + Math.round((i / total) * 35);
                        if (i % 10 === 0) {
                            setPct(progress);
                            setStep(`Importing customers ${i+1}/${total}...`);
                        }
                    }

                    localStorage.setItem(CK, JSON.stringify(localList));
                    log.push(`✅ ${total} customers imported — ${apiOk} added to ERP with balances`);
                }

                // ── Import Suppliers ──
                setStep('Importing suppliers...'); setPct(78);
                const sr = db.exec(`
                    SELECT aname, address, phone, email_id
                    FROM account_detail
                    WHERE (a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%') AND status=1
                `);
                if (sr[0]?.values?.length) {
                    const added = sr[0].values
                        .map((r:any[], i:number) => ({ id:`IMP-S-${i}`, name:String(r[0]||'').trim(), address:String(r[1]||''), phone:String(r[2]||''), email:String(r[3]||'') }))
                        .filter((x:any) => x.name);
                    localStorage.setItem(SK, JSON.stringify(added));
                    log.push(`✅ ${added.length} suppliers imported`);
                }

                // ── Import Products ──
                setStep('Importing products...'); setPct(85);
                const pr = db.exec(`
                    SELECT item, units_name, sku, item_desc FROM item_measure
                    WHERE item IS NOT NULL AND TRIM(item) != ''
                `);
                if (pr[0]?.values?.length) {
                    const added = pr[0].values
                        .map((r:any[], i:number) => ({ id:`IMP-P-${i}`, name:String(r[0]||'').trim(), sku:String(r[2]||''), description:String(r[1]||''), category:'Imported', pricing:{sellingPrice:0,purchasePriceExWorks:0}, locations:[{name:'Main Warehouse',currentStock:0}] }))
                        .filter((x:any) => x.name);
                    localStorage.setItem(PK, JSON.stringify(added));
                    log.push(`✅ ${added.length} products imported`);
                }

                // ── Import Transactions ──
                setStep('Importing transactions...'); setPct(92);
                const tr = db.exec(`
                    SELECT v_id, amount, date, narration, v_type, vch_no, debit
                    FROM vouchers
                    WHERE v_type IN ('Sales','Receipt','Purchase','Sales Return','Payment','Journal')
                    LIMIT 2000
                `);
                if (tr[0]?.values?.length) {
                    const added = tr[0].values.map((r:any[]) => ({ id:`IMP-I-${r[0]}`, vno:String(r[5]||`I-${r[0]}`), amount:Number(r[1])||0, date:String(r[2]||''), type:String(r[4]||''), note:String(r[3]||''), customer:String(r[6]||'') }));
                    localStorage.setItem(IK, JSON.stringify(added));
                    log.push(`✅ ${added.length} transactions imported`);
                }

                db.close();

            } else if (ext === 'csv') {
                setStep('Reading CSV...'); setPct(30);
                const text = await file.text();
                const rows = text.split(/\r?\n/).filter(l => l.trim());
                if (rows.length < 2) throw new Error('CSV file is empty — needs a header row and at least one data row');
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                const nf = headers.find(h => h==='name'||h.includes('company')||h.includes('customer')) || headers[0];
                const ef = headers.find(h => h.includes('email')) || '';
                const pf = headers.find(h => h.includes('phone')||h.includes('mobile')) || '';
                const af = headers.find(h => h.includes('address')||h.includes('street')) || '';

                const parsed = rows.slice(1).map((l) => {
                    const v = l.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
                    return { name:v[headers.indexOf(nf)]||'', email:ef?v[headers.indexOf(ef)]||'':'', phone:pf?v[headers.indexOf(pf)]||'':'', address:af?v[headers.indexOf(af)]||'':'', balance:0, category:'Customer', notes:'Imported from CSV' };
                }).filter(x => x.name);

                setStep('Syncing to ERP...'); setPct(60);
                let synced = 0;
                for (const c of parsed) {
                    try {
                        const r = await fetch(`${API_BASE}/customers/`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(c) });
                        if (r.ok) synced++;
                    } catch { /* continue */ }
                }
                localStorage.setItem(CK, JSON.stringify(parsed));
                log.push(`✅ ${parsed.length} customers imported (${synced} synced to ERP)`);

            } else {
                throw new Error(`Format .${ext} not directly supported. For Excel: File → Save As → CSV (.csv), then upload the CSV file.`);
            }

            setPct(100); setStep('Done!');
            refresh();
            setResult({ ok: true, lines: [...log, '', '→ Go to Customers page to see your imported data with balances'] });

        } catch (e: any) {
            setResult({ ok: false, lines: [`❌ ${e.message}`] });
        } finally {
            setBusy(false); setStep('');
        }
    };

    const downloadTemplate = () => {
        const csv = 'Name,Email,Phone,Address,City,State,Balance\nJohn Auto Shop,john@test.com,555-0001,123 Main St,New York,NY,1500\n';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
        a.download = 'soltol_customers_template.csv';
        a.click();
    };

    return (
        <div className="max-w-3xl mx-auto px-4 pb-16 pt-4 space-y-5 animate-in fade-in duration-300">

            {/* Header */}
            <div className="rounded-2xl bg-gray-900 text-white p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Database size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">📥 Data Migration</h1>
                            <p className="text-gray-400 text-sm mt-0.5">Import your existing ERP data into SOLTOL ONE</p>
                        </div>
                    </div>
                    {/* CLEAR BUTTON */}
                    <button onClick={clearAll} disabled={busy}
                        className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                        <Trash2 size={16} /> Clear All Customers
                    </button>
                </div>
                <div className="mt-3 bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-300 text-xs font-bold">
                    ⚠️ "Clear All Customers" removes customers only — does NOT touch accounts, invoices or accounting records
                </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-4 gap-3">
                {[['👥','Customers',counts.c],['🏭','Suppliers',counts.s],['📦','Products',counts.p],['📄','Transactions',counts.i]].map(([icon,label,count]) => (
                    <div key={label as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                        <div className="text-2xl mb-1">{icon}</div>
                        <p className={`text-2xl font-black ${Number(count)>0?'text-gray-900':'text-gray-300'}`}>{count}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Source picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 1 — Your previous software</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SOURCES.map(s => (
                        <button key={s.id} onClick={() => { setSel(s.id); setFile(null); setResult(null); }}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${sel===s.id?'border-gray-900 bg-gray-50':'border-gray-100 bg-white hover:border-gray-300'}`}>
                            <span className="text-xl flex-shrink-0">{s.icon}</span>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{s.name}</p>
                                <p className="text-[10px] text-gray-400">{s.fmt.replace(/,/g,' ')}</p>
                            </div>
                            {sel===s.id && <CheckCircle size={12} className="text-gray-900 ml-auto flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Step 2 — How to get your file from {src.name}</p>
                <ol className="space-y-2">
                    {src.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-blue-800">
                            <span className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-black flex-shrink-0">{i+1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Drop zone */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Step 3 — Upload your file</p>
                <div
                    onDragOver={e=>{e.preventDefault();setDrag(true);}}
                    onDragLeave={()=>setDrag(false)}
                    onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f){setFile(f);setResult(null);}}}
                    onClick={()=>document.getElementById('mig-file')?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${drag?'border-blue-400 bg-blue-50':file?'border-emerald-400 bg-emerald-50':'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <input id="mig-file" type="file" accept={src.fmt} className="hidden"
                        onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setResult(null);}}} />
                    {file ? (
                        <>
                            <div className="text-4xl mb-2">✅</div>
                            <p className="text-base font-black text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-400 mt-1">{(file.size/1024).toFixed(1)} KB · Ready</p>
                            <button onClick={e=>{e.stopPropagation();setFile(null);}} className="mt-2 text-xs text-red-400 font-bold">✕ Remove</button>
                        </>
                    ) : (
                        <>
                            <Upload size={36} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-black text-gray-600">Drop file here or click to browse</p>
                            <p className="text-xs text-gray-400 mt-1">Accepted: {src.fmt.replace(/,/g,' · ')}</p>
                        </>
                    )}
                </div>
            </div>

            {/* Progress */}
            {busy && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <RefreshCw size={16} className="animate-spin text-orange-500 flex-shrink-0" />
                        <span className="text-sm font-black text-gray-700">{step || 'Working...'} {pct}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500" style={{width:`${pct}%`}} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Please wait — do not close this tab</p>
                </div>
            )}

            {/* Result */}
            {result && !busy && (
                <div className={`rounded-2xl border p-5 ${result.ok?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
                    <div className="flex gap-3">
                        {result.ok ? <CheckCircle size={22} className="text-emerald-600 flex-shrink-0 mt-0.5"/> : <AlertCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5"/>}
                        <div className="space-y-1">
                            {result.lines.map((line, i) => (
                                line ? <p key={i} className={`text-sm ${result.ok?'text-emerald-800':'text-red-700'} ${i===0?'font-black':'font-medium'}`}>{line}</p>
                                     : <div key={i} className="h-1"/>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Import button */}
            <button onClick={doImport} disabled={!file||busy}
                className="w-full py-5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3">
                {busy ? <><RefreshCw size={20} className="animate-spin"/> Importing — please wait...</> : <><Upload size={20}/> Import from {src.name}</>}
            </button>

            {/* Template */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex-wrap gap-3">
                <div>
                    <p className="text-sm font-black text-gray-800">📋 Need a CSV template?</p>
                    <p className="text-xs text-gray-500 mt-0.5">Download, fill in your data, upload above</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-700 hover:bg-gray-100 transition-all">
                    <Download size={12}/> Download Template
                </button>
            </div>
        </div>
    );
}
