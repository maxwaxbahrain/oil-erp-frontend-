import { useNavigate } from 'react-router-dom';
import { Zap, Send, Users, ArrowRight, ExternalLink } from 'lucide-react';

const CHANNELS = [
    {
        id: 'facebook',
        name: 'Facebook',
        emoji: '📘',
        color: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        desc: 'Posts, ads & stories',
        platformUrl: 'https://www.facebook.com/profile.php',
        businessUrl: 'https://business.facebook.com',
        createUrl: 'https://www.facebook.com/',
        tips: 'Best for B2B product showcases & customer testimonials',
    },
    {
        id: 'instagram',
        name: 'Instagram',
        emoji: '📸',
        color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
        hoverColor: 'hover:opacity-90',
        bgLight: 'bg-pink-50',
        borderColor: 'border-pink-200',
        textColor: 'text-pink-700',
        desc: 'Reels, posts & stories',
        platformUrl: 'https://www.instagram.com',
        businessUrl: 'https://business.instagram.com',
        createUrl: 'https://www.instagram.com',
        tips: 'Perfect for product photos & behind-the-scenes content',
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        emoji: '🎵',
        color: 'bg-gray-900',
        hoverColor: 'hover:bg-gray-800',
        bgLight: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700',
        desc: 'Short video content',
        platformUrl: 'https://www.tiktok.com',
        businessUrl: 'https://www.tiktok.com/business',
        createUrl: 'https://www.tiktok.com',
        tips: 'Short demos of your oil products & warehouse operations',
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        emoji: '💼',
        color: 'bg-blue-700',
        hoverColor: 'hover:bg-blue-800',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        desc: 'B2B & professional posts',
        platformUrl: 'https://www.linkedin.com/company',
        businessUrl: 'https://business.linkedin.com',
        createUrl: 'https://www.linkedin.com/feed',
        tips: 'Target fleet managers, auto workshop owners & mechanics',
    },
    {
        id: 'youtube',
        name: 'YouTube',
        emoji: '▶️',
        color: 'bg-red-600',
        hoverColor: 'hover:bg-red-700',
        bgLight: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        desc: 'Video content & descriptions',
        platformUrl: 'https://studio.youtube.com',
        businessUrl: 'https://studio.youtube.com',
        createUrl: 'https://studio.youtube.com',
        tips: 'Product demos, oil change guides & supplier factory tours',
    },
    {
        id: 'x',
        name: 'X',
        emoji: '𝕏',
        color: 'bg-gray-900',
        hoverColor: 'hover:bg-gray-800',
        bgLight: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700',
        desc: 'Short posts & timely updates',
        platformUrl: 'https://x.com',
        businessUrl: 'https://x.com',
        createUrl: 'https://x.com',
        tips: 'Hook first, a link or CTA, and light hashtags',
    },
    {
        id: 'google',
        name: 'Google',
        emoji: '🔍',
        color: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        desc: 'Business Profile posts & search ads',
        platformUrl: 'https://business.google.com',
        businessUrl: 'https://business.google.com',
        createUrl: 'https://business.google.com',
        tips: 'Local search posts and product highlights for workshops',
    },
    {
        id: 'email',
        name: 'Email',
        emoji: '📧',
        color: 'bg-purple-600',
        hoverColor: 'hover:bg-purple-700',
        bgLight: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-700',
        desc: 'Newsletter & sequences',
        platformUrl: 'https://mailchimp.com',
        businessUrl: 'https://mailchimp.com/features/email/',
        createUrl: 'https://mailchimp.com/create/',
        tips: 'Monthly newsletters & new product arrivals via Mailchimp',
    },
];

const FEATURES = [
    { icon: Zap, title: 'AI Content Studio', desc: 'Generate posts, captions, emails & SMS for all 8 channels at once', path: '/marketing/studio', badge: 'AI', badgeColor: 'bg-purple-600' },
    { icon: Send, title: 'Queue', desc: 'Review, approve, and archive generated drafts', path: '/marketing/campaigns', badge: 'New', badgeColor: 'bg-emerald-600' },
    { icon: Users, title: 'Customer Segments', desc: 'Auto-segment customers by spend, recency & channel readiness', path: '/marketing/segments', badge: 'Smart', badgeColor: 'bg-blue-600' },
];

export default function MarketingHub() {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-[1200px] mx-auto pb-12 animate-in fade-in duration-300">

            {/* Hero */}
            <div className="bg-gray-900 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500" />
                <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-4xl">📣</span>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">AI Marketing Suite</h1>
                            <p className="text-gray-400 text-sm">8 channels · AI-generated content</p>
                        </div>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-2xl mb-5">
                        Your AI agent uses your product catalog and customer count, then creates targeted content for every platform. Generate all 8 channels in one click.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => navigate('/marketing/studio')}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-black text-sm hover:bg-gray-100 transition-all shadow-lg">
                            <Zap size={16} className="text-purple-600" /> Launch AI Content Studio
                        </button>
                        <button onClick={() => navigate('/marketing/campaigns')}
                            className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-sm transition-all">
                            <Send size={16} /> Create Campaign
                        </button>
                    </div>
                </div>
            </div>

            {/* Channel Cards */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Platform Shortcuts</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Opens the platform's website — publishing from SOLTOL arrives in Phase 2.</p>
                    </div>
                    <button onClick={() => navigate('/marketing/studio')}
                        className="flex items-center gap-1.5 text-xs font-black text-purple-600 hover:text-purple-800 transition-all">
                        Generate Content for All <ArrowRight size={12} />
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CHANNELS.map((ch) => (
                        <div key={ch.id} className={`bg-white border-2 ${ch.borderColor} rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all group`}>
                            {/* Platform icon + open button */}
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-12 h-12 ${ch.color} rounded-xl flex items-center justify-center text-2xl shadow-sm`}>
                                    {ch.emoji}
                                </div>
                                <a href={ch.platformUrl} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-lg ${ch.bgLight} ${ch.textColor} hover:shadow-sm transition-all border ${ch.borderColor}`}
                                    onClick={e => e.stopPropagation()}>
                                    Open <ExternalLink size={9} />
                                </a>
                            </div>

                            <p className="text-sm font-black text-gray-900">{ch.name}</p>
                            <p className="text-[10px] text-gray-400 mb-2">{ch.desc}</p>

                            <p className="text-[10px] text-gray-500 leading-relaxed mb-3 hidden group-hover:block">{ch.tips}</p>

                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => navigate(`/marketing/studio?channel=${ch.id}`)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-black text-white rounded-lg ${ch.color} ${ch.hoverColor} transition-all`}>
                                    <Zap size={10} /> Create
                                </button>
                                <a href={ch.businessUrl} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center justify-center gap-1 px-2.5 py-2 text-[10px] font-black ${ch.textColor} ${ch.bgLight} rounded-lg border ${ch.borderColor} hover:shadow-sm transition-all`}>
                                    <ExternalLink size={9} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Cards */}
            <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">AI Marketing Tools</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={i} onClick={() => navigate(f.path)}
                                className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${f.badgeColor}`}>{f.badge}</span>
                                </div>
                                <h3 className="text-sm font-black text-gray-900 mb-1">{f.title}</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
                                <div className="flex items-center gap-1 mt-3 text-xs font-black text-gray-400 group-hover:text-gray-700 group-hover:gap-2 transition-all">
                                    Open <ArrowRight size={12} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick links */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Popular Marketing Tools (External)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { name: 'Mailchimp', desc: 'Email campaigns', url: 'https://mailchimp.com', emoji: '🐒' },
                        { name: 'WhatsApp Business', desc: 'Bulk messaging', url: 'https://business.whatsapp.com', emoji: '💬' },
                        { name: 'Meta Business', desc: 'FB + IG ads', url: 'https://business.facebook.com', emoji: '📘' },
                        { name: 'Twilio', desc: 'SMS marketing', url: 'https://www.twilio.com', emoji: '📱' },
                        { name: 'Brevo', desc: 'Email + SMS', url: 'https://www.brevo.com', emoji: '✉️' },
                        { name: 'Canva', desc: 'Design posts', url: 'https://www.canva.com', emoji: '🎨' },
                        { name: 'TikTok Business', desc: 'Video ads', url: 'https://www.tiktok.com/business', emoji: '🎵' },
                        { name: 'LinkedIn Ads', desc: 'B2B marketing', url: 'https://business.linkedin.com', emoji: '💼' },
                    ].map((tool, i) => (
                        <a key={i} href={tool.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group">
                            <span className="text-xl">{tool.emoji}</span>
                            <div>
                                <p className="text-xs font-black text-gray-800 group-hover:text-gray-900">{tool.name}</p>
                                <p className="text-[10px] text-gray-400">{tool.desc}</p>
                            </div>
                            <ExternalLink size={11} className="text-gray-300 ml-auto group-hover:text-gray-500 transition-all" />
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
