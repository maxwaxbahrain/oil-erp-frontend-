import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Save,
    ArrowLeft,
    Building2,
    MapPin,
    Phone,
    Mail,
    CreditCard,
    BarChart3,
    CheckCircle,
    XCircle,
    Truck,
    Clock
} from 'lucide-react';
import { getSuppliers, createSupplier, type Supplier } from '../../services/purchasesService';

export default function SupplierForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    // Form State
    const [status, setStatus] = useState<'Active' | 'Blocked'>('Active');
    const [formData, setFormData] = useState<Partial<Supplier>>({
        name: '',
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        contactPerson: '',
        phone: '',
        email: '',
        taxId: '',
        paymentTerms: 'Net 30',
        currency: 'USD',
        status: 'Active',
        // ITEM 6A — Opening Balance default. Backend already round-trips
        // this field (purchasesService maps to opening_balance); the only
        // thing missing was the input on this form.
        openingBalance: 0,
    });

    // Mock Performance Data (Read-only)
    const performanceData = {
        totalPurchases: 125000,
        avgCostVariance: '+2.4%',
        deliveryAccuracy: '98.5%',
        outstandingPayables: 4500
    };

    useEffect(() => {
        if (isEditMode) {
            // Fetch supplier details (mock)
            getSuppliers().then(suppliers => {
                const supplier = suppliers.find(s => s.id === id);
                if (supplier) {
                    setFormData(supplier);
                    setStatus(supplier.status);
                }
            });
        }
    }, [isEditMode, id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        // Validate required fields

        if (!formData.name || !formData.email) {
            alert('Please fill in all required fields: Supplier Name, Contact Person, and Email');
            return;
        }

        // Create complete supplier object
        const supplierData: Supplier = {
            id: 'temp-id', // Will be replaced by createSupplier
            name: formData.name!,
            code: formData.code!,
            contactPerson: formData.contactPerson!,
            email: formData.email!,
            phone: formData.phone || '',
            taxId: formData.taxId || '',
            status: status,
            paymentTerms: formData.paymentTerms!,
            currency: formData.currency!,
            rating: 'A', // Default rating
            // ITEM 6A — Persist the user-entered opening balance.
            openingBalance: Number(formData.openingBalance) || 0,
        };

        // Save supplier
        await createSupplier(supplierData);

        // Navigate back with success message
        navigate('/purchases/suppliers', {
            state: {
                success: true,
                message: `Supplier "${formData.name}" created successfully!`
            }
        });
    };

    return (
        <div className="max-w-[1000px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/purchases/suppliers')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight uppercase">
                            {isEditMode ? 'Edit Supplier' : 'New Supplier'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Vendor Master</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[11px] font-bold text-redwood-brand uppercase tracking-wider">{formData.code}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setStatus(status === 'Active' ? 'Blocked' : 'Active')}
                        className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all flex items-center gap-2 ${status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                            }`}
                    >
                        {status === 'Active' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {status}
                    </button>
                    <button onClick={handleSubmit} className="px-6 py-2.5 bg-redwood-brand text-white text-[12px] font-bold rounded-sm hover:brightness-95 uppercase tracking-widest transition-all shadow-md flex items-center gap-2">
                        <Save size={16} /> Save Supplier
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Info Column */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Basic Information */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Building2 size={14} /> Basic Identification
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Supplier Name</label>
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="e.g. Global Foods Ltd."
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Legal Name</label>
                                <input
                                    name="legalName" // Add to type if needed, mock handling for now
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="Official Legal Entity Name"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tax ID / VAT No</label>
                                <input
                                    name="taxId"
                                    value={formData.taxId}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="TAX-XXXX-XXXX"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Details */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <MapPin size={14} /> Contact Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Billing Address</label>
                                <input
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="Street Address, City, State, Zip"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <span className="flex items-center gap-1"><Phone size={12} /> Phone Number</span>
                                </label>
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <span className="flex items-center gap-1"><Mail size={12} /> Email Address</span>
                                </label>
                                <input
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    placeholder="contact@supplier.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Financial Settings */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <CreditCard size={14} /> Financial Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">AP Account</label>
                                <select className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none">
                                    <option>2000 - Accounts Payable</option>
                                    <option>2001 - Trade Payables Foreign</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Payment Terms</label>
                                <select
                                    name="paymentTerms"
                                    value={formData.paymentTerms}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                >
                                    <option>Net 15</option>
                                    <option>Net 30</option>
                                    <option>Net 45</option>
                                    <option>Net 60</option>
                                    <option>Due on Receipt</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Currency</label>
                                <select
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                >
                                    <option>USD ($)</option>
                                    <option>EUR (€)</option>
                                    <option>GBP (£)</option>
                                </select>
                            </div>
                        </div>
                        {/* ITEM 6A — Opening Balance input. Mirrors the customer
                            side and round-trips via purchasesService → backend
                            opening_balance column (already wired). */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Opening Balance</label>
                                <input
                                    type="number"
                                    name="openingBalance"
                                    value={formData.openingBalance ?? 0}
                                    onChange={handleChange}
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-mono font-medium focus:border-redwood-brand outline-none"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Outstanding amount owed to this supplier when adding them (defaults to 0).</p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column: Performance & Insights */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Performance Scorecard */}
                    <div className="bg-gradient-to-b from-redwood-midnight to-[#2d3748] text-white p-6 rounded-sm shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BarChart3 size={100} />
                        </div>
                        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 opacity-80">
                            Performance Matrix
                        </h3>

                        <div className="space-y-6 relative z-10">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Total Purchases (YTD)</div>
                                <div className="text-2xl font-black tracking-tight">${performanceData.totalPurchases.toLocaleString()}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Avg Cost Var.</div>
                                    <div className="text-[14px] font-bold text-rose-300">{performanceData.avgCostVariance}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Del. Accuracy</div>
                                    <div className="text-[14px] font-bold text-emerald-300">{performanceData.deliveryAccuracy}</div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Outstanding Payables</div>
                                <div className="text-xl font-black tracking-tight text-amber-300">${performanceData.outstandingPayables.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="bg-white p-4 rounded-sm border border-redwood-border shadow-sm">
                        <h4 className="text-[11px] font-black text-redwood-text-muted uppercase tracking-wider mb-3">Delivery Insights</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                                <Truck size={16} className="text-blue-500" />
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase">Avg. Lead Time</div>
                                    <div className="text-[12px] font-bold text-gray-800">4.5 Days</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                                <Clock size={16} className="text-orange-500" />
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase">Last Delivery</div>
                                    <div className="text-[12px] font-bold text-gray-800">2 Days ago</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
