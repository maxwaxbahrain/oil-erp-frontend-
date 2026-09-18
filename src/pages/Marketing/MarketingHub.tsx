import { useNavigate } from 'react-router-dom';
import { Zap, Send, Users, ArrowRight, ExternalLink } from 'lucide-react';

// Official Facebook brand mark. Sized to 24px to match the text-2xl emoji
// glyphs the other channel cards render.
function FacebookMark() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6 text-white">
            <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2C11.54 2 9.68 3.66 9.68 6.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V7.05c0-1.05.28-1.73 1.76-1.73Z" />
        </svg>
    );
}

function LinkedInMark() {
    return (
        <svg viewBox="0 0 448 512" fill="currentColor" role="img" aria-label="LinkedIn" className="w-6 h-6 text-white">
            <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
        </svg>
    );
}

function InstagramMark() {
    return (
        <svg viewBox="0 0 448 512" fill="currentColor" role="img" aria-label="Instagram" className="w-6 h-6 text-white">
            <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
        </svg>
    );
}

function TikTokMark() {
    return (
        <svg viewBox="0 0 448 512" fill="currentColor" role="img" aria-label="TikTok" className="w-6 h-6 text-white">
            <path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14Z" />
        </svg>
    );
}

function YouTubeMark() {
    return (
        <svg viewBox="0 0 576 512" fill="currentColor" role="img" aria-label="YouTube" className="w-6 h-6 text-white">
            <path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" />
        </svg>
    );
}

// Multicolour Google "G". Needs a light tile, hence iconBg: 'bg-white' on the
// channel entry — the card's own brand colour is left untouched.
function GoogleMark() {
    return (
        <svg viewBox="0 0 48 48" role="img" aria-label="Google" className="w-6 h-6">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
        </svg>
    );
}

function EmailMark() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Email" className="w-6 h-6 text-white">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
    );
}

const CHANNELS = [
    {
        id: 'facebook',
        name: 'Facebook',
        emoji: '📘',
        icon: <FacebookMark />,
        iconBg: 'bg-[#1877F2]',
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
        icon: <InstagramMark />,
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
        icon: <TikTokMark />,
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
        icon: <LinkedInMark />,
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
        icon: <YouTubeMark />,
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
        icon: <GoogleMark />,
        iconBg: 'bg-white',
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
        icon: <EmailMark />,
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
                        <div key={ch.id} className={`bg-white border-2 ${ch.borderColor} rounded-2xl !p-4 shadow-sm hover:shadow-lg transition-all group`}>
                            {/* Platform icon + open button */}
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-12 h-12 ${ch.iconBg ?? ch.color} rounded-xl flex items-center justify-center text-2xl shadow-sm`}>
                                    {ch.icon ?? ch.emoji}
                                </div>
                                <a href={ch.platformUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:shadow-sm transition-all border border-blue-200"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={i} onClick={() => navigate(f.path)}
                                className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group h-full flex flex-col">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${f.badgeColor}`}>{f.badge}</span>
                                </div>
                                <h3 className="text-sm font-black text-gray-900 mb-1">{f.title}</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
                                <div className="flex items-center gap-1 mt-auto pt-3 text-xs font-black text-gray-400 group-hover:text-gray-700 group-hover:gap-2 transition-all">
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
