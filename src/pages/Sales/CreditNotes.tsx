import { FileText } from 'lucide-react';

export default function CreditNotes() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center">
                    <FileText size={24} className="text-rose-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Credit Notes</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">Manage returns and credit notes</p>
                </div>
            </div>

            <div className="bg-white p-12 rounded-lg border border-redwood-border shadow-sm text-center">
                <FileText size={48} className="mx-auto text-redwood-border mb-4" />
                <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Credit Note Management</h3>
                <p className="text-[13px] text-redwood-text-muted">Credit notes and returns management coming soon</p>
            </div>
        </div>
    );
}
