import { useState } from 'react';
import { FileText, Plus, Download, Mail, DollarSign, Calendar, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Sample invoice data
const sampleInvoices = [
    { id: 'INV-2024-0892', customer: 'ABC Retail Store', date: '2025-12-15', amount: 135135, status: 'Posted', balance: 135135 },
    { id: 'INV-2024-0891', customer: 'XYZ Mart', date: '2025-12-14', amount: 98500, status: 'Posted', balance: 0 },
    { id: 'INV-2024-0890', customer: 'MNQ Store', date: '2025-12-13', amount: 75200, status: 'Posted', balance: 75200 },
    { id: 'INV-2024-0889', customer: 'Global Foods', date: '2025-12-12', amount: 156000, status: 'Posted', balance: 0 },
];

export default function Invoices() {
    const navigate = useNavigate();
    const [invoices] = useState(sampleInvoices);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                            <FileText size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900">INVOICES</h1>
                            <p className="text-sm text-gray-500 font-semibold mt-1">SAP VF01 STYLE | LEGAL & ACCOUNTING DOCUMENTS</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/sales/invoices/new')}
                        className="px-8 py-4 bg-[#800020] text-white text-base font-black rounded-xl hover:bg-[#600018] transition-all flex items-center gap-3 shadow-xl"
                    >
                        <Plus size={20} /> Create New Invoice
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border-2 border-gray-300 shadow-md">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Total Invoices</div>
                    <div className="text-3xl font-black text-gray-900">{invoices.length}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border-2 border-emerald-300 shadow-md">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Total Revenue</div>
                    <div className="text-3xl font-black text-emerald-600">
                        ${invoices.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border-2 border-amber-300 shadow-md">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Outstanding</div>
                    <div className="text-3xl font-black text-amber-600">
                        ${invoices.reduce((sum, inv) => sum + inv.balance, 0).toLocaleString()}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border-2 border-blue-300 shadow-md">
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Paid Invoices</div>
                    <div className="text-3xl font-black text-blue-600">
                        {invoices.filter(inv => inv.balance === 0).length}
                    </div>
                </div>
            </div>

            {/* Invoice List */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200">
                <div className="px-6 py-4 bg-gradient-to-r from-[#800020] to-[#A0522D] flex justify-between items-center">
                    <h2 className="text-lg font-black text-white uppercase tracking-wide">Invoice List</h2>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white text-[#800020] text-sm font-black rounded-lg hover:bg-[#F4E4E6] transition-all">
                            Filter
                        </button>
                        <button className="px-4 py-2 bg-white text-[#800020] text-sm font-black rounded-lg hover:bg-[#F4E4E6] transition-all flex items-center gap-2">
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Invoice No</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-700 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-700 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-gray-700 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-center text-xs font-black text-gray-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {invoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-[#F4E4E6] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-base font-black text-[#800020] font-mono">{invoice.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-base font-bold text-gray-900">{invoice.customer}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <Calendar size={16} className="text-gray-400" />
                                            {invoice.date}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-lg font-black text-gray-900">${invoice.amount.toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`text-lg font-black ${invoice.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            ${invoice.balance.toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${invoice.status === 'Posted'
                                                ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                                                : 'bg-amber-100 text-amber-700 border-2 border-amber-400'
                                            }`}>
                                            {invoice.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => navigate(`/sales/invoices/${invoice.id}`)}
                                                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                                title="View Invoice"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                                title="Download PDF"
                                            >
                                                <Download size={18} />
                                            </button>
                                            <button
                                                className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                                                title="Email Invoice"
                                            >
                                                <Mail size={18} />
                                            </button>
                                            {invoice.balance > 0 && (
                                                <button
                                                    className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                                                    title="Record Payment"
                                                >
                                                    <DollarSign size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
