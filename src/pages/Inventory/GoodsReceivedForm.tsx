import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Truck,
    Package,
    ClipboardCheck,
    AlertTriangle,
    CheckSquare,
    Printer,
    FileText,
    Warehouse,
    Save,
    Trash2,
    Plus,
    CheckCircle
} from 'lucide-react';
import {
    getGRNById,
    createGRNFromPO,
    saveGRN,
    postGRN,
    deleteGRN,
    getPendingPurchaseOrders,
    type GRN,
    type GRNItem
} from '../../services/grnService';
import { type PurchaseOrder } from '../../services/purchasesService';

export default function GoodsReceivedForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [posting, setPosting] = useState(false);

    // GRN Data
    const [grn, setGRN] = useState<GRN | null>(null);
    const [items, setItems] = useState<GRNItem[]>([]);
    const [warehouse, setWarehouse] = useState('Main Warehouse');
    const [freightCost, setFreightCost] = useState(0);
    const [notes, setNotes] = useState('');

    // PO Selection (for new GRN)
    const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
    const [selectedPOId, setSelectedPOId] = useState('');
    const [showPOSelector, setShowPOSelector] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (id && id !== 'new') {
                // Load existing GRN
                const grnData = await getGRNById(id);
                if (grnData) {
                    setGRN(grnData);
                    setItems(grnData.items);
                    setWarehouse(grnData.warehouse);
                    setFreightCost(grnData.freightCost);
                    setNotes(grnData.notes || '');
                } else {
                    alert('GRN not found');
                    navigate('/receiving');
                }
            } else {
                // New GRN - load pending POs
                const pos = await getPendingPurchaseOrders();
                setPendingPOs(pos);
                setShowPOSelector(true);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFromPO = async () => {
        if (!selectedPOId) {
            alert('Please select a Purchase Order');
            return;
        }

        try {
            const newGRN = await createGRNFromPO(selectedPOId, warehouse);
            setGRN(newGRN);
            setItems(newGRN.items);
            setShowPOSelector(false);
        } catch (error: any) {
            console.error('Error creating GRN:', error);
            alert(error.message || 'Error creating GRN');
        }
    };

    const handleReceiveAll = () => {
        const updated = items.map(item => ({
            ...item,
            receivedQty: item.orderedQty,
            acceptedQty: item.orderedQty,
            rejectedQty: 0,
            totalCost: item.orderedQty * item.unitCost
        }));
        setItems(updated);
    };

    const handleItemChange = (index: number, field: keyof GRNItem, value: any) => {
        const newItems = [...items];
        const item = newItems[index];

        // Update the field
        (item as any)[field] = Number(value) || 0;

        // Auto-calculate accepted/rejected based on received
        if (field === 'receivedQty') {
            item.acceptedQty = item.receivedQty;
            item.rejectedQty = 0;
        }

        // Ensure received = accepted + rejected
        if (field === 'acceptedQty' || field === 'rejectedQty') {
            const total = item.acceptedQty + item.rejectedQty;
            if (total > item.receivedQty) {
                // Adjust to match received
                if (field === 'acceptedQty') {
                    item.rejectedQty = Math.max(0, item.receivedQty - item.acceptedQty);
                } else {
                    item.acceptedQty = Math.max(0, item.receivedQty - item.rejectedQty);
                }
            }
        }

        // Calculate total cost
        item.totalCost = item.acceptedQty * item.unitCost;

        setItems(newItems);
    };

    const handleSave = async () => {
        if (!grn) return;

        setSaving(true);
        try {
            const goodsValue = items.reduce((sum, item) => sum + item.totalCost, 0);
            const landedCost = goodsValue + freightCost;

            await saveGRN({
                id: grn.id,
                items,
                warehouse,
                freightCost,
                goodsValue,
                landedCost,
                notes
            });

            alert('GRN saved successfully');
        } catch (error: any) {
            console.error('Error saving GRN:', error);
            alert(error.message || 'Error saving GRN');
        } finally {
            setSaving(false);
        }
    };

    const handlePost = async () => {
        if (!grn) return;

        // Validate
        const totalReceived = items.reduce((sum, item) => sum + item.acceptedQty, 0);
        if (totalReceived === 0) {
            alert('Cannot post GRN with zero accepted quantity. Please receive at least one item.');
            return;
        }

        const confirmed = window.confirm(
            'Are you sure you want to post this GRN? This will update inventory and cannot be undone.'
        );

        if (!confirmed) return;

        setPosting(true);
        try {
            // Calculate totals
            const goodsValue = items.reduce((sum, item) => sum + item.totalCost, 0);
            const landedCost = goodsValue + freightCost;

            // Save the GRN with updated items first
            await saveGRN({
                id: grn.id,
                items,
                warehouse,
                freightCost,
                goodsValue,
                landedCost,
                notes
            });

            // Then post the GRN
            await postGRN(grn.id);

            alert('GRN posted successfully! Inventory has been updated.');
            navigate('/receiving');
        } catch (error: any) {
            console.error('Error posting GRN:', error);
            alert(error.message || 'Error posting GRN');
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = async () => {
        if (!grn) return;

        const confirmed = window.confirm('Are you sure you want to delete this GRN?');
        if (!confirmed) return;

        try {
            await deleteGRN(grn.id);
            alert('GRN deleted successfully');
            navigate('/receiving');
        } catch (error: any) {
            console.error('Error deleting GRN:', error);
            alert(error.message || 'Error deleting GRN');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Calculate totals
    const goodsValue = items.reduce((sum, item) => sum + item.totalCost, 0);
    const landedCost = goodsValue + freightCost;
    const totalOrdered = items.reduce((sum, item) => sum + item.orderedQty, 0);
    const totalReceived = items.reduce((sum, item) => sum + item.receivedQty, 0);
    const totalAccepted = items.reduce((sum, item) => sum + item.acceptedQty, 0);
    const totalRejected = items.reduce((sum, item) => sum + item.rejectedQty, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-redwood-brand mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // PO Selector View
    if (showPOSelector) {
        return (
            <div className="max-w-[800px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/receiving')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight uppercase">Create GRN</h1>
                        <p className="text-sm text-redwood-text-muted mt-1">Select a Purchase Order to receive goods</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-sm border border-redwood-border shadow-sm">
                    <div className="mb-6">
                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                            Select Purchase Order
                        </label>
                        {pendingPOs.length === 0 ? (
                            <div className="text-center py-12">
                                <Truck size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm font-medium mb-2">No pending purchase orders</p>
                                <p className="text-gray-400 text-xs">Create and approve a purchase order first</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingPOs.map(po => (
                                    <div
                                        key={po.id}
                                        onClick={() => setSelectedPOId(po.id)}
                                        className={`p-4 border-2 rounded-sm cursor-pointer transition-all ${selectedPOId === po.id
                                            ? 'border-redwood-brand bg-redwood-bg-light'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-[14px] font-bold text-redwood-text-main">{po.poNumber}</div>
                                                <div className="text-[12px] text-gray-600 mt-1">
                                                    {po.supplierName} • {po.items.length} items • ${po.grandTotal.toFixed(2)}
                                                </div>
                                            </div>
                                            {selectedPOId === po.id && (
                                                <CheckCircle size={20} className="text-redwood-brand" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-6">
                        <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-3">
                            Receiving Warehouse
                        </label>
                        <div className="relative">
                            <Warehouse size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={warehouse}
                                onChange={(e) => setWarehouse(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-sm pl-10 pr-4 py-3 text-[13px] font-medium focus:border-redwood-brand outline-none"
                            >
                                <option>Main Warehouse</option>
                                <option>North Warehouse</option>
                                <option>South Distribution Center</option>
                                <option>East Depot</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/receiving')}
                            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 text-[13px] font-bold rounded-sm hover:bg-gray-50 uppercase tracking-wider transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateFromPO}
                            disabled={!selectedPOId}
                            className="flex-1 px-6 py-3 bg-redwood-brand text-white text-[13px] font-bold rounded-sm hover:brightness-95 uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            Create GRN
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!grn) return null;

    const isPosted = grn.status === 'Posted';

    return (
        <div className="max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/receiving')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight uppercase">Goods Received Note</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Stock Inward</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[11px] font-bold text-redwood-brand uppercase tracking-wider">{grn.grnNumber}</span>
                            {isPosted && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                                        <CheckCircle size={12} />
                                        Posted
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!isPosted && (
                        <>
                            <button
                                onClick={handleDelete}
                                className="px-5 py-2.5 bg-white border border-red-300 text-red-600 text-[12px] font-bold rounded-sm hover:bg-red-50 uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-bold rounded-sm hover:bg-gray-50 uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save size={16} />
                                {saving ? 'Saving...' : 'Save Draft'}
                            </button>
                        </>
                    )}
                    <button
                        onClick={handlePrint}
                        className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-bold rounded-sm hover:bg-gray-50 uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                        <Printer size={16} />
                        Print
                    </button>
                    {!isPosted && (
                        <button
                            onClick={handlePost}
                            disabled={posting}
                            className="px-6 py-2.5 bg-emerald-600 text-white text-[12px] font-bold rounded-sm hover:brightness-95 uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            <CheckSquare size={16} />
                            {posting ? 'Posting...' : 'Post GRN'}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Header Info & Costing */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Header Info */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <ClipboardCheck size={14} />
                            GRN Header
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">PO Reference</label>
                                <input
                                    value={grn.poReference}
                                    readOnly
                                    className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium text-gray-700 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Warehouse</label>
                                <div className="relative">
                                    <Warehouse size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select
                                        value={warehouse}
                                        onChange={(e) => setWarehouse(e.target.value)}
                                        disabled={isPosted}
                                        className="w-full bg-white border border-gray-200 rounded-sm pl-9 pr-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                                    >
                                        <option>Main Warehouse</option>
                                        <option>North Warehouse</option>
                                        <option>South Distribution Center</option>
                                        <option>East Depot</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Received By</label>
                                <input
                                    value={grn.receivedBy}
                                    readOnly
                                    className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                                <input
                                    value={grn.receivedDate}
                                    readOnly
                                    className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Costing Summary */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <FileText size={14} />
                            Costing (Landed)
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-[12px] text-gray-600">
                                <span>Goods Value</span>
                                <span className="font-mono font-bold">${goodsValue.toFixed(2)}</span>
                            </div>
                            <div>
                                <div className="flex justify-between items-center text-[12px] text-gray-600 mb-2">
                                    <span>Freight (Allocated)</span>
                                </div>
                                <input
                                    type="number"
                                    value={freightCost}
                                    onChange={(e) => setFreightCost(Number(e.target.value) || 0)}
                                    disabled={isPosted}
                                    className="w-full text-right bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-mono font-bold focus:border-redwood-brand outline-none disabled:cursor-not-allowed"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                <span className="text-[12px] font-black text-redwood-text-main uppercase">Total Landed Cost</span>
                                <span className="text-[16px] font-black text-emerald-600 font-mono tracking-tight">${landedCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="bg-gradient-to-br from-redwood-brand to-redwood-brand-dark p-6 rounded-sm shadow-md text-white">
                        <h3 className="text-[11px] font-black uppercase tracking-wider mb-4 opacity-90">Receipt Summary</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider opacity-75 mb-1">Ordered</div>
                                <div className="text-2xl font-black">{totalOrdered}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wider opacity-75 mb-1">Received</div>
                                <div className="text-2xl font-black">{totalReceived}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wider opacity-75 mb-1">Accepted</div>
                                <div className="text-2xl font-black text-emerald-300">{totalAccepted}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wider opacity-75 mb-1">Rejected</div>
                                <div className="text-2xl font-black text-rose-300">{totalRejected}</div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <label className="block text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-3">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isPosted}
                            rows={4}
                            className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] focus:border-redwood-brand outline-none resize-none disabled:cursor-not-allowed"
                            placeholder="Add any notes about this receipt..."
                        />
                    </div>
                </div>

                {/* Right Column - Items Grid */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <Package size={14} />
                                Items Received
                            </h3>
                            {!isPosted && (
                                <button
                                    onClick={handleReceiveAll}
                                    className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider hover:bg-emerald-50 px-3 py-1.5 rounded-sm border border-emerald-200 transition-colors"
                                >
                                    One-click Receive All
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-redwood-bg-light">
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[30%]">Product</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%] text-center">Ordered</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%] text-center">Received</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%] text-center">Accepted</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%] text-center">Rejected</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[12%] text-right">Unit Cost</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[10%] text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="group hover:bg-redwood-bg-light/30 transition-colors border-b border-gray-50">
                                            <td className="p-2">
                                                <div className="text-[13px] font-bold text-redwood-text-main">{item.productName}</div>
                                                <div className="text-[10px] text-gray-400">{item.sku}</div>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="text-[13px] font-mono text-gray-600">{item.orderedQty}</span>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.receivedQty}
                                                    onChange={(e) => handleItemChange(index, 'receivedQty', e.target.value)}
                                                    disabled={isPosted}
                                                    className="w-full text-center bg-gray-50 border border-transparent hover:border-gray-200 focus:border-redwood-brand rounded-sm py-1 text-[13px] font-mono disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.acceptedQty}
                                                    onChange={(e) => handleItemChange(index, 'acceptedQty', e.target.value)}
                                                    disabled={isPosted}
                                                    className="w-full text-center bg-emerald-50 border border-transparent hover:border-emerald-200 focus:border-emerald-500 rounded-sm py-1 text-[13px] font-mono text-emerald-700 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.rejectedQty}
                                                    onChange={(e) => handleItemChange(index, 'rejectedQty', e.target.value)}
                                                    disabled={isPosted}
                                                    className="w-full text-center bg-rose-50 border border-transparent hover:border-rose-200 focus:border-rose-500 rounded-sm py-1 text-[13px] font-mono text-rose-700 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="p-2 text-right">
                                                <span className="text-[13px] font-mono text-gray-700">${item.unitCost.toFixed(2)}</span>
                                            </td>
                                            <td className="p-2 text-center">
                                                {item.rejectedQty > 0 || item.receivedQty !== item.orderedQty ? (
                                                    <AlertTriangle size={16} className="text-amber-500 mx-auto" />
                                                ) : item.acceptedQty > 0 ? (
                                                    <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                                                ) : (
                                                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mx-auto"></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Warnings */}
                        {!isPosted && items.some(i => i.receivedQty !== i.orderedQty) && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-3">
                                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[12px] font-bold text-amber-800 uppercase tracking-wide">Quantity Mismatch Detected</div>
                                    <div className="text-[11px] text-amber-700 mt-1">
                                        Received quantity does not match ordered quantity for one or more items. Please verify before posting.
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isPosted && items.some(i => i.rejectedQty > 0) && (
                            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-sm flex items-start gap-3">
                                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[12px] font-bold text-rose-800 uppercase tracking-wide">Rejected Items Detected</div>
                                    <div className="text-[11px] text-rose-700 mt-1">
                                        Some items have been rejected. Consider documenting the reason in the notes section.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
