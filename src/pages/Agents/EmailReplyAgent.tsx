import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';

export default function EmailReplyAgent() {
    const navigate = useNavigate();

    return (
        <div className="max-w-[900px] mx-auto pb-10 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-2xl p-5 mb-4 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/agents')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        aria-label="Back to Agent Hub"
                    >
                        <ArrowLeft size={16} className="text-emerald-200" />
                    </button>
                    <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                        <Mail size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight">Email Auto-Reply</h1>
                        <p className="text-[11px] text-emerald-200/90">Email reply assistant not available.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
                <Mail size={36} className="text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-black text-gray-900">Email reply assistant not available.</h2>
                <p className="text-sm text-gray-500 mt-3 max-w-xl mx-auto leading-relaxed">
                    No email-reply backend endpoint is connected yet, so this page will not show canned incoming emails, generated replies, or simulated assistant output.
                </p>
            </div>
        </div>
    );
}
