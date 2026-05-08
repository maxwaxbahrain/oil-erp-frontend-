import { useState } from 'react';
import {
    Shield,
    Bell,
    Database,
    ChevronRight,
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
                        { id: 'data', label: 'Data Persistence', icon: Database },
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
                                                <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Legal Entity Name</label>
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
                                            <p className="text-[10px] text-redwood-secondary font-bold leading-relaxed italic opacity-80 uppercase tracking-widest">Signatures represent legally binding authorization within the ZAVI ERP framework. Ensure credentials align with corporate governance policies.</p>
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

                    {(activeTab === 'security' || activeTab === 'data' || activeTab === 'notifications') && (
                        <div className="flex flex-col items-center justify-center p-20 bg-white border border-redwood-border rounded-sm shadow-sm text-center">
                            <Zap size={48} className="text-redwood-brand mb-6 animate-pulse" />
                            <h3 className="text-xl font-black text-redwood-text-main uppercase tracking-tighter">Domain Under Development</h3>
                            <p className="text-[11px] text-redwood-text-muted font-bold uppercase tracking-widest mt-2 max-w-sm leading-relaxed">The {activeTab} control matrix is currently in a high-density development phase. Configuration protocols will be available in the next lifecycle update.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
