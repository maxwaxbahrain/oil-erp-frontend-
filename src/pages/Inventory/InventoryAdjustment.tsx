import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Save, Package, RefreshCw, X } from 'lucide-react';
import { getProducts as getMergedProducts } from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';

interface Adjustment {
    id: string; productId: string; productName: string;
    type: 'add' | 'reduce'; quantity: number; reason: string;
    date: string; before: number; after: number;
}

const REASONS_ADD = ['Purchase received','Return from customer','Stock correction','Transfer in','Found in warehouse','Other'];
const REASONS_REDUCE = ['Damaged / expired','Theft / loss','Stock correction','Transfer out','Sample given','Other'];
const ADJ_KEY = 'inventory_adjustments';
const getAdjs = (): Adjustment[] => { try { return JSON.parse(localStorage.getItem(ADJ_KEY)||'[]'); } catch { return []; } };
const saveAdj = (a: Adjustment) => localStorage.setItem(ADJ_KEY, JSON.stringify([a,...getAdjs()]));

// Adapter: map a productService Product into the flat shape this page expects.
function flatten(p: any) {
    const stock = Array.isArray(p?.locations)
        ? p.locations.reduce((s: number, l: any) => s + (Number(l?.currentStock) || 0), 0)
        : Number(p?.current_stock || p?.stock || 0);
    return {
        id: String(p?.id ?? ''),
        name: String(p?.name ?? ''),
        sku: String(p?.sku ?? ''),
        current_stock: stock,
        minimum_stock: Number(p?.reorderLevel || p?.minimum_stock || p?.min_stock || 0),
        unit_price: Number(p?.pricing?.sellingPrice || p?.price || p?.unit_price || 0),
        cost: Number(p?.pricing?.landedCost || p?.cost || 0),
        unit: String(p?.uom || p?.unit || 'unit'),
        category: String(p?.category || 'Imported'),
    };
}

export default function InventoryAdjustment() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const comboRef = useRef<HTMLDivElement | null>(null);
    const [form, setForm] = useState({ productId:'', type:'add' as 'add'|'reduce', quantity:1, reason:'', date:new Date().toISOString().slice(0,10) });

    useEffect(() => { getMergedProducts().then(list => { setProducts(list.map(flatten)); setLoading(false); }); setAdjustments(getAdjs()); }, []);

    // Close the suggestion list when the user clicks anywhere outside the combobox.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!comboRef.current) return;
            if (!comboRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const sel = products.find(p => String(p.id) === form.productId);
    const preview = sel ? form.type==='add' ? (sel.current_stock||0)+form.quantity : Math.max(0,(sel.current_stock||0)-form.quantity) : 0;
    const filteredProducts = search.trim()
        ? products.filter(p =>
            (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.sku || '').toLowerCase().includes(search.toLowerCase()))
        : products;

    const handleSave = async () => {
        if (!form.productId||!form.reason||form.quantity<=0) { alert('Please fill all fields.'); return; }
        if (!sel) { alert('Selected product not found.'); return; }
        setSaving(true);
        try {
            const base = String(import.meta.env.VITE_API_URL||'http://localhost:8000').replace(/\/$/,'') + '/api';

            // Find this product on the backend by name (case-insensitive). The dropdown
            // may include products that live only in localStorage (e.g. BETTANO imports
            // that never reached the server). If missing, POST a minimal record so the
            // adjustment can write a real stock value to it.
            let backendId: string | number | null = null;
            let backendCurrentStock = 0;
            try {
                const listResp = await fetch(`${base}/products/`, { cache: 'no-store' });
                if (listResp.ok) {
                    const list = await listResp.json();
                    const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                    const target = String(sel.name || '').trim().toLowerCase();
                    const match = arr.find((p: any) => String(p?.name || '').trim().toLowerCase() === target);
                    if (match) {
                        backendId = match.id;
                        backendCurrentStock = Number(match.stock) || 0;
                    }
                }
            } catch { /* fall through to create-on-backend */ }

            if (backendId == null) {
                // Create on backend with the localStorage product's data, starting from
                // stock=0 so the adjustment delta is the final value (no double-count).
                const createBody = {
                    name: sel.name,
                    sku: sel.sku || `INV-${Date.now()}`,
                    category: sel.category || 'Imported',
                    description: '',
                    price: sel.unit_price || 0,
                    cost: sel.cost || 0,
                    stock: 0,
                    min_stock: sel.minimum_stock || 0,
                    unit: sel.unit || 'unit',
                };
                const createResp = await fetch(`${base}/products/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody) });
                if (!createResp.ok) {
                    const detail = await createResp.text().catch(() => '');
                    throw new Error(`Could not create product on backend (HTTP ${createResp.status}): ${detail.slice(0, 200)}`);
                }
                const created = await createResp.json();
                backendId = created.id;
                backendCurrentStock = Number(created.stock) || 0;
            }

            const newStock = form.type === 'add'
                ? backendCurrentStock + form.quantity
                : Math.max(0, backendCurrentStock - form.quantity);
            const putResp = await fetch(`${base}/products/${backendId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: newStock }) });
            if (!putResp.ok) {
                const detail = await putResp.text().catch(() => '');
                throw new Error(`Backend ${putResp.status}: ${detail.slice(0, 200) || putResp.statusText}`);
            }

            const adj: Adjustment = {id:`ADJ-${Date.now()}`,productId:String(backendId),productName:sel.name,type:form.type,quantity:form.quantity,reason:form.reason,date:form.date,before:backendCurrentStock,after:newStock};
            saveAdj(adj);
            const upd = await getMergedProducts(); setProducts(upd.map(flatten)); setAdjustments(getAdjs());
            setSuccess(`Stock ${form.type==='add'?'increased':'reduced'} by ${form.quantity} units (now ${newStock})`);
            setTimeout(()=>setSuccess(''),4000);
            setForm(p=>({...p,productId:'',quantity:1,reason:''}));
            setSearch('');
        } catch (e) {
            alert(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
        }
        finally { setSaving(false); }
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"><ArrowLeft size={14}/> Back</button>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center"><Package size={24} className="text-orange-600"/></div>
                    <div><h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Inventory Adjustment</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Add or reduce stock with reason and full audit trail</p></div>
                </div>
            </div>
            {success && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm font-bold text-emerald-700">✅ {success}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
                    <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">New Adjustment</h2>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Type</label>
                        <div className="flex gap-2">
                            <button onClick={()=>setForm(p=>({...p,type:'add',reason:''}))} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${form.type==='add'?'bg-emerald-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><Plus size={16}/> Add Stock</button>
                            <button onClick={()=>setForm(p=>({...p,type:'reduce',reason:''}))} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${form.type==='reduce'?'bg-red-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><Minus size={16}/> Reduce Stock</button>
                        </div>
                    </div>
                    <div ref={comboRef} className="relative"><label className="block text-xs font-black text-gray-500 uppercase mb-2">Product ({products.length} total)</label>
                        <input
                            type="text"
                            value={search}
                            onFocus={() => setOpen(true)}
                            onChange={e => { setSearch(e.target.value); setOpen(true); if (form.productId) setForm(p => ({ ...p, productId: '' })); }}
                            placeholder="Type product name or SKU to search..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400"
                            autoComplete="off"
                        />
                        {form.productId && search && (
                            <button
                                type="button"
                                onClick={() => { setSearch(''); setForm(p => ({ ...p, productId: '' })); setOpen(false); }}
                                className="absolute right-3 top-[42px] text-gray-400 hover:text-gray-700"
                                aria-label="Clear"
                            >
                                <X size={16} />
                            </button>
                        )}
                        {open && filteredProducts.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                                {filteredProducts.slice(0, 50).map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setForm(prev => ({ ...prev, productId: p.id }));
                                            setSearch(p.name);
                                            setOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                                    >
                                        <span className="font-semibold text-gray-800 truncate">{p.name}</span>
                                        <span className="text-xs text-gray-500 ml-3 shrink-0">Stock: {p.current_stock || 0}</span>
                                    </button>
                                ))}
                                {filteredProducts.length > 50 && (
                                    <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                                        Showing first 50 of {filteredProducts.length} matches — type more to narrow down.
                                    </div>
                                )}
                            </div>
                        )}
                        {open && search.trim() && filteredProducts.length === 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">
                                No products match &ldquo;{search}&rdquo;.
                            </div>
                        )}
                    </div>
                    <div><label className="block text-xs font-black text-gray-500 uppercase mb-2">Quantity</label>
                        <input type="number" min={1} value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:parseInt(e.target.value)||1}))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-black focus:outline-none focus:border-orange-400"/>
                    </div>
                    <div><label className="block text-xs font-black text-gray-500 uppercase mb-2">Reason</label>
                        <select value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400">
                            <option value="">Select reason...</option>
                            {(form.type==='add'?REASONS_ADD:REASONS_REDUCE).map(r=><option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-xs font-black text-gray-500 uppercase mb-2">Date</label>
                        <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400"/>
                    </div>
                    {sel && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview</p>
                            <div className="flex justify-between text-sm"><span className="text-gray-600">Current</span><span className="font-black font-mono">{sel.current_stock||0} units</span></div>
                            <div className="flex justify-between text-sm"><span className="text-gray-600">Adjustment</span><span className={`font-black font-mono ${form.type==='add'?'text-emerald-600':'text-red-600'}`}>{form.type==='add'?'+':'-'}{form.quantity}</span></div>
                            <div className="flex justify-between text-sm border-t border-gray-200 pt-2"><span className="font-black">New stock</span><span className={`text-xl font-black font-mono ${preview<(sel.minimum_stock||10)?'text-red-600':'text-emerald-600'}`}>{preview} units</span></div>
                            <p className="text-xs text-gray-400">Value: {formatCurrency(preview * sel.unit_price)}</p>
                        </div>
                    )}
                    <button onClick={handleSave} disabled={saving||!form.productId||!form.reason} className="w-full py-3 bg-gray-900 text-white font-black rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                        {saving ? <><RefreshCw size={16} className="animate-spin"/> Saving...</> : <><Save size={16}/> Save Adjustment</>}
                    </button>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100"><h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">Adjustment History</h2></div>
                    {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> :
                    adjustments.length===0 ? <div className="p-12 text-center"><Package size={40} className="mx-auto text-gray-200 mb-3"/><p className="text-gray-400 text-sm">No adjustments yet</p></div> :
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                        {adjustments.map(adj=>(
                            <div key={adj.id} className="px-5 py-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${adj.type==='add'?'bg-emerald-100':'bg-red-100'}`}>
                                        {adj.type==='add'?<Plus size={14} className="text-emerald-600"/>:<Minus size={14} className="text-red-600"/>}
                                    </div>
                                    <div><p className="text-sm font-black text-gray-900">{adj.productName}</p>
                                    <p className="text-xs text-gray-400">{adj.reason} · {adj.date}</p></div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${adj.type==='add'?'text-emerald-600':'text-red-600'}`}>{adj.type==='add'?'+':'-'}{adj.quantity}</p>
                                    <p className="text-xs text-gray-400">{adj.before} → {adj.after}</p>
                                </div>
                            </div>
                        ))}
                    </div>}
                </div>
            </div>
        </div>
    );
}
