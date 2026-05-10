import { useNavigate } from 'react-router-dom';
import { 
    Megaphone, Zap, 
    ArrowRight, Users, BarChart2, Send
} from 'lucide-react';

const CHANNELS = [
    { icon: '📘', name: 'Facebook', desc: 'Posts, ads & stories', color: 'bg-blue-100 text-blue-700' },
    { icon: '📸', name: 'Instagram', desc: 'Reels, posts & DMs', color: 'bg-pink-100 text-pink-700' },
    { icon: '🎵', name: 'TikTok', desc: 'Short video content', color: 'bg-gray-100 text-gray-700' },
    { icon: '💼', name: 'LinkedIn', desc: 'B2B & professional posts', color: 'bg-blue-100 text-blue-800' },
    { icon: '▶️', name: 'YouTube', desc: 'Video descriptions & posts', color: 'bg-red-100 text-red-700' },
    { icon: '💬', name: 'WhatsApp', desc: 'Bulk messages & campaigns', color: 'bg-green-100 text-green-700' },
    { icon: '📱', name: 'SMS', desc: 'Text message campaigns', color: 'bg-amber-100 text-amber-700' },
    { icon: '📧', name: 'Email', desc: 'Newsletter & sequences', color: 'bg-purple-100 text-purple-700' },
];

const FEATURES = [
    { icon: Zap, title: 'AI Content Studio', desc: 'Generate platform-specific posts, captions, emails, SMS — all tailored to your oil business', path: '/marketing/studio', badge: 'AI Powered' },
    { icon: Send, title: 'Campaign Manager', desc: 'Create multi-channel campaigns, schedule them, track opens & clicks', path: '/marketing/campaigns', badge: 'Automate' },
    { icon: Users, title: 'Customer Segments', desc: 'Auto-segment your 160+ customers by spend, frequency, location for targeted campaigns', path: '/marketing/segments', badge: 'Smart' },
    { icon: BarChart2, title: 'Marketing Analytics', desc: 'Track reach, engagement, conversions across all channels in one dashboard', path: '/marketing/analytics', badge: 'Live' },
];

export default function MarketingHub() {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-[1100px] mx-auto pb-12 animate-in fade-in duration-500">

            {/* Hero */}
            <div className="bg-gray-900 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{background: 'radial-gradient(circle at 80% 50%, #ec4899 0%, #8b5cf6 40%, transparent 70%)'}} />
                <div className="relative flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center">
                        <Megaphone size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">AI Marketing Suite</h1>
                        <p className="text-gray-400 text-sm">8 channels · AI-generated content · Automated campaigns</p>
                    </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed max-w-2xl mb-6">
                    Your AI marketing agent reads your ERP — products, customers, sales data — then creates and schedules targeted content across every channel automatically. Like HubSpot + Klaviyo, built for oil distribution.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => navigate('/marketing/studio')}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-black text-sm hover:opacity-90 transition-all shadow-lg">
                        <Zap size={16} /> Launch AI Content Studio
                    </button>
                    <button onClick={() => navigate('/marketing/campaigns')}
                        className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-sm transition-all">
                        <Send size={16} /> Create Campaign
                    </button>
                </div>
            </div>

            {/* Channels */}
            <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Supported Channels</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CHANNELS.map((ch, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{ch.icon}</span>
                                <div>
                                    <p className="text-sm font-black text-gray-900">{ch.name}</p>
                                    <p className="text-[10px] text-gray-400">{ch.desc}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FEATURES.map((f, i) => {
                    const Icon = f.icon;
                    return (
                        <div key={i} onClick={() => navigate(f.path)}
                            className="bg-white border-2 border-gray-100 rounded-2xl p-5 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                    <Icon size={20} className="text-purple-600" />
                                </div>
                                <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{f.badge}</span>
                            </div>
                            <h3 className="text-sm font-black text-gray-900 mb-1">{f.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                            <div className="flex items-center gap-1 mt-3 text-xs font-black text-purple-600 group-hover:gap-2 transition-all">
                                Open <ArrowRight size={12} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* How AI works */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-4">How the AI Agent Works</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { step: '01', title: 'Reads Your ERP', desc: 'Products, customers, sales trends, top buyers' },
                        { step: '02', title: 'Understands Business', desc: 'Oil distributor NYC, KENZOL supplier, B2B focus' },
                        { step: '03', title: 'Creates Content', desc: 'Platform-specific posts, emails, SMS — all in your brand voice' },
                        { step: '04', title: 'Schedules & Sends', desc: 'Auto-post or queue for your approval first' },
                    ].map((s, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span className="text-2xl font-black text-purple-200">{s.step}</span>
                            <div>
                                <p className="text-sm font-black text-gray-800">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
