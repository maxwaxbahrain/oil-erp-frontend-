import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Zap, Copy, Check, RefreshCw, Download } from 'lucide-react';
import { getProducts, getImportedProducts } from '../../services/productService';
import { getCustomers } from '../../services/api';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const CHANNELS = [
    { id: 'facebook',  label: 'Facebook',  icon: '📘', maxChars: 500,  tone: 'engaging and conversational', format: 'post with emojis, 3-4 paragraphs, call to action' },
    { id: 'instagram', label: 'Instagram', icon: '📸', maxChars: 300,  tone: 'visual and aspirational', format: 'short punchy caption with hashtags, lifestyle angle' },
    { id: 'tiktok',    label: 'TikTok',    icon: '🎵', maxChars: 200,  tone: 'energetic and trending', format: 'hook in first line, video script idea, trending hashtags' },
    { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', maxChars: 700,  tone: 'professional and authoritative', format: 'B2B angle, industry insight, professional tone, no hashtag spam' },
    { id: 'youtube',   label: 'YouTube',   icon: '▶️', maxChars: 500,  tone: 'informative and trustworthy', format: 'video title + description with keywords, chapters, CTA' },
    { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬', maxChars: 250,  tone: 'personal and direct', format: 'short friendly message, no spam feel, clear offer, WhatsApp emoji' },
    { id: 'sms',       label: 'SMS',       icon: '📱', maxChars: 160,  tone: 'ultra concise', format: 'under 160 chars, clear offer, link at end, no emojis' },
    { id: 'email',     label: 'Email',     icon: '📧', maxChars: 1000, tone: 'professional but warm', format: 'subject line + body, personalization placeholder [NAME], CTA button text' },
];

const CAMPAIGN_TYPES = [
    { id: 'product_promo', label: '🛢️ Product Promotion', desc: 'Promote a specific oil product' },
    { id: 'seasonal', label: '🌡️ Seasonal Campaign', desc: 'Summer/winter oil change season' },
    { id: 'new_arrival', label: '✨ New Product Launch', desc: 'Announce newly imported stock' },
    { id: 'loyalty', label: '🤝 Customer Loyalty', desc: 'Reward & retain top customers' },
    { id: 'bulk_deal', label: '📦 Bulk Order Deal', desc: 'Special pricing for large orders' },
    { id: 'flash_sale', label: '⚡ Flash Sale', desc: 'Limited time offer' },
    { id: 'educational', label: '📚 Educational Content', desc: 'Oil tips, maintenance guides' },
    { id: 'brand', label: '🏢 Brand Awareness', desc: 'Build Soltol brand presence' },
];

interface GeneratedContent {
    channelId: string;
    content: string;
    copied: boolean;
}

export default function AIContentStudio() {
    const navigate = useNavigate();
    const location = useLocation();
    const [products, setProducts] = useState<string[]>([]);
    const [customerCount, setCustomerCount] = useState(0);
    const [campaignType, setCampaignType] = useState('product_promo');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [targetAudience, setTargetAudience] = useState('B2B fleet managers and auto workshops in NYC');
    const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['facebook', 'instagram', 'whatsapp', 'email']));
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState<GeneratedContent[]>([]);
    const [activeContent, setActiveContent] = useState<string | null>(null);
    const [brandVoice, setBrandVoice] = useState('professional, trustworthy, expertise in premium lubricants');

    useEffect(() => {
        // Pre-select channel from URL param e.g. /marketing/studio?channel=whatsapp
        const params = new URLSearchParams(location.search);
        const preChannel = params.get('channel');
        if (preChannel && CHANNELS.find(c => c.id === preChannel)) {
            setSelectedChannels(new Set([preChannel]));
        }
    }, [location.search]);

    useEffect(() => {
        Promise.all([
            getImportedProducts(),
            getProducts().catch(() => []),
            getCustomers().catch(() => []),
        ]).then(([imported, all, custs]) => {
            const prods = [...imported, ...all].map(p => p.name).filter(Boolean);
            const unique = [...new Set(prods)].slice(0, 20);
            setProducts(unique);
            if (unique.length > 0) setSelectedProduct(unique[0]);
            setCustomerCount(custs.length);
        });
    }, []);

    const toggleChannel = (id: string) => {
        setSelectedChannels(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const generateContent = async () => {
        if (selectedChannels.size === 0) { alert('Select at least one channel.'); return; }
        setGenerating(true);
        setGenerated([]);

        const channels = CHANNELS.filter(c => selectedChannels.has(c.id));
        const campaignLabel = CAMPAIGN_TYPES.find(t => t.id === campaignType)?.label || campaignType;
        const productContext = selectedProduct || 'Soltol engine oils and lubricants';

        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are an expert marketing copywriter for Soltol, a premium oil & lubricants distributor in New York City.

COMPANY PROFILE:
- Business: Oil & lubricants distribution (B2B + B2C)
- Products: ${products.slice(0, 10).join(', ') || productContext}
- Customers: ${customerCount} active customers (auto workshops, fleet managers, mechanics)
- Location: New York City, USA
- Brand voice: ${brandVoice}

CAMPAIGN BRIEF:
- Type: ${campaignLabel}
- Focus product/topic: ${productContext}
- Target audience: ${targetAudience}
- Additional context: ${customPrompt || 'None'}

Generate marketing content for EACH specified channel. Return ONLY valid JSON:
{
  "contents": [
    {
      "channel": "channel_id",
      "subject": "email subject line (only for email)",
      "content": "the full marketing content for this channel",
      "hashtags": ["tag1", "tag2"] // only for social media
    }
  ]
}

IMPORTANT:
- Each channel gets unique, platform-optimized content
- NOT generic copy-paste — each must feel native to that platform
- For SMS: strictly under 160 characters
- For email: include Subject: line at top, then body
- For TikTok: start with a hook, include video concept idea
- For LinkedIn: B2B angle, no spam hashtags
- Sound like a real brand, not AI-generated`,
                    max_tokens: 4000,
                    messages: [{
                        role: 'user',
                        content: `Generate ${campaignLabel} marketing content for these channels: ${channels.map(c => c.id).join(', ')}`
                    }]
                })
            });

            // TC-79 — surface backend errors instead of silently falling
            // through to placeholder content.  503 = missing
            // ANTHROPIC_API_KEY; 5xx = upstream Anthropic / network.
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const reply = data.reply || '';

            // Parse JSON safely
            try {
                const jsonStart = reply.indexOf('{');
                const jsonEnd = reply.lastIndexOf('}') + 1;
                if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('No JSON in response');
                const parsed = JSON.parse(reply.slice(jsonStart, jsonEnd));
                const contents: GeneratedContent[] = (parsed.contents || []).map((item: any) => ({
                    channelId: item.channel,
                    content: item.subject ? `Subject: ${item.subject}\n\n${item.content}` : (item.content || ''),
                    copied: false,
                }));
                // Fill missing channels with placeholder
                channels.forEach(ch => {
                    if (!contents.find(c => c.channelId === ch.id)) {
                        contents.push({ channelId: ch.id, content: `[${ch.label} content not generated. Try again or reduce channel count.]`, copied: false });
                    }
                });
                setGenerated(contents);
                if (contents.length > 0) setActiveContent(contents[0].channelId);
            } catch (parseErr) {
                // AI returned plain text or malformed JSON - show as-is for first channel
                const fallback: GeneratedContent[] = channels.map((ch, i) => ({
                    channelId: ch.id,
                    content: i === 0 ? reply : '[Regenerate to get content for this channel]',
                    copied: false,
                }));
                setGenerated(fallback);
                setActiveContent(channels[0].id);
            }
        } catch (e: any) {
            alert(`Generation failed: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const copyContent = (channelId: string) => {
        const item = generated.find(g => g.channelId === channelId);
        if (!item) return;
        navigator.clipboard.writeText(item.content);
        setGenerated(prev => prev.map(g => g.channelId === channelId ? { ...g, copied: true } : g));
        setTimeout(() => setGenerated(prev => prev.map(g => g.channelId === channelId ? { ...g, copied: false } : g)), 2000);
    };

    const downloadAll = () => {
        const text = generated.map(g => {
            const ch = CHANNELS.find(c => c.id === g.channelId);
            return `=== ${ch?.label?.toUpperCase()} ${ch?.icon} ===\n\n${g.content}\n\n`;
        }).join('');
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bettano-marketing-${campaignType}-${Date.now()}.txt`;
        a.click();
    };

    const activeGenerated = generated.find(g => g.channelId === activeContent);
    const activeCh = CHANNELS.find(c => c.id === activeContent);

    return (
        <div className="space-y-5 max-w-[1300px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/marketing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Marketing Hub
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">AI Content Studio</h1>
                        <p className="text-gray-400 text-xs mt-0.5">Generate platform-native content for all 8 channels simultaneously</p>
                    </div>
                    {generated.length > 0 && (
                        <button onClick={downloadAll} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-black transition-all">
                            <Download size={14} /> Download All
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                {/* Left: Settings */}
                <div className="xl:col-span-2 space-y-4">

                    {/* Campaign type */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Campaign Type</p>
                        <div className="grid grid-cols-2 gap-2">
                            {CAMPAIGN_TYPES.map(t => (
                                <button key={t.id} onClick={() => setCampaignType(t.id)}
                                    className={`text-left p-3 rounded-xl border-2 transition-all ${campaignType === t.id ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <p className="text-xs font-black text-gray-800">{t.label}</p>
                                    <p className="text-[9px] text-gray-400 mt-0.5">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product & Audience */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Campaign Details</p>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Feature Product</label>
                            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400">
                                <option value="">General / All Products</option>
                                {products.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Target Audience</label>
                            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400"
                                placeholder="e.g. Fleet managers NYC" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Brand Voice</label>
                            <input value={brandVoice} onChange={e => setBrandVoice(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400"
                                placeholder="e.g. professional, trusted expert" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Additional Instructions</label>
                            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                                rows={2} placeholder="e.g. Mention 10% off for orders over 50 drums..."
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 resize-none" />
                        </div>
                    </div>

                    {/* Channel selector */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Select Channels</p>
                        <div className="grid grid-cols-2 gap-2">
                            {CHANNELS.map(ch => (
                                <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${selectedChannels.has(ch.id) ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <span className="text-xl">{ch.icon}</span>
                                    <span className="text-xs font-black text-gray-700">{ch.label}</span>
                                    {selectedChannels.has(ch.id) && <Check size={12} className="text-purple-600 ml-auto" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={generateContent} disabled={generating || selectedChannels.size === 0}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20">
                        {generating ? <><RefreshCw size={18} className="animate-spin" /> Generating {selectedChannels.size} pieces...</>
                            : <><Zap size={18} /> Generate {selectedChannels.size} Channel{selectedChannels.size !== 1 ? 's' : ''}</>}
                    </button>
                </div>

                {/* Right: Generated Content */}
                <div className="xl:col-span-3">
                    {generating && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                            <div className="flex justify-center gap-2 mb-4">
                                {Array.from(selectedChannels).map(id => (
                                    <span key={id} className="text-2xl animate-bounce" style={{animationDelay: `${Math.random() * 0.5}s`}}>
                                        {CHANNELS.find(c => c.id === id)?.icon}
                                    </span>
                                ))}
                            </div>
                            <p className="text-gray-700 font-black text-lg">Creating your content...</p>
                            <p className="text-gray-400 text-sm mt-1">AI is writing platform-native content for {selectedChannels.size} channels</p>
                        </div>
                    )}

                    {!generating && generated.length === 0 && (
                        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                            <div className="text-5xl mb-4">✨</div>
                            <p className="text-gray-500 font-black text-lg">Your content will appear here</p>
                            <p className="text-gray-400 text-sm mt-2">Configure your campaign and click Generate</p>
                        </div>
                    )}

                    {!generating && generated.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Channel tabs */}
                            <div className="flex overflow-x-auto border-b border-gray-100 px-2 pt-2 gap-1 flex-shrink-0">
                                {generated.map(g => {
                                    const ch = CHANNELS.find(c => c.id === g.channelId);
                                    return (
                                        <button key={g.channelId} onClick={() => setActiveContent(g.channelId)}
                                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-black whitespace-nowrap transition-all ${activeContent === g.channelId ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                                            <span>{ch?.icon}</span> {ch?.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {activeGenerated && activeCh && (
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{activeCh.icon}</span>
                                            <div>
                                                <p className="text-sm font-black text-gray-900">{activeCh.label}</p>
                                                <p className="text-[10px] text-gray-400">Max {activeCh.maxChars} chars · {activeCh.tone}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => copyContent(activeGenerated.channelId)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black transition-all">
                                                {activeGenerated.copied ? <><Check size={12} className="text-emerald-600" /> Copied!</> : <><Copy size={12} /> Copy</>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className={`bg-gray-50 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap font-medium text-gray-800 min-h-[200px] max-h-[400px] overflow-y-auto border border-gray-200`}>
                                        {activeGenerated.content}
                                    </div>

                                    <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
                                        <span>{activeGenerated.content.length} characters {activeCh.maxChars ? `(max ${activeCh.maxChars})` : ''}</span>
                                        <span className={activeGenerated.content.length > activeCh.maxChars * 1.1 ? 'text-red-500 font-bold' : 'text-emerald-600'}>
                                            {activeGenerated.content.length <= activeCh.maxChars ? '✓ Within limit' : '⚠ Over limit — trim before posting'}
                                        </span>
                                    </div>

                                    {/* Platform-specific action hints */}
                                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Next Step</p>
                                        <p className="text-xs text-amber-800">
                                            {activeCh.id === 'whatsapp' && '→ Go to WhatsApp Business · Create broadcast list · Paste message · Send to contacts'}
                                            {activeCh.id === 'sms' && '→ Use Twilio / TextMagic · Import customer phone numbers from ERP · Send bulk SMS'}
                                            {activeCh.id === 'email' && '→ Use Mailchimp / Brevo · Import customer emails from ERP · Create campaign · Schedule'}
                                            {activeCh.id === 'facebook' && '→ Go to Facebook Page · Create Post · Paste content · Add product photo · Schedule'}
                                            {activeCh.id === 'instagram' && '→ Open Instagram Business · New Post · Paste caption · Add oil product photo · Post'}
                                            {activeCh.id === 'tiktok' && '→ Record a short product demo video · Use TikTok app · Paste caption · Add trending sounds'}
                                            {activeCh.id === 'linkedin' && '→ Go to LinkedIn Company Page · Create Post · Paste content · Tag relevant businesses'}
                                            {activeCh.id === 'youtube' && '→ Upload product demo video to YouTube · Use this as title + description · Add to playlist'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
