import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    DollarSign,
    ShoppingCart,
    Edit,
    Download,
    X,
    Eye,
    CheckCircle,
    Receipt,
    Save
} from 'lucide-react';
import {
    getCustomerInvoices,
    getCustomerSalesOrders,
    convertOrderToInvoice,
    type Invoice,
    type SalesOrder
} from '../../services/api';
import {
    getCustomers,
    getCustomerPayments,
    createPayment,
    type Customer,
    type Payment
} from '../../services/customerService';
import { WORLD_CURRENCIES } from '../../constants/currencies';
import SearchableSelect from '../../components/common/SearchableSelect';

interface CustomerStats {
    outstandingBalance: number;
    totalSalesYTD: number;
    creditLimit: number;
    creditUtilization: number;
    overdueAmount: number;
    overdueDays: number;
    lastPaymentAmount: number;
    lastPaymentDate: string;
    lastInvoiceDate: string;
}

interface LedgerEntry {
    id: string;
    date: string;
    type: 'Invoice' | 'Payment' | 'Credit Note' | 'Debit Note';
    referenceNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    relatedId?: string;
}



// PDF Generation for Ledger
const generateCustomerLedgerPDF = (customer: Customer, ledger: LedgerEntry[]) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Customer Ledger - ${customer.name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f0f0f0; padding: 10px; text-align: left; border: 1px solid #ddd; }
                td { padding: 8px; border: 1px solid #ddd; }
                .totals { background-color: #f9fafb; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Customer Ledger Statement</h1>
            <p><strong>Customer:</strong> ${customer.name}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${ledger.map(entry => `
                        <tr>
                            <td>${new Date(entry.date).toLocaleDateString()}</td>
                            <td>${entry.type}</td>
                            <td>${entry.referenceNumber}</td>
                            <td>${entry.debit > 0 ? '' + entry.debit.toLocaleString() : '-'}</td>
                            <td>${entry.credit > 0 ? '' + entry.credit.toLocaleString() : '-'}</td>
                            <td>${entry.balance.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    }
};

// Excel/CSV Generation
const generateCustomerLedgerExcel = (customer: Customer, ledger: LedgerEntry[]) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Customer Ledger - ${customer.name}\n\n`;
    csvContent += "Date,Type,Reference,Debit,Credit,Balance\n";

    ledger.forEach(entry => {
        csvContent += `${new Date(entry.date).toLocaleDateString()},`;
        csvContent += `${entry.type},${entry.referenceNumber},`;
        csvContent += `${entry.debit},${entry.credit},${entry.balance}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_${customer.code}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export default function CustomerOverview() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'sales' | 'payments'>('overview');
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    // Ledger state
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(false);

    // Stats state
    const [stats, setStats] = useState<CustomerStats>({
        outstandingBalance: 0,
        totalSalesYTD: 0,
        creditLimit: 0,
        creditUtilization: 0,
        overdueAmount: 0,
        overdueDays: 0,
        lastPaymentAmount: 0,
        lastPaymentDate: '',
        lastInvoiceDate: ''
    });

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

    // Modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | any>(null);
    const [converting, setConverting] = useState<string | null>(null);
    const [selectedCurrency, setSelectedCurrency] = useState(WORLD_CURRENCIES[0]); // Default to USD

    // Payment Form state
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        reference: '',
        notes: ''
    });

    // Check for tab parameter in URL
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab === 'ledger' || tab === 'sales' || tab === 'payments') {
            setActiveTab(tab);
        }
    }, [location.search]);

    // Fetch customer data
    useEffect(() => {
        const fetchCustomer = async () => {
            if (!id) return;

            try {
                setLoading(true);
                const customers = await getCustomers();
                const foundCustomer = customers.find((c: any) => c.id === id);

                if (foundCustomer) {
                    setCustomer(foundCustomer);
                } else {
                    alert('Customer not found');
                    navigate('/customers');
                }
            } catch (error) {
                console.error('Error fetching customer:', error);
                alert('Failed to load customer data');
                navigate('/customers');
            } finally {
                setLoading(false);
            }
        };

        fetchCustomer();
    }, [id, navigate]);

    // Load all customer data
    const loadAllData = async () => {
        if (!id) return;

        try {
            setLoadingLedger(true);

            // Fetch everything in parallel
            const [custInvoices, custOrders, custPayments] = await Promise.all([
                getCustomerInvoices(id),
                getCustomerSalesOrders(id),
                getCustomerPayments(id)
            ]);

            setInvoices(custInvoices);
            setSalesOrders(custOrders);
            setPayments(custPayments);

            // Build Ledger
            const allTransactions: any[] = [
                ...custInvoices.map(inv => ({
                    id: inv.id,
                    date: inv.invoiceDate,
                    type: 'Invoice' as const,
                    referenceNumber: inv.invoiceNumber,
                    description: `Sales Invoice - ${inv.lineItems.length} item(s)`,
                    debit: inv.grandTotal,
                    credit: 0
                })),
                ...custPayments.map(pay => ({
                    id: pay.id,
                    date: pay.payment_date,
                    type: 'Payment' as const,
                    referenceNumber: pay.reference || `PAY-${pay.id.slice(-4)}`,
                    description: `Payment Received - ${pay.payment_method}`,
                    debit: 0,
                    credit: pay.amount
                }))
            ];

            // Sort by date and calculate running balance
            const sortedTransactions = allTransactions.sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            let runningBalance = 0;
            const ledgerEntries: LedgerEntry[] = sortedTransactions.map(tx => {
                runningBalance += (tx.debit - tx.credit);
                return { ...tx, balance: runningBalance, relatedId: tx.id };
            });

            setLedger(ledgerEntries);

            // Calculate real stats from actual data
            const totalSales = custInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
            const creditLimit = customer?.credit_limit || 0;

            // Calculate overdue invoices (unpaid invoices older than 30 days)
            const today = new Date();
            const overdueInvoices = custInvoices.filter(inv => {
                const dueDate = new Date(inv.dueDate);
                const isOverdue = inv.status !== 'Paid' && dueDate < today;
                return isOverdue;
            });

            const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.grandTotal - (inv.amount_paid || 0)), 0);

            // Calculate oldest overdue days
            let oldestOverdueDays = 0;
            if (overdueInvoices.length > 0) {
                const oldestInvoice = overdueInvoices.reduce((oldest, inv) => {
                    const invDate = new Date(inv.dueDate);
                    const oldestDate = new Date(oldest.dueDate);
                    return invDate < oldestDate ? inv : oldest;
                });
                oldestOverdueDays = Math.floor((today.getTime() - new Date(oldestInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            }

            // Calculate credit utilization
            const creditUtilization = creditLimit > 0 ? Math.round((Math.abs(runningBalance) / creditLimit) * 100) : 0;

            // Update stats with calculated values
            setStats({
                outstandingBalance: runningBalance,
                totalSalesYTD: totalSales,
                creditLimit: creditLimit,
                creditUtilization: creditUtilization,
                overdueAmount: overdueAmount,
                overdueDays: oldestOverdueDays,
                lastPaymentAmount: custPayments.length > 0 ? custPayments[custPayments.length - 1].amount : 0,
                lastPaymentDate: custPayments.length > 0 ? custPayments[custPayments.length - 1].payment_date : '',
                lastInvoiceDate: custInvoices.length > 0 ? custInvoices[custInvoices.length - 1].invoiceDate : ''
            });

        } catch (error) {
            console.error('Failed to load customer data:', error);
        } finally {
            setLoadingLedger(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [id]);

    const handleReceivePayment = async () => {
        if (!id || paymentForm.amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setLoading(true);
            await createPayment({
                customer_id: id,
                amount: paymentForm.amount,
                payment_date: paymentForm.payment_date,
                payment_method: paymentForm.payment_method,
                reference: paymentForm.reference,
                notes: paymentForm.notes
            });

            setShowPaymentModal(false);
            setPaymentForm({
                amount: 0,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                reference: '',
                notes: ''
            });

            await loadAllData();
            alert('✅ Payment recorded successfully!');
        } catch (error) {
            console.error('Failed to record payment:', error);
            alert('❌ Failed to record payment');
        } finally {
            setLoading(false);
        }
    };

    const handleConvertOrder = async (orderId: string) => {
        try {
            setConverting(orderId);
            await convertOrderToInvoice(orderId);
            await loadAllData();
            alert('✅ Order converted to Invoice successfully!');
        } catch (error) {
            console.error('Failed to convert order:', error);
            alert('❌ Failed to convert order');
        } finally {
            setConverting(null);
        }
    };

    const handleDownloadLedger = (format: 'pdf' | 'excel') => {
        if (!customer) return;

        if (format === 'pdf') {
            generateCustomerLedgerPDF(customer, ledger);
        } else {
            generateCustomerLedgerExcel(customer, ledger);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-redwood-brand mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading customer...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-gray-600">Customer not found</p>
                    <button
                        onClick={() => navigate('/customers')}
                        className="mt-4 px-4 py-2 bg-redwood-brand text-white rounded-sm"
                    >
                        Back to Customers
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/customers')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                {customer.name}
                            </h1>
                            <span className="text-sm text-gray-500 font-bold">{customer.code || `CUST-${id?.slice(-4)}`}</span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                ACTIVE
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Customer Overview</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/sales/invoices/new', { state: { customerId: customer.id, customerName: customer.name } })}
                        className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-black hover:bg-orange-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <FileText size={18} />
                        New Invoice
                    </button>
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-black hover:bg-green-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <DollarSign size={18} />
                        Receive Payment
                    </button>
                    <button
                        onClick={() => navigate('/sales/orders/new', { state: { customerId: customer.id, customerName: customer.name } })}
                        className="px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-lg text-sm font-black hover:bg-yellow-500 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <ShoppingCart size={18} />
                        New Sales Order
                    </button>
                    <button
                        onClick={() => navigate(`/customers/edit/${customer.id}`)}
                        className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-black hover:bg-gray-900 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <Edit size={18} />
                        Edit Customer
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Outstanding Balance</div>
                    <div className="text-2xl font-black text-red-600 font-mono">
                        {stats.outstandingBalance.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Total Sales</div>
                    <div className="text-2xl font-black text-green-600 font-mono">
                        {stats.totalSalesYTD.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">This Year</div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Credit Limit</div>
                    <div className="text-2xl font-black text-gray-900 font-mono">
                        {stats.creditLimit.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                        Used: {stats.creditUtilization}%
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Overdue Amount</div>
                    <div className="text-2xl font-black text-red-600 font-mono">
                        {stats.overdueAmount.toLocaleString()}
                    </div>
                    <div className="text-xs text-red-500 mt-1">
                        {stats.overdueDays > 0 ? `${stats.overdueDays} days overdue` : 'No overdue'}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Last Payment</div>
                    <div className="text-2xl font-black text-blue-600 font-mono">
                        {stats.lastPaymentAmount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        {new Date(stats.lastPaymentDate).toLocaleDateString()}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Last Invoice</div>
                    <div className="text-lg font-bold text-gray-900">
                        {(() => {
                            const days = Math.floor((new Date().getTime() - new Date(stats.lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24));
                            return `${days} days ago`;
                        })()}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
                <div className="border-b border-gray-200 flex gap-1">
                    {[
                        { key: 'overview', label: 'Overview' },
                        { key: 'ledger', label: 'Ledger' },
                        { key: 'sales', label: 'Sales' },
                        { key: 'payments', label: 'Payments' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-6 py-4 text-sm font-black uppercase tracking-wider transition-all ${activeTab === tab.key
                                ? 'border-b-2 border-redwood-brand text-redwood-brand bg-redwood-brand/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-black text-gray-700 uppercase mb-4">Customer Information</h3>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase">Company</div>
                                        <div className="text-sm text-gray-900">{customer.name}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase">Email</div>
                                        <div className="text-sm text-blue-600">{(customer as any).email || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase">Phone</div>
                                        <div className="text-sm text-gray-900">{(customer as any).phone || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-black text-gray-700 uppercase mb-4">Address</h3>
                                <div className="text-sm text-gray-900">
                                    {(customer as any).address || 'N/A'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ledger Tab */}
                    {activeTab === 'ledger' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-black text-gray-700 uppercase">Customer Ledger</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownloadLedger('pdf')}
                                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-sm text-xs font-bold hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Download size={14} />
                                        Download PDF
                                    </button>
                                    <button
                                        onClick={() => handleDownloadLedger('excel')}
                                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-sm text-xs font-bold hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Download size={14} />
                                        Download Excel
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Reference</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Description</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Debit</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Credit</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Balance</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center w-20">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loadingLedger ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center">
                                                    <div className="text-sm text-gray-500">Loading ledger...</div>
                                                </td>
                                            </tr>
                                        ) : ledger.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center">
                                                    <div className="text-sm text-gray-500 font-bold">No transactions yet</div>
                                                    <p className="text-xs text-gray-400 mt-2">Create an invoice to see it here</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            ledger.map(entry => (
                                                <tr
                                                    key={entry.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        {new Date(entry.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.type === 'Invoice' ? 'bg-blue-100 text-blue-700' :
                                                            entry.type === 'Payment' ? 'bg-green-100 text-green-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-mono text-gray-900 font-bold">
                                                        {entry.referenceNumber}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{entry.description}</td>
                                                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right font-mono">
                                                        {entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-green-600 text-right font-mono">
                                                        {entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono">
                                                        {entry.balance.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {entry.type === 'Invoice' && (
                                                            <button
                                                                onClick={() => {
                                                                    const inv = invoices.find(i => i.id === entry.relatedId);
                                                                    if (inv) {
                                                                        setSelectedInvoice(inv);
                                                                        setShowInvoiceModal(true);
                                                                    }
                                                                }}
                                                                title="View Invoice"
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                        )}
                                                        {entry.type === 'Payment' && (
                                                            <button
                                                                title="View Receipt"
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                            >
                                                                <Receipt size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Sales Tab */}
                    {activeTab === 'sales' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center px-2">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-redwood-brand" />
                                    Sequential Sales Ledger
                                </h3>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Unified Order & Invoice Stream</div>
                            </div>
                            <div className="border border-gray-100 rounded-lg overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Document ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Items</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Operation Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Payment Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Value (PKR)</th>
                                            <th className="px-6 py-4 text-center w-40">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {/* Combine Invoices and Sales Orders into one list */}
                                        {[
                                            ...invoices.map(inv => ({ ...inv, docType: 'Invoice' as const })),
                                            ...salesOrders.map(so => ({ ...so, docType: 'SalesOrder' as const }))
                                        ]
                                            .sort((a, b) => new Date(b.docType === 'Invoice' ? (a as any).invoiceDate : (a as any).orderDate).getTime() - new Date(b.docType === 'Invoice' ? (b as any).invoiceDate : (b as any).orderDate).getTime())
                                            .length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No sequential sales records found.</td></tr>
                                        ) : (
                                            [
                                                ...invoices.map(inv => ({ ...inv, docType: 'Invoice' as const })),
                                                ...salesOrders.map(so => ({ ...so, docType: 'SalesOrder' as const }))
                                            ]
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.docType === 'Invoice' ? (a as any).invoiceDate : (a as any).orderDate).getTime();
                                                    const dateB = new Date(b.docType === 'Invoice' ? (b as any).invoiceDate : (b as any).orderDate).getTime();
                                                    return dateB - dateA;
                                                })
                                                .map((doc: any) => (
                                                    <tr key={doc.id} className="hover:bg-gray-50/50 group transition-colors">
                                                        <td className="px-6 py-4 text-xs font-black font-mono text-gray-900 group-hover:text-redwood-brand transition-colors">
                                                            {doc.docType === 'Invoice' ? doc.invoiceNumber : doc.orderNumber}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-gray-600">
                                                            {new Date(doc.docType === 'Invoice' ? doc.invoiceDate : doc.orderDate).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                                            {doc.lineItems.length} {doc.lineItems.length === 1 ? 'Item' : 'Items'}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {doc.docType === 'SalesOrder' ? (
                                                                <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter">
                                                                    🟡 Pending
                                                                </span>
                                                            ) : (
                                                                <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter">
                                                                    🟢 Sold
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {doc.docType === 'Invoice' ? (
                                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${doc.status === 'Paid' ? 'bg-blue-600 text-white' :
                                                                    doc.status === 'Overdue' ? 'bg-red-600 text-white' : 'bg-rose-500 text-white'
                                                                    }`}>
                                                                    {doc.status === 'Paid' ? '🔵 Paid' : '🔴 Unpaid'}
                                                                </span>
                                                            ) : (
                                                                <span className="px-3 py-1 bg-gray-100 text-gray-400 rounded-full text-[9px] font-black uppercase tracking-tighter">
                                                                    -
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-black text-gray-900 text-right font-mono">
                                                            {doc.grandTotal.toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (doc.docType === 'Invoice') {
                                                                            setSelectedInvoice(doc);
                                                                            setShowInvoiceModal(true);
                                                                        } else {
                                                                            // Show Sales Order Modal (reusing selected invoice state for now or handle separately)
                                                                            setSelectedInvoice(doc);
                                                                            setShowInvoiceModal(true);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-gray-300 hover:text-redwood-brand transition-colors"
                                                                >
                                                                    <Eye size={18} />
                                                                </button>
                                                                {doc.docType === 'SalesOrder' && doc.status === 'Pending' && (
                                                                    <button
                                                                        onClick={() => handleConvertOrder(doc.id)}
                                                                        disabled={converting === doc.id}
                                                                        className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black rounded uppercase hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
                                                                    >
                                                                        {converting === doc.id ? '...' : (
                                                                            <>
                                                                                <CheckCircle size={12} />
                                                                                Convert
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Payments Tab */}
                    {activeTab === 'payments' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-black text-gray-700 uppercase">Payment History</h3>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="px-3 py-1.5 bg-[#800020] text-white rounded-sm text-xs font-bold hover:brightness-95 flex items-center gap-2 shadow-sm"
                                >
                                    <DollarSign size={14} />
                                    Receive New Payment
                                </button>
                            </div>
                            <div className="border border-gray-200 rounded-sm overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Reference</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Method</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Amount</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center w-20">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payments.length === 0 ? (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No payments found</td></tr>
                                        ) : (
                                            payments.map(pay => (
                                                <tr key={pay.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(pay.payment_date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 text-sm font-bold font-mono">{pay.reference || `PAY-${pay.id.slice(-4)}`}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{pay.payment_method}</td>
                                                    <td className="px-4 py-3 text-sm font-bold text-right font-mono text-green-600">{pay.amount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button className="text-gray-400 hover:text-green-600">
                                                            <Receipt size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border-2 border-[#800020] overflow-hidden">
                        <div className="bg-[#800020] px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <DollarSign size={24} />
                                Receive Payment
                            </h2>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payment Amount (PKR)</label>
                                    <input
                                        type="number"
                                        value={paymentForm.amount || ''}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg font-bold focus:border-[#800020] outline-none transition-all font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payment Date</label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payment Method</label>
                                    <select
                                        value={paymentForm.payment_method}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none transition-all bg-white"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Ref / Trans #</label>
                                    <input
                                        type="text"
                                        value={paymentForm.reference}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none transition-all font-mono"
                                        placeholder="TXN-XXXX"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Notes (Optional)</label>
                                <textarea
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-medium focus:border-[#800020] outline-none transition-all resize-none"
                                    rows={2}
                                    placeholder="Add any additional details..."
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-100">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="px-6 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-100 transition-all uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReceivePayment}
                                disabled={loading || paymentForm.amount <= 0}
                                className="px-8 py-2.5 bg-[#800020] text-white rounded-lg text-sm font-black hover:bg-[#600018] transition-all flex items-center gap-2 shadow-lg uppercase tracking-wider disabled:opacity-50"
                            >
                                <Save size={18} />
                                {loading ? 'Saving...' : 'Save Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {showInvoiceModal && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl overflow-hidden">
                        <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <FileText size={20} className="text-blue-400" />
                                    Invoice Detail
                                </h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <button
                                onClick={() => { setShowInvoiceModal(false); setSelectedInvoice(null); }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer / Entity</p>
                                        <p className="text-xl font-black text-gray-900 leading-tight">{selectedInvoice.customerName}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">Registry Code: {customer.code}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 pt-2">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Instrument Date</p>
                                            <p className="text-xs font-black text-gray-700">{new Date(selectedInvoice.invoiceDate || selectedInvoice.orderDate).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Maturity Date</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 pt-2">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Field Salesman</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.salesman || 'Direct Office'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logistics / Van</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.van || 'Customer Pickup'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-6">
                                    <div className="inline-block px-4 py-1.5 bg-gray-50 border-2 border-dashed border-blue-500/30 rounded-full">
                                        <p className="text-[9px] font-black text-blue-800 uppercase text-center tracking-widest">{selectedInvoice.docType === 'Invoice' ? 'Sequential Invoice' : 'Pending Requisition'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Receivable</p>
                                        <p className="text-3xl font-black text-redwood-brand font-mono tracking-tighter">{selectedCurrency.symbol}{selectedInvoice.grandTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Statement Currency for Print/Share</label>
                                <div className="w-64">
                                    <SearchableSelect
                                        options={WORLD_CURRENCIES}
                                        value={selectedCurrency.code}
                                        onChange={(code) => {
                                            const curr = WORLD_CURRENCIES.find(c => c.code === code);
                                            if (curr) setSelectedCurrency(curr);
                                        }}
                                        displayKey="label"
                                        placeholder="Select settlement currency..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-gray-900 uppercase border-b border-gray-900 pb-2">Line Items</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase">Item Description</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-center w-20">Qty</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-right w-32">Rate</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-right w-32">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selectedInvoice.lineItems.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="py-4">
                                                        <p className="text-sm font-bold text-gray-900">{item.product}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                                    </td>
                                                    <td className="py-4 text-sm font-bold text-gray-700 text-center">{item.quantity}</td>
                                                    <td className="py-4 text-sm font-bold text-gray-600 text-right font-mono">{selectedCurrency.symbol}{item.rate.toLocaleString()}</td>
                                                    <td className="py-4 text-sm font-black text-gray-900 text-right font-mono">{selectedCurrency.symbol}{item.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="border-t-2 border-gray-900 pt-6 flex justify-end">
                                    <div className="w-64 space-y-3">
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                                            <span>Subtotal</span>
                                            <span className="font-mono text-gray-900 font-black">{selectedCurrency.symbol}{selectedInvoice.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                                            <span>Fiscal Levies</span>
                                            <span className="font-mono text-gray-900 font-black">{selectedCurrency.symbol}{selectedInvoice.taxAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-5 mt-2 border-t border-gray-100">
                                            <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Gross Total ({selectedCurrency.code})</span>
                                            <span className="text-2xl font-black text-redwood-brand font-mono tracking-tighter">{selectedCurrency.symbol}{selectedInvoice.grandTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedInvoice.notes && (
                                    <div className="mt-8 p-4 bg-gray-50 border-l-4 border-gray-300 rounded-r-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Notes</p>
                                        <p className="text-xs text-gray-600 leading-relaxed font-medium">{selectedInvoice.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex justify-between border-t border-gray-100 items-center">
                            <p className="text-[10px] font-bold text-gray-400 italic">Created on {new Date(selectedInvoice.createdAt).toLocaleString()}</p>
                            <button
                                onClick={() => window.print()}
                                className="px-6 py-2 bg-gray-900 text-white text-xs font-bold rounded-sm hover:bg-gray-800 transition-colors uppercase tracking-wider flex items-center gap-2"
                            >
                                <Download size={16} />
                                Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}