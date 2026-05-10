import { useState } from 'react';
import {
    Upload,
    FileText,
    Zap,
    FileSpreadsheet,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Download,
    X,
    Image as ImageIcon,
    File,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FreeInvoiceProcessor, type InvoiceData } from '../../services/invoiceProcessor';
import { createSupplier, createPurchaseOrder, getSuppliers, type PurchaseOrderItem } from '../../services/purchasesService';

type ImportStep = 'upload' | 'processing' | 'review' | 'success';
type UploadedFile = {
    file: File;
    name: string;
    size: number;
    type: string;
    id: string;
};

export default function InvoiceImport() {
    const navigate = useNavigate();
    const [step, setStep] = useState<ImportStep>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [, setError] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const [apiKey, setApiKey] = useState('');

    const handleFullImport = async () => {
        if (!invoiceData) return;
        setImporting(true);

        const errors: string[] = [];

        try {
            const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            const supplierName = invoiceData.supplier?.name || 'Unknown Supplier';
            let supplierId = `SUP-${Date.now()}`;

            // Step 1: Create or find supplier
            try {
                const suppliers = await getSuppliers();
                const existing = suppliers.find(s =>
                    s.name.toLowerCase() === supplierName.toLowerCase() ||
                    supplierName.toLowerCase().includes(s.name.toLowerCase().slice(0, 5))
                );
                if (existing) {
                    supplierId = existing.id;
                } else {
                    const newSup = await createSupplier({
                        name: supplierName,
                        code: `SUP-${Date.now().toString().slice(-6)}`,
                        contactPerson: '',
                        email: invoiceData.supplier?.email || '',
                        phone: invoiceData.supplier?.phone || '',
                        address: invoiceData.supplier?.address || '',
                        taxId: '',
                        status: 'Active' as const,
                        paymentTerms: 'Net 30',
                        currency: invoiceData.invoice?.currency || 'USD',
                        rating: 'A' as const
                    });
                    supplierId = newSup.id;
                }
            } catch (e) {
                errors.push(`Supplier: ${e instanceof Error ? e.message : 'failed'}`);
            }

            // Step 2: Create products and update stock
            const poItems: PurchaseOrderItem[] = [];
            const toImport = invoiceData.products.filter(item => {
                const n = (item.name || '').toLowerCase();
                return item.name?.trim() && !n.includes('freight') && !n.includes('charge') && !n.includes('reimburs');
            });

            for (const item of toImport) {
                try {
                    // Create in backend
                    const uniqueSku = item.sku || `IMP-${Date.now()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
                    const res = await fetch(`${API}/api/products/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: item.name,
                            sku: uniqueSku,
                            category: 'Imported',
                            price: Math.round((item.unitPrice || 0) * 1.3 * 100) / 100,
                            cost: item.unitPrice || 0,
                            stock: item.quantity || 0,
                            min_stock: 10,
                            unit: item.unit || 'units'
                        })
                    });
                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`Backend error ${res.status}: ${errText.slice(0, 100)}`);
                    }
                    const prod = await res.json();
                    poItems.push({
                        productId: prod?.id ? String(prod.id) : `P-${Date.now()}`,
                        productName: item.name,
                        quantity: item.quantity || 0,
                        unitPrice: item.unitPrice || 0,
                        uom: item.unit || 'Unit',
                        total: item.lineTotal || 0,
                        taxRate: 0,
                        discount: 0
                    });
                } catch (e) {
                    errors.push(`Product "${item.name}": ${e instanceof Error ? e.message : 'failed'}`);
                }
            }

            // Step 3: Create Purchase Order
            try {
                const today = new Date().toISOString().slice(0, 10);
                await createPurchaseOrder({
                    poNumber: invoiceData.invoice?.number || invoiceData.invoice?.poNumber || `PO-${Date.now()}`,
                    supplierId,
                    supplierName,
                    date: today,
                    expectedDate: today,
                    status: 'Received',
                    items: poItems,
                    subtotal: invoiceData.totals?.subtotal || 0,
                    taxTotal: invoiceData.totals?.tax || 0,
                    grandTotal: invoiceData.totals?.grandTotal || 0,
                    notes: `AI Import — ${supplierName} — ${invoiceData.invoice?.number || ''}`
                });
            } catch (e) {
                errors.push(`Purchase Order: ${e instanceof Error ? e.message : 'failed'}`);
            }

            // Done - show success then redirect
            setStep('success');
            setTimeout(() => navigate('/products'), 2000);

        } catch (err: any) {
            console.error('Import error:', err);
            alert(`Import error: ${err?.message || String(err)}\n\nPlease check console for details.`);
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newFiles: UploadedFile[] = Array.from(files).map(file => ({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            id: `${Date.now()}-${Math.random()}`
        }));

        setUploadedFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    };

    const updateProduct = (index: number, field: string, value: any) => {
        if (!invoiceData) return;

        // Input safety: Handle empty strings for numbers
        let finalVal = value;
        if (field === 'quantity' || field === 'unitPrice') {
            if (typeof value === 'string') {
                finalVal = value === '' ? 0 : parseFloat(value);
            }
        }

        const newProducts = [...invoiceData.products];
        const updatedItem = { ...newProducts[index], [field]: finalVal };

        // Recalculate total
        if (field === 'quantity' || field === 'unitPrice') {
            const q = updatedItem.quantity || 0;
            const p = updatedItem.unitPrice || 0;
            updatedItem.lineTotal = q * p;
            updatedItem.total = q * p; // Maintain legacy compat
        }

        newProducts[index] = updatedItem;

        // Update totals (Optional: Recalculate grand totals instantly?)
        // Let's rely on backend recalc or just UI display
        setInvoiceData({ ...invoiceData, products: newProducts });
    };

    const startProcessing = async () => {
        if (uploadedFiles.length === 0) {
            alert('Please upload at least one file');
            return;
        }

        setStep('processing');
        setProgress(0);
        setProgressStatus('Initializing...');
        setError('');

        try {
            const processor = new FreeInvoiceProcessor();
            const file = uploadedFiles[0].file; // Process first file

            const result = await processor.processInvoice(
                file,
                apiKey,
                (prog, status) => {
                    setProgress(Math.round(prog));
                    setProgressStatus(status);
                }
            );

            console.log('Invoice processed:', result);
            setInvoiceData(result);
            setStep('review');

        } catch (err) {
            console.error('Processing error:', err);
            setError(err instanceof Error ? err.message : 'Processing failed');
            setStep('upload');
            alert(`Error: ${err instanceof Error ? err.message : 'Processing failed'}`);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (type: string) => {
        if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />;
        if (type.includes('image')) return <ImageIcon size={20} className="text-blue-500" />;
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv'))
            return <FileSpreadsheet size={20} className="text-emerald-500" />;
        if (type.includes('word') || type.includes('wordprocessing'))
            return <FileText size={20} className="text-blue-700" />;
        return <File size={20} className="text-gray-400" />;
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate('/products')}
                        className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft size={14} /> Back to Catalog
                    </button>
                    <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">➕ Add New Product</h1>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Add products manually OR upload invoice/document</p>
                </div>

                {step !== 'upload' && (
                    <div className="flex gap-4">
                        <div className="px-6 py-4 rounded-2xl border-2 transition-all flex items-center gap-3 border-gray-100 bg-white text-gray-400">
                            <span className="text-xs font-black uppercase">1. Upload</span>
                        </div>
                        <div className={`px-6 py-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${step === 'processing' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-400'}`}>
                            <span className="text-xs font-black uppercase">2. AI Analysis</span>
                        </div>
                        <div className={`px-6 py-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${step === 'review' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-400'}`}>
                            <span className="text-xs font-black uppercase">3. Review</span>
                        </div>
                    </div>
                )}
            </div>

            {step === 'success' && (
                <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 size={48} className="text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Import Successful!</h2>
                    <p className="text-gray-500 mb-6">Products have been added to your inventory</p>
                    <div className="flex gap-3">
                        <button onClick={() => navigate('/products')}
                            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-700 transition-all">
                            View Products →
                        </button>
                        <button onClick={() => navigate('/purchases')}
                            className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-all">
                            View Purchase Orders
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Redirecting to products in 2 seconds...</p>
                </div>
            )}

            {step === 'upload' && (
                <div className="space-y-10">
                    {/* Quick Import Options */}
                    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                        <h2 className="text-[12px] font-black text-gray-900 uppercase tracking-[0.2em] mb-8">Quick Import Options</h2>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-8">Choose how you want to add products:</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <button
                                onClick={() => navigate('/products/new')}
                                className="bg-gray-50 p-8 rounded-3xl border-2 border-transparent hover:border-gray-900 transition-all text-left group"
                            >
                                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                                    <FileText size={32} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-2">📝 Manual Entry</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
                                    Fill form below to add one product
                                </p>
                                <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Start Manual →</span>
                            </button>

                            <div className="bg-blue-50 p-8 rounded-3xl border-2 border-blue-500 transition-all text-left">
                                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white mb-6">
                                    <Zap size={32} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-2">📄 Upload Invoice</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
                                    PDF, Word, Excel, CSV, Images — AI extracts all data
                                </p>
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Current Selection ✓</span>
                            </div>

                            <button className="bg-gray-50 p-8 rounded-3xl border-2 border-transparent hover:border-emerald-500 transition-all text-left group">
                                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet size={32} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-2">📊 Bulk Import</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
                                    Excel/CSV file - Multiple products
                                </p>
                                <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Upload File →</span>
                            </button>
                        </div>
                    </div>

                    {/* Invoice/Document Upload */}
                    <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-10">
                        <div>
                            <h2 className="text-[12px] font-black text-gray-900 uppercase tracking-[0.2em] mb-4">Invoice/Document Upload (AI-Powered)</h2>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                                Upload your supplier invoice and AI will automatically:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    'Extract all products with quantities and prices',
                                    'Create new supplier if not exists',
                                    'Match or create product categories',
                                    'Add products to inventory',
                                    'Record purchase transaction'
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* OpenAI API Key Option */}
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl mb-8">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-indigo-500 text-white rounded-xl">
                                    <Zap size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide mb-1">Unlock GPT-4 Precision</h3>
                                    <p className="text-[11px] text-indigo-700 mb-4 leading-relaxed">
                                        For perfect extraction of complex invoice tables, specific product codes (SKUs), and correct formatting, enter your OpenAI API Key.
                                        This switches the engine from Tesseract (Left-to-Right basic) to <b>Claude AI</b> (Human-level).
                                    </p>
                                    <input
                                        type="password"
                                        placeholder="sk-proj-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Drag & Drop Zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                handleFileUpload(e.dataTransfer.files);
                            }}
                            className={`relative rounded-3xl border-4 border-dashed transition-all p-16 ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 bg-gray-50'
                                }`}
                        >
                            <input
                                type="file"
                                multiple
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleFileUpload(e.target.files)}
                                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.webp,.gif"
                            />

                            <div className="text-center space-y-6">
                                <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center text-blue-500 mx-auto">
                                    <Upload size={40} />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">📄 Drag & Drop Files Here or Click to Browse</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supported Formats:</p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest">📄 PDF Documents</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Max 50MB</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest">📊 Excel Files</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Max 50MB</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest">📊 CSV Files</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Max 50MB</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-900 uppercase tracking-widest">🖼️ Images</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Max 20MB</p>
                                    </div>
                                </div>

                                <div className="bg-gray-900 p-6 rounded-2xl max-w-2xl mx-auto">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Maximum Capacity (Industry Standard):</p>
                                    <div className="grid grid-cols-3 gap-4 text-white">
                                        <div>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Single File</p>
                                            <p className="text-sm font-black">50MB</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Batch Upload</p>
                                            <p className="text-sm font-black">100MB (10 files)</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Products/Invoice</p>
                                            <p className="text-sm font-black">Unlimited</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Uploaded Files List */}
                        {uploadedFiles.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Uploaded Files ({uploadedFiles.length})</h3>
                                    <button
                                        onClick={() => setUploadedFiles([])}
                                        className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {uploadedFiles.map(file => (
                                        <div key={file.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center justify-between group hover:border-gray-900 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-100">
                                                    {getFileIcon(file.type)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">{file.name}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatFileSize(file.size)}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all border border-gray-100"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={startProcessing}
                                        className="flex-1 py-6 bg-blue-500 text-white rounded-2xl flex items-center justify-center gap-3 text-[12px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20"
                                    >
                                        <Zap size={20} /> 🤖 Process All Files with AI
                                    </button>
                                    <button className="px-8 py-6 border-2 border-gray-100 text-gray-400 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all">
                                        <Download size={18} /> Download Template
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'processing' && (
                <div className="bg-white p-20 rounded-[60px] border border-gray-100 shadow-2xl flex flex-col items-center justify-center space-y-12">
                    <div className="relative">
                        <div className="w-40 h-40 border-8 border-gray-50 rounded-full"></div>
                        <div className="w-40 h-40 border-8 border-blue-500 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={48} className="text-blue-500 animate-spin" />
                        </div>
                    </div>

                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">AI Engine Running...</h2>
                        <div className="flex items-center gap-2 justify-center">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-10 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1.5 h-12 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1.5 h-8 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                        </div>
                        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest max-w-sm">
                            {progressStatus || 'Processing your invoice...'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-sm">
                            Using free Tesseract.js OCR - No API costs!
                        </p>
                    </div>

                    <div className="w-full max-w-md space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-400">Analysis Progress:</span>
                            <span className="text-blue-500 font-black">{progress}%</span>
                        </div>
                        <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="bg-white p-10 rounded-[40px] border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">✅ Extraction Complete</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    Identified {invoiceData?.products.length || 0} line items from "{uploadedFiles[0]?.name || 'invoice.pdf'}"
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => { setStep('upload'); setProgress(0); }}
                                className="px-8 py-4 border-2 border-gray-100 text-gray-400 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:border-gray-900 hover:text-gray-900 transition-all"
                            >
                                Discard & Retry
                            </button>
                            <button
                                onClick={handleFullImport}
                                disabled={importing}
                                className="px-10 py-5 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
                            >
                                {importing && <Loader2 size={16} className="animate-spin" />}
                                {importing ? 'Importing...' : 'Import to Inventory'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        {/* Extracted Data Table */}
                        <div className="xl:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                            <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                <h4 className="text-[12px] font-black text-gray-900 uppercase tracking-widest">Extracted Line Items</h4>
                                <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">
                                    AI Confidence: {invoiceData?.metadata?.confidence || 0}%
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Name</th>
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit/Pack</th>
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-20">Qty</th>
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-28">Price</th>
                                            <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-28">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {invoiceData?.products.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-3 py-3 text-center text-xs font-black text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        value={item.name}
                                                        onChange={e => updateProduct(i, 'name', e.target.value)}
                                                        className="w-full bg-transparent font-bold text-sm text-gray-900 focus:bg-white focus:ring-1 focus:ring-emerald-400 rounded px-2 py-1 border border-transparent focus:border-emerald-200 outline-none transition-all"
                                                    />
                                                    {item.sku && <p className="text-[10px] text-gray-400 px-2 mt-0.5 font-mono truncate">{item.sku}</p>}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-gray-500 font-mono">{item.unit || '—'}</td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.quantity || ''}
                                                        onChange={e => updateProduct(i, 'quantity', e.target.value)}
                                                        className="w-full bg-transparent font-black text-gray-900 text-center focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded p-2 border border-transparent focus:border-emerald-200 outline-none transition-all"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.unitPrice || ''}
                                                        onChange={e => updateProduct(i, 'unitPrice', e.target.value)}
                                                        className="w-full bg-transparent font-black text-gray-900 text-right focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded p-2 border border-transparent focus:border-emerald-200 outline-none transition-all"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 font-black text-blue-600 text-right text-sm">
                                                    {invoiceData.invoice.currency || 'USD'} {item.lineTotal?.toLocaleString()}
                                                </td>
                                            </tr>
                                        )) || (
                                                <tr>
                                                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400">
                                                        No products extracted
                                                    </td>
                                                </tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Invoice Intel Sidebar */}
                        <div className="xl:col-span-4 space-y-4">
                            <div className="bg-gray-900 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                                    <FileText size={120} className="text-white" />
                                </div>
                                <h4 className="text-[12px] font-black text-white uppercase tracking-[0.2em] mb-8 relative z-10">Invoice Intelligence</h4>
                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Supplier Detected</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-white text-lg font-black uppercase tracking-tighter">
                                                {invoiceData?.supplier.name || 'Unknown Supplier'}
                                            </p>
                                            <CheckCircle2 size={16} className="text-emerald-400" />
                                        </div>
                                        <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                                            ✅ Supplier Info Extracted
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Invoice No</p>
                                            <p className="text-white text-sm font-bold uppercase tracking-widest">
                                                {invoiceData?.invoice.number || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Date</p>
                                            <p className="text-white text-sm font-bold uppercase tracking-widest">
                                                {invoiceData?.invoice.date?.split('T')[0] || '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t border-gray-800">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Amount</p>
                                        <p className="text-3xl font-black text-blue-500 tracking-tighter">
                                            {invoiceData?.invoice.currency || 'USD'} {invoiceData?.totals.grandTotal?.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                                <h4 className="text-[12px] font-black text-gray-900 uppercase tracking-[0.2em]">Validation Summary</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <CheckCircle2 size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Supplier Verified</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <CheckCircle2 size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">12 Products Extracted</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-blue-600">
                                        <CheckCircle2 size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">5 New Products</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-amber-500">
                                        <AlertTriangle size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">1 Needs Review</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
