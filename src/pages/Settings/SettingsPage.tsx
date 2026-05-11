import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Bell,
    Database,
    ChevronRight,
    ArrowRight,
    Upload,
    Activity,
    Lock,
    Building2,
    PenTool,
    Image as ImageIcon,
    Save,
    Trash2,
    AlertTriangle,
    CheckCircle,
    Zap
} from 'lucide-react';
import {
    getCompanyProfile,
    saveCompanyProfile,
    saveCompanySettings,
    companyProfileToSettings,
    getDocumentSignature,
    saveDocumentSignature,
    type CompanyProfile,
    type DocumentSignature,
    getSystemSettings,
    updateSystemSettings,
    type SystemSettings
} from '../../services/settingsService';

type TabType = 'security' | 'company' | 'currency' | 'signature' | 'data' | 'notifications';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('company');
    const [profile, setProfile] = useState<CompanyProfile>(getCompanyProfile());
    const [signature, setSignature] = useState<DocumentSignature>(getDocumentSignature());
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [currencySettings, setCurrencySettings] = useState<SystemSettings>(getSystemSettings());

    const handleSaveCurrency = (e: React.FormEvent) => {
        e.preventDefault();
        updateSystemSettings(currencySettings);
        notify('Currency configuration updated successfully');
    };

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        saveCompanyProfile(profile);
        saveCompanySettings(companyProfileToSettings(profile));
        notify('Company profile saved successfully');
    };

    const handleSaveSignature = (e: React.FormEvent) => {
        e.preventDefault();
        saveDocumentSignature(signature);
        notify('Document signature protocols updated');
    };

    const notify = (msg: string) => {
        setSuccessMsg(msg);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                if (type === 'logo') {
                    setProfile(prev => ({ ...prev, logo: base64String }));
                } else {
                    setSignature(prev => ({ ...prev, signatureImage: base64String }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="max-w-[1500px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Global Configuration Header */}
            <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-6 justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main tracking-tighter uppercase">Enterprise Configuration Console</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em]">Global Governance Framework</span>
                        <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                        <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Cluster: Karachi-South-01</span>
                    </div>
                </div>
                {showSuccess && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-sm text-emerald-700 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-4">
                        <CheckCircle size={14} /> {successMsg}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Authority Navigation */}
                <div className="lg:col-span-3 space-y-1">
                    <h3 className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.3em] px-4 mb-4">Control Domains</h3>
                    {[
                        { id: 'company', label: 'Company Profile', icon: Building2 },
                        { id: 'currency', label: 'Currency Config', icon: Database },
                        { id: 'signature', label: 'Document Signature', icon: PenTool },
                        { id: 'security', label: 'Security & Auth', icon: Shield },
                        { id: 'data', label: '📥 Data Migration', icon: Database },
                        { id: 'notifications', label: 'Global Notifications', icon: Bell },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-sm text-[12px] font-black transition-all group ${activeTab === tab.id ? 'bg-redwood-bg-light border-l-4 border-redwood-brand text-redwood-text-main shadow-sm' : 'text-redwood-text-muted hover:bg-redwood-bg-light border-l-4 border-transparent'}`}
                        >
                            <tab.icon size={18} className={`${activeTab === tab.id ? 'text-redwood-brand' : 'group-hover:text-redwood-brand'}`} />
                            <span className="uppercase tracking-widest">{tab.label}</span>
                            <ChevronRight size={14} className={`ml-auto ${activeTab === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                        </button>
                    ))}
                </div>

                {/* Content Execution Area */}
                <div className="lg:col-span-9 space-y-10">
                    {activeTab === 'company' && (
                        <section className="bg-white border border-redwood-border rounded-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-8 border-b border-redwood-border bg-gray-50/50">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-widest">Company Profile Configuration</h2>
                                <p className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1">Foundational attributes for business identity</p>
                            </div>

                            <form onSubmit={handleSaveProfile} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Company Logo</label>
                                            <div className="flex items-start gap-6">
                                                <div className="w-40 h-20 bg-gray-100 border-2 border-dashed border-gray-200 rounded-sm flex items-center justify-center overflow-hidden">
                                                    {profile.logo ? (
                                                        <img src={profile.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <ImageIcon size={32} className="text-gray-300" />
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    <input
                                                        type="file"
                                                        id="logo-upload"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => handleFileUpload(e, 'logo')}
                                                    />
                                                    <label htmlFor="logo-upload" className="inline-block px-4 py-2 bg-white border border-redwood-border text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-gray-50 rounded-sm">
                                                        Upgrade Asset
                                                    </label>
                                                    <p className="text-[9px] text-gray-400 font-bold max-w-[150px]">PNG or JPEG. Recommended: 300x120px.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Company Name</label>
                                                    <span className="text-[9px] text-redwood-brand font-bold">Shows in sidebar under SOLTOL ONE</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={profile.name}
                                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-black focus:bg-white focus:border-redwood-brand outline-none transition-all uppercase tracking-tight"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Address Line 1</label>
                                                <input
                                                    type="text"
                                                    value={profile.address1}
                                                    onChange={(e) => setProfile({ ...profile, address1: e.target.value })}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">City</label>
                                                    <input
                                                        type="text"
                                                        value={profile.city}
                                                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                                                        className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">State / Province</label>
                                                    <input
                                                        type="text"
                                                        value={profile.state}
                                                        onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                                                        className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Postal Code</label>
                                                    <input
                                                        type="text"
                                                        value={profile.postalCode}
                                                        onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                                                        className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-mono font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Country</label>
                                                    <input
                                                        type="text"
                                                        value={profile.country}
                                                        onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                                                        className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-black focus:bg-white focus:border-redwood-brand outline-none transition-all uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.3em] pb-2 border-b border-redwood-border">Contact Interconnects</h3>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Universal Phone Number</label>
                                                <input
                                                    type="text"
                                                    value={profile.phone}
                                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-black focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Institutional Email</label>
                                                <input
                                                    type="email"
                                                    value={profile.email}
                                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Global Web Presence</label>
                                                <input
                                                    type="text"
                                                    value={profile.website}
                                                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Tax ID (optional)</label>
                                                <input
                                                    type="text"
                                                    value={profile.taxId ?? ''}
                                                    onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                                                    placeholder="e.g. EIN / VAT"
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-redwood-bg-light/50 p-6 rounded-sm border border-redwood-border space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Activity size={16} className="text-redwood-brand" />
                                                <span className="text-[10px] font-black text-redwood-text-main uppercase tracking-widest">Metadata Synchronization</span>
                                            </div>
                                            <p className="text-[10px] text-redwood-text-muted font-bold leading-relaxed italic uppercase tracking-wider">Updates here will propagate across all procurement documents, fiscal statements, and internal auditing logs within the Karachi-South-01 cluster.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-redwood-border flex justify-end">
                                    <button type="submit" className="px-10 py-4 bg-redwood-brand text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-sm hover:-translate-y-0.5 transition-all shadow-xl flex items-center gap-3">
                                        <Save size={18} /> Persist Intelligence
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {activeTab === 'signature' && (
                        <section className="bg-white border border-redwood-border rounded-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-8 border-b border-redwood-border bg-gray-50/50">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-widest">Document Signature Governance</h2>
                                <p className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1">Management of authorized signatory credentials</p>
                            </div>

                            <form onSubmit={handleSaveSignature} className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Authorized Execution Matrix</label>
                                            <div className="w-full h-32 bg-white border-2 border-dashed border-gray-200 rounded-sm flex items-center justify-center overflow-hidden relative group">
                                                {signature.signatureImage ? (
                                                    <img src={signature.signatureImage} alt="Signature" className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <PenTool size={32} className="text-gray-300" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <input
                                                        type="file"
                                                        id="sig-upload"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => handleFileUpload(e, 'signature')}
                                                    />
                                                    <label htmlFor="sig-upload" className="px-4 py-2 bg-white text-[10px] font-black uppercase tracking-widest rounded-sm cursor-pointer shadow-xl">
                                                        Change Vector
                                                    </label>
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center italic">Transparent PNG recommended. Standard size: 300x100px.</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Signatory Entity Name</label>
                                                <input
                                                    type="text"
                                                    value={signature.signatoryName}
                                                    onChange={(e) => setSignature({ ...signature, signatoryName: e.target.value })}
                                                    placeholder="e.g., AHMED KHAN"
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-black focus:bg-white focus:border-redwood-brand outline-none transition-all uppercase tracking-tight"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Official Designation / Title</label>
                                                <input
                                                    type="text"
                                                    value={signature.signatoryTitle}
                                                    onChange={(e) => setSignature({ ...signature, signatoryTitle: e.target.value })}
                                                    placeholder="e.g., GENERAL MANAGER"
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all uppercase"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.3em] pb-2 border-b border-redwood-border">Distribution Matrix</h3>
                                        <div className="space-y-1">
                                            {[
                                                { key: 'showOnInvoices', label: 'Fiscal Invoices' },
                                                { key: 'showOnPurchaseOrders', label: 'Procurement Requests' },
                                                { key: 'showOnLedgers', label: 'Liability Statements' },
                                                { key: 'showOnQuotations', label: 'Commercial Proposals' },
                                                { key: 'showOnReports', label: 'Operational Analytics' },
                                            ].map((item) => (
                                                <label key={item.key} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-sm cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={(signature as any)[item.key]}
                                                        onChange={(e) => setSignature({ ...signature, [item.key]: e.target.checked })}
                                                        className="w-5 h-5 rounded border-redwood-border text-redwood-brand focus:ring-redwood-brand"
                                                    />
                                                    <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest group-hover:text-redwood-text-main transition-colors">{item.label}</span>
                                                </label>
                                            ))}
                                        </div>

                                        <div className="p-6 bg-redwood-midnight rounded-sm text-white space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Lock size={16} className="text-redwood-brand" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Protocol Override</span>
                                            </div>
                                            <p className="text-[10px] text-redwood-secondary font-bold leading-relaxed italic opacity-80 uppercase tracking-widest">Signatures represent legally binding authorization within the SOLTOL ONE platform. Ensure credentials align with corporate governance policies.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-redwood-border flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignature(prev => ({ ...prev, signatureImage: undefined }));
                                        }}
                                        className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Clear Credentials
                                    </button>
                                    <button type="submit" className="px-10 py-4 bg-redwood-brand text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-sm hover:-translate-y-0.5 transition-all shadow-xl flex items-center gap-3">
                                        <Save size={18} /> Authorize Matrix
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {activeTab === 'currency' && (
                        <section className="bg-white border border-redwood-border rounded-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-8 border-b border-redwood-border bg-gray-50/50">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-widest">Global Currency Configuration</h2>
                                <p className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1">Foundation for financial calculations and reporting</p>
                            </div>

                            <form onSubmit={handleSaveCurrency} className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Default Business Currency</label>
                                            <div className="relative">
                                                <select
                                                    value={currencySettings.defaultCurrencyCode}
                                                    onChange={(e) => {
                                                        const code = e.target.value;
                                                        setCurrencySettings({
                                                            ...currencySettings,
                                                            defaultCurrencyCode: code,
                                                            defaultCurrencySymbol: code
                                                        });
                                                    }}
                                                    className="w-full bg-gray-50 border border-redwood-border rounded-sm px-4 py-3 text-sm font-black focus:bg-white focus:border-redwood-brand outline-none transition-all uppercase tracking-tight"
                                                >
                                                    <optgroup label="Popular Currencies">
                                                        <option value="PKR">PKR - Pakistani Rupee</option>
                                                        <option value="USD">USD - US Dollar</option>
                                                        <option value="EUR">EUR - Euro</option>
                                                        <option value="GBP">GBP - British Pound</option>
                                                        <option value="AED">AED - UAE Dirham</option>
                                                        <option value="SAR">SAR - Saudi Riyal</option>
                                                        <option value="INR">INR - Indian Rupee</option>
                                                    </optgroup>
                                                    {/* ... remaining options ... */}
                                                    <optgroup label="Other Currencies">
                                                        <option value="JPY">JPY - Japanese Yen</option>
                                                        <option value="CHF">CHF - Swiss Franc</option>
                                                        <option value="CAD">CAD - Canadian Dollar</option>
                                                        <option value="AUD">AUD - Australian Dollar</option>
                                                        <option value="CNY">CNY - Chinese Yuan</option>
                                                        <option value="BDT">BDT - Bangladeshi Taka</option>
                                                        <option value="QAR">QAR - Qatari Riyal</option>
                                                        <option value="KWD">KWD - Kuwaiti Dinar</option>
                                                        <option value="BHD">BHD - Bahraini Dinar</option>
                                                        <option value="OMR">OMR - Omani Rial</option>
                                                        <option value="JOD">JOD - Jordanian Dinar</option>
                                                        <option value="EGP">EGP - Egyptian Pound</option>
                                                        <option value="TRY">TRY - Turkish Lira</option>
                                                        <option value="ZAR">ZAR - South African Rand</option>
                                                        <option value="RUB">RUB - Russian Ruble</option>
                                                        <option value="BRL">BRL - Brazilian Real</option>
                                                        <option value="MXN">MXN - Mexican Peso</option>
                                                        <option value="ARS">ARS - Argentine Peso</option>
                                                        <option value="CLP">CLP - Chilean Peso</option>
                                                        <option value="COP">COP - Colombian Peso</option>
                                                        <option value="SGD">SGD - Singapore Dollar</option>
                                                        <option value="HKD">HKD - Hong Kong Dollar</option>
                                                        <option value="KRW">KRW - South Korean Won</option>
                                                        <option value="TWD">TWD - Taiwan Dollar</option>
                                                        <option value="THB">THB - Thai Baht</option>
                                                        <option value="MYR">MYR - Malaysian Ringgit</option>
                                                        <option value="IDR">IDR - Indonesian Rupiah</option>
                                                        <option value="PHP">PHP - Philippine Peso</option>
                                                        <option value="VND">VND - Vietnamese Dong</option>
                                                        <option value="ILS">ILS - Israeli Shekel</option>
                                                        <option value="SEK">SEK - Swedish Krona</option>
                                                        <option value="NOK">NOK - Norwegian Krone</option>
                                                        <option value="DKK">DKK - Danish Krone</option>
                                                        <option value="PLN">PLN - Polish Zloty</option>
                                                        <option value="CZK">CZK - Czech Koruna</option>
                                                        <option value="HUF">HUF - Hungarian Forint</option>
                                                        <option value="RON">RON - Romanian Leu</option>
                                                        <option value="NGN">NGN - Nigerian Naira</option>
                                                        <option value="KES">KES - Kenyan Shilling</option>
                                                        <option value="GHS">GHS - Ghanaian Cedi</option>
                                                        <option value="LKR">LKR - Sri Lankan Rupee</option>
                                                        <option value="NPR">NPR - Nepalese Rupee</option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Currency Format</label>
                                            <div className="space-y-2">
                                                {[
                                                    { id: 'comma_dot', label: '1,234.56 (COMMA SEPARATOR, DOT DECIMAL)' },
                                                    { id: 'dot_comma', label: '1.234,56 (DOT SEPARATOR, COMMA DECIMAL)' },
                                                    { id: 'space_dot', label: '1 234.56 (SPACE SEPARATOR, DOT DECIMAL)' },
                                                ].map((format) => (
                                                    <label key={format.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-sm cursor-pointer transition-colors group">
                                                        <input
                                                            type="radio"
                                                            name="currencyFormat"
                                                            checked={currencySettings.currencyFormat === format.id}
                                                            onChange={() => setCurrencySettings({ ...currencySettings, currencyFormat: format.id as any })}
                                                            className="w-5 h-5 border-redwood-border text-redwood-brand focus:ring-redwood-brand"
                                                        />
                                                        <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest group-hover:text-redwood-text-main transition-colors">{format.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Currency Display Position</label>
                                            <div className="space-y-2">
                                                {[
                                                    { id: 'before', label: 'SYMBOL BEFORE AMOUNT (e.g., $ 1,500)' },
                                                    { id: 'after', label: `SYMBOL AFTER AMOUNT (e.g., 1,500 ${currencySettings.defaultCurrencyCode})` },
                                                ].map((pos) => (
                                                    <label key={pos.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-sm cursor-pointer transition-colors group">
                                                        <input
                                                            type="radio"
                                                            name="currencyPosition"
                                                            checked={currencySettings.currencyPosition === pos.id}
                                                            onChange={() => setCurrencySettings({ ...currencySettings, currencyPosition: pos.id as any })}
                                                            className="w-5 h-5 border-redwood-border text-redwood-brand focus:ring-redwood-brand"
                                                        />
                                                        <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest group-hover:text-redwood-text-main transition-colors">{pos.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-amber-50 rounded-sm border border-amber-200 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle size={16} className="text-amber-600" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">Critical Warning</span>
                                            </div>
                                            <p className="text-[10px] text-amber-800 font-bold leading-relaxed italic uppercase tracking-wider">Changing currency will affect all prices, costs, and financial valuations across the entire system. This is an institutional-level override.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-redwood-border flex justify-end">
                                    <button type="submit" className="px-10 py-4 bg-redwood-brand text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-sm hover:-translate-y-0.5 transition-all shadow-xl flex items-center gap-3">
                                        <Save size={18} /> Persist Global Currency
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {(activeTab === 'security' || activeTab === 'notifications') && (
                        <div className="flex flex-col items-center justify-center p-20 bg-white border border-redwood-border rounded-sm shadow-sm text-center">
                            <Zap size={48} className="text-redwood-brand mb-6 animate-pulse" />
                            <h3 className="text-xl font-black text-redwood-text-main uppercase tracking-tighter">Domain Under Development</h3>
                            <p className="text-[11px] text-redwood-text-muted font-bold uppercase tracking-widest mt-2 max-w-sm leading-relaxed">This section is being configured. Check back in the next update.</p>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <DataMigrationEmbed />
                    )}

                </div>
            </div>
        </div>
    );
}


// ── Embedded Data Migration (inside Settings) ────────────────
// ── Embedded Data Migration ───────────────────────────────────
function DataMigrationEmbed() {
    const [sel, setSel]           = useState('soltol_db');
    const [file, setFile]         = useState<File | null>(null);
    const [drag, setDrag]         = useState(false);
    const [busy, setBusy]         = useState(false);
    const [pct, setPct]           = useState(0);
    const [done, setDone]         = useState<string>('');
    const [err, setErr]           = useState('');
    const inputId                 = 'mig-file-input';

    const SRCS = [
        { id:'soltol_db',  icon:'🗄️', name:'Soltol / Bettano .db',  fmt:'.db,.sqlite', tip:'Go to your old Soltol ERP → Settings → Backup → Export Database → save the .db file' },
        { id:'quickbooks', icon:'📊', name:'QuickBooks',              fmt:'.csv,.iif,.xlsx', tip:'QuickBooks → File → Utilities → Export → Lists to IIF Files' },
        { id:'dynamics',   icon:'🔷', name:'Microsoft Dynamics 365', fmt:'.csv,.xlsx,.xml', tip:'Dynamics → Settings → Data Management → Export Data → select Accounts/Products' },
        { id:'netsuite',   icon:'🔴', name:'Oracle NetSuite',        fmt:'.csv,.xlsx', tip:'NetSuite → Reports → Saved Searches → run search → Export CSV' },
        { id:'cin7',       icon:'📦', name:'Cin7 Core / DEAR',       fmt:'.csv,.xlsx', tip:'Cin7 → Settings → Data Export → select Customers/Products/Sales' },
        { id:'csv',        icon:'📋', name:'Generic CSV / Excel',    fmt:'.csv,.xlsx,.xls', tip:'Download the template below, fill your data in, then upload here' },
    ];

    const src = SRCS.find(s => s.id === sel)!;

    const CK = 'bettano_customers_imported';
    const SK = 'bettano_suppliers_imported';
    const PK = 'bettano_imported_products';
    const IK = 'bettano_invoices_imported';

    const getCount = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]').length; } catch { return 0; } };
    const [counts, setCounts] = useState({ c: getCount(CK), s: getCount(SK), p: getCount(PK), i: getCount(IK) });

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) { setFile(f); setDone(''); setErr(''); }
    };

    const doImport = async () => {
        if (!file) return;
        setBusy(true); setPct(10); setErr(''); setDone('');
        try {
            const ext = file.name.toLowerCase().split('.').pop() || '';
            const log: string[] = [];

            if (ext === 'db' || ext === 'sqlite') {
                setPct(20);
                // Dynamically load SQL.js
                const initSqlJs: any = await new Promise((res) => {
                    if ((window as any).initSqlJs) { res((window as any).initSqlJs); return; }
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
                    s.onload = () => setTimeout(() => res((window as any).initSqlJs), 300);
                    s.onerror = () => res(null);
                    document.head.appendChild(s);
                });
                if (!initSqlJs) throw new Error('SQL.js failed to load — check internet connection and try again');

                const buf = await file.arrayBuffer();
                const SQL = await initSqlJs({ locateFile: (fn: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${fn}` });
                const db = new SQL.Database(new Uint8Array(buf));
                setPct(40);

                // Customers
                const cr = db.exec("SELECT aname,address,phone,email_id FROM account_detail WHERE a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%'");
                if (cr[0]) {
                    const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = cr[0].values.map((r: any[], i: number) => ({ id:`C-${Date.now()}-${i}`, name:r[0]||'', address:r[1]||'', phone:r[2]||'', email:r[3]||'', from:'Soltol DB' })).filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(CK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} customers`);
                }
                setPct(55);

                // Suppliers
                const sr = db.exec("SELECT aname,address,phone,email_id FROM account_detail WHERE a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%'");
                if (sr[0]) {
                    const ex: any[] = JSON.parse(localStorage.getItem(SK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = sr[0].values.map((r: any[], i: number) => ({ id:`S-${Date.now()}-${i}`, name:r[0]||'', address:r[1]||'', phone:r[2]||'', from:'Soltol DB' })).filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(SK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} suppliers`);
                }
                setPct(70);

                // Products
                const pr = db.exec("SELECT item,units_name,sku,item_desc FROM item_measure WHERE item IS NOT NULL AND TRIM(item)!=''");
                if (pr[0]) {
                    const ex: any[] = JSON.parse(localStorage.getItem(PK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                    const add = pr[0].values.map((r: any[], i: number) => ({ id:`P-${Date.now()}-${i}`, name:r[0]||'', sku:r[2]||'', description:r[1]||'', category:'Imported', pricing:{sellingPrice:0,purchasePriceExWorks:0}, locations:[{name:'Main Warehouse',currentStock:0}], from:'Soltol DB' })).filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                    localStorage.setItem(PK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} products`);
                }
                setPct(85);

                // Transactions
                const ir = db.exec("SELECT v_id,amount,date,narration,v_type,vch_no FROM vouchers WHERE v_type IN ('Sales','Receipt','Purchase','Sales Return','Payment','Journal') LIMIT 2000");
                if (ir[0]) {
                    const ex: any[] = JSON.parse(localStorage.getItem(IK) || '[]');
                    const exN = new Set(ex.map((x: any) => x.vno));
                    const add = ir[0].values.map((r: any[]) => ({ id:`I-${r[0]}`, vno:r[5]||`I-${r[0]}`, amount:r[1]||0, date:r[2]||'', type:r[4]||'', note:r[3]||'', from:'Soltol DB' })).filter((x: any) => !exN.has(x.vno));
                    localStorage.setItem(IK, JSON.stringify([...ex, ...add]));
                    log.push(`${add.length} transactions`);
                }
                db.close();

            } else if (ext === 'csv') {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                const nameF = headers.find(h => h === 'name' || h.includes('company') || h.includes('customer')) || headers[0];
                const rows = lines.slice(1).map(l => { const v = l.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')); return Object.fromEntries(headers.map((h, i) => [h, v[i] || ''])); });
                const ex: any[] = JSON.parse(localStorage.getItem(CK) || '[]');
                const exN = new Set(ex.map((x: any) => x.name?.toLowerCase()));
                const add = rows.map((r, i) => ({ id:`CSV-${Date.now()}-${i}`, name:r[nameF]||'', email:r.email||r['e-mail']||'', phone:r.phone||r.mobile||'', address:r.address||r.street||'', from:`CSV: ${file.name}` })).filter((x: any) => x.name && !exN.has(x.name.toLowerCase()));
                if (add.length) { localStorage.setItem(CK, JSON.stringify([...ex, ...add])); log.push(`${add.length} records`); }

            } else {
                throw new Error(`Format .${ext} requires Excel conversion to CSV first. Save your Excel file as CSV and re-upload.`);
            }

            setPct(100);
            setCounts({ c: getCount(CK), s: getCount(SK), p: getCount(PK), i: getCount(IK) });
            setDone(log.length ? log.join(' · ') + ' imported successfully' : 'File read but no new records found (all may already exist)');
        } catch (e: any) {
            setErr(e.message || 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    const tpl = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['Name,Email,Phone,Address\nJohn Auto,john@test.com,555-0001,123 Main St\n'], { type: 'text/csv' }));
        a.download = 'soltol_import_template.csv';
        a.click();
    };

    return (
        <div className="space-y-5">
            {/* Title */}
            <div className="bg-gray-900 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Database size={20} className="text-blue-400" />
                </div>
                <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">Data Migration Center</p>
                    <p className="text-gray-400 text-xs">Import from Soltol DB · QuickBooks · Dynamics · NetSuite · Cin7 · CSV</p>
                </div>
            </div>

            {/* Imported counts */}
            <div className="grid grid-cols-4 gap-3">
                {[['Customers',counts.c],['Suppliers',counts.s],['Products',counts.p],['Transactions',counts.i]].map(([l,n]) => (
                    <div key={l as string} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                        <p className="text-xl font-black text-gray-900">{n}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{l} imported</p>
                    </div>
                ))}
            </div>

            {/* Source picker */}
            <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Step 1 — Select your previous software</p>
                <div className="grid grid-cols-3 gap-2">
                    {SRCS.map(s => (
                        <button key={s.id} onClick={() => { setSel(s.id); setFile(null); setDone(''); setErr(''); }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${sel===s.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                            <span className="text-lg flex-shrink-0">{s.icon}</span>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 leading-tight truncate">{s.name}</p>
                                <p className="text-[9px] text-gray-400">{s.fmt}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* How to export */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 items-start">
                <span className="text-base flex-shrink-0">💡</span>
                <div>
                    <p className="text-xs font-black text-blue-800">How to get your file from {src.name}:</p>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">{src.tip}</p>
                </div>
            </div>

            {/* Drop zone */}
            <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Step 2 — Upload your file</p>
                <div
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById(inputId)?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${drag ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}>
                    <input id={inputId} type="file" accept={src.fmt} className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setDone(''); setErr(''); } }} />
                    {file ? (
                        <>
                            <p className="text-2xl mb-1">✅</p>
                            <p className="text-sm font-black text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB ready</p>
                            <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-1 text-xs text-red-400 font-bold">✕ Remove</button>
                        </>
                    ) : (
                        <>
                            <Upload size={28} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-black text-gray-500">Drop your file here or click to browse</p>
                            <p className="text-xs text-gray-300 mt-1">Accepted: {src.fmt}</p>
                        </>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            {busy && (
                <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-black text-gray-700">Importing... {pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}

            {/* Success */}
            {done && !busy && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start">
                    <span className="text-xl">✅</span>
                    <div>
                        <p className="text-sm font-black text-emerald-800">Import Complete!</p>
                        <p className="text-xs text-emerald-700 mt-0.5">{done}</p>
                        <p className="text-xs text-emerald-600 mt-1">Go to Customers / Products / Suppliers to see your data.</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {err && !busy && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-black text-red-800">❌ Import Failed</p>
                    <p className="text-xs text-red-700 mt-1">{err}</p>
                </div>
            )}

            {/* Import button */}
            <button onClick={doImport} disabled={!file || busy}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {busy
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing, please wait...</>
                    : <><Upload size={16} /> Import from {src.name}</>
                }
            </button>

            {/* Template download */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div>
                    <p className="text-xs font-black text-gray-700">Need a CSV template?</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Download, fill in your data, then upload</p>
                </div>
                <button onClick={tpl}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-700 hover:bg-gray-100 transition-all">
                    ↓ Download Template
                </button>
            </div>
        </div>
    );
}
