import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const C = {
  bgMain: '#06080f',
  bgCard: '#0a0c16',
  bgDark: '#0d0f18',
  accent: '#4F6BF4',
  accentLight: '#85B7EB',
  accentBg: 'rgba(79,107,244,0.12)',
  accentBorder: 'rgba(79,107,244,0.25)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.45)',
  textTertiary: 'rgba(255,255,255,0.28)',
  green: '#97C459',
  greenBg: 'rgba(99,153,34,0.1)',
  greenBorder: 'rgba(99,153,34,0.25)',
};

const font = "'DM Sans', system-ui, sans-serif";

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

function TablerIcon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  return <i className={`ti ti-${name}`} style={{ fontSize: size, color, lineHeight: 1, display: 'inline-block' }} />;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 500 }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <h2 style={{ fontSize: 26, fontWeight: 500, color: C.textPrimary, letterSpacing: '-0.3px', marginBottom: sub ? 6 : 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.65, maxWidth: 480, margin: '0 auto 28px' }}>{sub}</p>}
    </>
  );
}

const PERSONA_TABS = [
  { icon: 'truck', label: 'Distributor' },
  { icon: 'box', label: 'Wholesaler' },
  { icon: 'brand-amazon', label: 'Amazon seller' },
  { icon: 'car', label: 'Auto parts' },
  { icon: 'cpu', label: 'Electronics' },
];

const PERSONA_COPY: ReactNode[] = [
  <>
    <b style={{ color: C.textPrimary }}>Fuel, oil, or general goods distributor?</b> Voice-create invoices on the road, track driver deliveries live, check customer credit before you deliver, and let AI forecast your next order.{' '}
    <b style={{ color: C.textPrimary }}>Switch from QuickBooks in days — not months.</b>
  </>,
  <>
    <b style={{ color: C.textPrimary }}>Running a wholesale business?</b> Manage thousands of SKUs, automate purchase orders, track supplier payments, and let AI tell you which customers are most likely to reorder.{' '}
    <b style={{ color: C.textPrimary }}>Your whole team works smarter — in their own language.</b>
  </>,
  <>
    <b style={{ color: C.textPrimary }}>Selling on Amazon, eBay, or your own store?</b> Sync inventory across channels, let AI write your product listings, forecast demand before peak season, and auto-generate POs so you never go out of stock.{' '}
    <b style={{ color: C.textPrimary }}>Beat your competition with AI that works 24/7.</b>
  </>,
  <>
    <b style={{ color: C.textPrimary }}>Auto parts distributor or wholesaler?</b> Manage 10,000+ SKUs, track which businesses owe you money, auto-generate POs when stock drops, and give drivers a route app that checks customer balances.{' '}
    <b style={{ color: C.textPrimary }}>Built for the parts business — out of the box.</b>
  </>,
  <>
    <b style={{ color: C.textPrimary }}>Electronics distributor or online seller?</b> Manage high-SKU inventory, forecast seasonal demand, let AI write product descriptions, and connect directly to Amazon.{' '}
    <b style={{ color: C.textPrimary }}>Scale your electronics business with AI.</b>
  </>,
];

export default function LandingPage() {
  const navigate = useNavigate();
  const width = useWindowWidth();
  const isMobile = width <= 768;
  const isSmall = width <= 480;

  const [activeTab, setActiveTab] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroEmail, setHeroEmail] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const tablerHref =
      'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css';
    if (!document.querySelector(`link[href="${tablerHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = tablerHref;
      document.head.appendChild(link);
    }
    const fontHref =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap';
    if (!document.querySelector(`link[href="${fontHref}"]`)) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = fontHref;
      document.head.appendChild(fontLink);
    }
  }, []);

  const joinWaitlist = (email: string, onSuccess?: () => void) => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setWaitlistError('Please enter a valid email address');
      return false;
    }
    const raw = localStorage.getItem('soltol_waitlist');
    const list = raw ? (JSON.parse(raw) as { email: string; timestamp: number }[]) : [];
    list.push({ email: trimmed, timestamp: Date.now() });
    localStorage.setItem('soltol_waitlist', JSON.stringify(list));
    setWaitlistError('');
    setSubmittedEmail(trimmed);
    setWaitlistSuccess(true);
    onSuccess?.();
    return true;
  };

  const gridCols = (desktop: number, tablet: number, mobile: number) =>
    isSmall ? mobile : isMobile ? tablet : desktop;

  const padX = isSmall ? 16 : isMobile ? 20 : 28;

  const navLinkStyle: CSSProperties = {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: font,
  };

  return (
    <div style={{ fontFamily: font, background: C.bgMain, color: C.textPrimary, minHeight: '100vh' }}>
      {/* NAV */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: C.bgCard,
          borderBottom: '1px solid rgba(79,107,244,0.15)',
          height: 60,
          padding: `0 ${padX}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, background: C.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>S</div>
          <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: '0.5px' }}>SOLTOL</span>
          <span style={{ fontSize: 10, color: C.accentLight, background: 'rgba(79,107,244,0.15)', border: '0.5px solid rgba(79,107,244,0.3)', padding: '2px 7px', borderRadius: 4 }}>ONE</span>
        </div>

        {!isMobile ? (
          <div style={{ display: 'flex', gap: 22 }}>
            {[
              ['Features', 'features'],
              ['Industries', 'industries'],
              ['How it works', 'how-it-works'],
              ['Compare', 'compare'],
            ].map(([label, id]) => (
              <button key={id} type="button" style={navLinkStyle} onClick={() => scrollToId(id)}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" aria-label="Menu" onClick={() => setMobileMenuOpen((v) => !v)} style={{ background: 'none', border: 'none', color: C.textPrimary, cursor: 'pointer' }}>
            <TablerIcon name={mobileMenuOpen ? 'x' : 'menu-2'} size={20} />
          </button>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/login" style={{ fontSize: 11, color: C.accentLight, border: '1px solid rgba(79,107,244,0.4)', background: 'rgba(79,107,244,0.08)', borderRadius: 7, padding: '6px 14px', textDecoration: 'none' }}>
            Sign in
          </Link>
          {!isMobile && (
            <button type="button" onClick={() => scrollToId('waitlist')} style={{ fontSize: 11, color: C.textPrimary, background: C.accent, border: 'none', borderRadius: 7, padding: '7px 16px', fontWeight: 500, cursor: 'pointer', fontFamily: font }}>
              Get free demo
            </button>
          )}
        </div>
      </nav>

      {isMobile && mobileMenuOpen && (
        <div style={{ background: C.bgCard, borderBottom: '1px solid rgba(79,107,244,0.15)', padding: `12px ${padX}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Features', 'features'],
            ['Industries', 'industries'],
            ['How it works', 'how-it-works'],
            ['Compare', 'compare'],
          ].map(([label, id]) => (
            <button key={id} type="button" style={{ ...navLinkStyle, textAlign: 'left' }} onClick={() => { scrollToId(id); setMobileMenuOpen(false); }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => { scrollToId('waitlist'); setMobileMenuOpen(false); }} style={{ ...navLinkStyle, color: C.accentLight, textAlign: 'left' }}>
            Get free demo
          </button>
        </div>
      )}

      {/* TRUST STRIP */}
      <div style={{ background: '#070912', borderBottom: '0.5px solid rgba(255,255,255,0.05)', padding: '7px 28px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {[
          ['map-pin', 'Built in the United States', C.accent],
          ['brain', "World's top 10 AI models", C.accent],
          ['microphone', 'Voice in 36+ languages', C.accent],
          ['plug', '12,800+ integrations', C.accent],
          ['users', '247 on waitlist', 'rgba(99,153,34,0.8)'],
        ].map(([icon, text, color], i) => (
          <div key={text as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && !isMobile && <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.1)', marginRight: 12 }} />}
            <TablerIcon name={icon as string} size={12} color={color as string} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{text as string}</span>
          </div>
        ))}
      </div>

      {/* HERO */}
      <section id="hero" style={{ background: C.bgMain, padding: isMobile ? '36px 20px 32px' : '48px 28px 40px', textAlign: 'center', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'rgba(79,107,244,0.1)', border: '1px solid rgba(79,107,244,0.25)', borderRadius: 20, padding: '4px 13px', fontSize: 12, color: C.accentLight }}>
          <TablerIcon name="sparkles" size={12} />
          World's first AI distribution ERP with voice invoicing in 36+ languages
        </div>
        <h1 style={{ fontSize: isMobile ? 24 : 42, fontWeight: 500, letterSpacing: '-1px', lineHeight: 1.2, maxWidth: 520, margin: '0 auto 10px' }}>
          The <span style={{ color: C.accent }}>one platform</span> that runs your entire distribution business
        </h1>
        <p style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.75, maxWidth: 380, margin: '0 auto 22px' }}>
          Voice invoicing, AI forecasting, driver app, credit intelligence — speak in your language, run your business your way.
        </p>

        <div style={{ maxWidth: 420, margin: '0 auto 28px' }}>
          <Link
            to="/signup"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: isMobile ? '100%' : 'auto',
              minHeight: 52,
              margin: '0 auto',
              padding: '14px 36px',
              background: C.accent,
              color: C.textPrimary,
              border: 'none',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: font,
              boxSizing: 'border-box',
            }}
          >
            Start free trial
          </Link>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 10, marginBottom: 0 }}>
            Free 7-day trial · No credit card · Cancel anytime
          </p>
        </div>

        <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 8 }}>I am a</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
          {PERSONA_TABS.map((tab, idx) => {
            const active = activeTab === idx;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(idx)}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '9px 18px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  border: active ? `1px solid ${C.accent}` : '1px solid rgba(79,107,244,0.35)',
                  background: active ? C.accent : 'rgba(79,107,244,0.08)',
                  color: active ? C.textPrimary : C.accentLight,
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                <TablerIcon name={tab.icon} size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ background: '#0d1020', border: '1px solid rgba(79,107,244,0.15)', borderRadius: 10, padding: '14px 18px', maxWidth: 520, margin: '0 auto 20px', minHeight: 52 }}>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: 0 }}>{PERSONA_COPY[activeTab]}</p>
        </div>

        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              type="email"
              value={heroEmail}
              onChange={(e) => setHeroEmail(e.target.value)}
              placeholder="Enter your work email"
              style={{ background: 'transparent', border: '1px solid rgba(79,107,244,0.35)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.textPrimary, width: isMobile ? '100%' : 220, boxSizing: 'border-box', fontFamily: font }}
            />
            <button
              type="button"
              onClick={() => joinWaitlist(heroEmail, () => scrollToId('waitlist'))}
              style={{
                background: 'transparent',
                color: C.accentLight,
                border: '1px solid rgba(79,107,244,0.45)',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: font,
                whiteSpace: 'nowrap',
              }}
            >
              Join waitlist free
            </button>
          </div>
          <button
            type="button"
            onClick={() => scrollToId('voice')}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: font,
              marginBottom: 14,
              padding: 0,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            <TablerIcon name="player-play" size={11} /> Demo
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            {['Go live in days', 'Switch from QuickBooks easily', '100% private data', '36+ languages'].map((t) => (
              <span key={t} style={{ fontSize: 15, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TablerIcon name="check" size={11} color="rgba(99,153,34,0.7)" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: '0 auto', background: C.bgCard, border: '1px solid rgba(79,107,244,0.15)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
          {[
            ['80+', 'Features'],
            ['7', 'Dashboards'],
            ['36+', 'Languages'],
            ['12,800+', 'Integrations'],
            ['430M+', 'Credit records'],
            ['24/7', 'AI support'],
          ].map(([num, label], i) => (
            <div key={label} style={{ flex: isMobile ? '1 1 33%' : 1, padding: '14px 8px', textAlign: 'center', borderRight: i < 5 ? '0.5px solid rgba(79,107,244,0.1)' : undefined, borderBottom: isMobile && i < 3 ? '0.5px solid rgba(79,107,244,0.1)' : undefined, minWidth: isMobile ? '33%' : 0 }}>
              <div style={{ fontSize: 22, fontWeight: 500 }}>{num}</div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT MOCKUP */}
      <section style={{ background: C.bgCard, padding: '0 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
      {!isMobile ? (
        <div style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.12)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#0d0f1a', padding: '8px 12px', borderBottom: '1px solid rgba(79,107,244,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#E24B4A', '#EF9F27', '#639922'].map((c) => (
                <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 9, color: C.textTertiary, background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '3px 8px' }}>app.soltol.com/dashboard — SOLTOL ONE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.green }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.green }} /> Live
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 78px', gap: 6, padding: 10 }}>
            <div style={{ background: '#0d0f1a', borderRadius: 7, padding: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <div style={{ width: 20, height: 20, background: C.accent, borderRadius: 4, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
                <span style={{ fontSize: 9 }}>SOLTOL ONE</span>
              </div>
              {['Overview', 'Finance & tax', 'Warehouse', 'Field & mobile', 'Sales & CRM'].map((m, i) => (
                <div key={m} style={{ fontSize: 8, padding: '4px 5px', borderRadius: 4, color: i === 0 ? C.accentLight : C.textTertiary, background: i === 0 ? 'rgba(79,107,244,0.15)' : 'transparent', marginBottom: 2 }}>{m}</div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
              <div style={{ fontSize: 8, color: C.accentLight, marginBottom: 2 }}>AI Hub</div>
              <div style={{ fontSize: 8, color: C.textTertiary }}>Voice</div>
              <div style={{ fontSize: 8, color: C.textTertiary }}>Marketing</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {[
                  ['Revenue today', '$24,850', '+12%', C.accentLight],
                  ['Deliveries', '48', '6 pending', '#EF9F27'],
                  ['Unpaid', '$8,200', '3 overdue', '#E24B4A'],
                  ['Stock alerts', '4', 'Low', '#EF9F27'],
                ].map(([l, v, s, col]) => (
                  <div key={l as string} style={{ background: '#0d0f1a', borderRadius: 5, padding: '6px 8px' }}>
                    <div style={{ fontSize: 6, color: C.textTertiary }}>{l as string}</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{v as string}</div>
                    <div style={{ fontSize: 6, color: col as string }}>{s as string}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div style={{ background: '#0d0f1a', borderRadius: 5, padding: 8, fontSize: 7 }}>
                  <div style={{ color: C.textTertiary, marginBottom: 4 }}>TOP CUSTOMERS</div>
                  {[['Al-Rashid', '$4,200', 85], ['Gulf Parts', '$3,100', 62], ['TechBox', '$2,800', 56]].map(([n, a, p]) => (
                    <div key={n as string} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{n as string}</span><span>{a as string}</span></div>
                      <div style={{ height: 3, background: 'rgba(79,107,244,0.15)', borderRadius: 2, marginTop: 2 }}><div style={{ width: `${p}%`, height: '100%', background: C.accent, borderRadius: 2 }} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#070d1e', border: '1px solid rgba(79,107,244,0.2)', borderRadius: 5, padding: 8, fontSize: 7 }}>
                  <div style={{ color: C.accentLight, marginBottom: 4 }}>Marcus AI advisor</div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: 4, marginBottom: 4 }}>Which customers are at risk?</div>
                  <div style={{ color: C.accentLight }}>Al-Noor Trading shows declining order frequency — recommend credit review.</div>
                </div>
              </div>
            </div>
            <div style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.15)', borderRadius: 7, padding: 7, fontSize: 7 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>SOLTOL Driver App</div>
              {['Garcia', 'Smith', 'Lee', 'Chen', 'Patel'].map((d, i) => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: [C.green, C.accent, '#EF9F27', C.accentLight, C.green][i] }} />
                  {d}
                </div>
              ))}
              <div style={{ marginTop: 6, background: C.accentBg, borderRadius: 4, padding: 4, textAlign: 'center', color: C.accentLight }}>Voice invoice</div>
              <div style={{ fontSize: 6, color: C.textTertiary, marginTop: 4, textAlign: 'center' }}>POD · Balance · Nav</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 16 }}>
          {[['$24,850', 'Revenue today'], ['48', 'Deliveries'], ['4', 'Stock alerts']].map(([v, l]) => (
            <div key={l} style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.15)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 500 }}>{v}</div>
              <div style={{ fontSize: 11, color: C.textTertiary }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background: C.bgMain, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>How it works</Eyebrow>
        <SectionTitle title="Go live in days — not months" sub="No IT team. No fees. No consultants. Just sign up and go." />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(4, 2, 1)}, 1fr)`, gap: 12, maxWidth: 900, margin: '0 auto' }}>
          {[
            ['1', 'Sign up free', 'Data isolated from day one. No credit card required.'],
            ['2', 'Import your data', 'Upload from Excel or QuickBooks automatically.'],
            ['3', 'Add your team', 'Drivers download app. Staff log in online.'],
            ['4', 'Run your business', 'Voice invoice, send drivers, AI does the rest.'],
          ].map(([n, t, d]) => (
            <div key={n as string} style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.12)', borderRadius: 12, padding: 18, textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 7, background: 'rgba(79,107,244,0.15)', border: '1px solid rgba(79,107,244,0.3)', color: C.accentLight, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>{n as string}</div>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{t as string}</div>
              <div style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.55 }}>{d as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: C.bgCard, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Core features</Eyebrow>
        <SectionTitle title="80+ features built for your business" sub="Every plan includes every feature — no module upsells" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(3, 2, 1)}, 1fr)`, gap: 8, maxWidth: 960, margin: '0 auto 16px' }}>
          {[
            ['microphone', 'Voice invoicing by phone', 'Speak in 36+ languages. Invoice created, stock updated — in seconds.', "World's first", 'rgba(79,107,244,0.12)', C.accentLight, '#E6F1FB', '#185FA5'],
            ['robot', 'Marcus AI advisor', 'Top 10 AI models combined. Forecasts, risk alerts, 24/7.', '10 AI models', 'rgba(127,119,221,0.12)', '#7F77DD', '#EEEDFE', '#3C3489'],
            ['clipboard-check', 'Driver & POD app', 'Route nav, POD, balance check, signature. iOS & Android offline.', 'Offline mode', 'rgba(29,158,117,0.12)', '#1D9E75', '#EAF3DE', '#3B6D11'],
            ['shield-check', 'Credit intelligence', '430M+ business credit scores across 200+ countries.', '430M+ records', 'rgba(226,75,74,0.12)', '#E24B4A', '#FCEBEB', '#A32D2D'],
            ['trending-up', 'AI demand forecast', 'Auto-generates POs before you run out of any product.', 'Zero stockouts', 'rgba(239,159,39,0.12)', '#BA7517', '#EAF3DE', '#3B6D11'],
            ['plug', '12,800+ integrations', 'Amazon, Shopify, QuickBooks, Xero, Slack, WhatsApp and more.', 'Most of any ERP', 'rgba(99,153,34,0.12)', '#639922', '#EAF3DE', '#3B6D11'],
          ].map(([icon, title, desc, badge, ibg, icol, bbg, bcol]) => (
            <div key={title as string} style={{ background: C.bgMain, border: '1px solid rgba(79,107,244,0.1)', borderRadius: 12, padding: 18, textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: ibg as string, color: icol as string, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <TablerIcon name={icon as string} size={20} color={icol as string} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{title as string}</div>
              <div style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.55, flex: 1, marginBottom: 8 }}>{desc as string}</div>
              <span style={{ fontSize: 11, fontWeight: 500, background: bbg as string, color: bcol as string, padding: '2px 8px', borderRadius: 4, alignSelf: 'flex-start' }}>{badge as string}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => scrollToId('features')} style={{ fontSize: 12, color: C.textSecondary, border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 20px', background: 'transparent', cursor: 'pointer', fontFamily: font }}>
          View all 80+ features →
        </button>
      </section>

      {/* VOICE */}
      <section id="voice" style={{ background: C.bgMain, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Multi-language voice</Eyebrow>
        <SectionTitle title="Speak your language — SOLTOL ONE understands" sub="The only ERP where your team works in their native language" />
        <div style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.2)', borderRadius: 10, padding: 16, marginBottom: 14, maxWidth: 800, marginInline: 'auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ background: C.bgMain, border: '1px solid rgba(79,107,244,0.12)', borderRadius: 8, padding: '14px 16px', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><TablerIcon name="microphone" size={14} /> Driver speaks in Spanish</div>
            <div style={{ fontSize: 16, color: C.textPrimary }}>Cincuenta litros de diesel para el cliente Garcia, pago en efectivo</div>
            <div style={{ fontSize: 11, color: 'rgba(79,107,244,0.7)', marginTop: 4 }}>Spanish · Mexico City, USA</div>
          </div>
          {!isMobile && (
            <div style={{ textAlign: 'center' }}>
              <TablerIcon name="arrow-right" size={18} color={C.accent} />
              <div style={{ fontSize: 9, color: C.textTertiary, marginTop: 4 }}>AI in real time</div>
            </div>
          )}
          <div style={{ background: C.bgMain, border: '1px solid rgba(79,107,244,0.12)', borderRadius: 8, padding: '14px 16px', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: C.green, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><TablerIcon name="file-invoice" size={14} color={C.green} /> Invoice created</div>
            <div style={{ fontSize: 16, color: C.green }}>Invoice #1847 · Garcia · 50L · $185 · Done</div>
            <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>3 seconds · English + Spanish</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(6, 3, 2)}, 1fr)`, gap: 6, maxWidth: 800, margin: '0 auto 12px' }}>
          {[['🇺🇸', 'English', '1.5B speakers'], ['🇸🇦', 'Arabic', '420M speakers'], ['🇪🇸', 'Spanish', '500M speakers'], ['🇮🇳', 'Hindi', '600M speakers'], ['🇧🇷', 'Portuguese', '250M speakers'], ['🇨🇳', 'Mandarin', '1.1B speakers']].map(([flag, name, sp]) => (
            <div key={name as string} style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.12)', borderRadius: 8, padding: '14px 12px' }}>
              <div style={{ fontSize: 24 }}>{flag as string}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{name as string}</div>
              <div style={{ fontSize: 11, color: C.textTertiary }}>{sp as string}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>+ French · German · Japanese · Korean · Turkish · Indonesian · and 25 more languages</p>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" style={{ background: C.bgCard, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Industries</Eyebrow>
        <SectionTitle title="Built for every type of distributor" sub="If you buy it, stock it, and deliver it — SOLTOL ONE runs it" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(4, 2, 1)}, 1fr)`, gap: 6, maxWidth: 960, margin: '0 auto' }}>
          {[
            ['droplet', 'Oil & fuel', 'Distribution & fleet', '10/10', '#EF9F27'],
            ['car', 'Auto parts', 'Wholesale & retail', '9.5/10', C.accentLight],
            ['cpu', 'Electronics', 'Distribution & Amazon', '9/10', '#AFA9EC'],
            ['building-store', 'General wholesale', 'All products', '9/10', '#1D9E75'],
            ['brand-amazon', 'Amazon sellers', 'FBA & direct', '8.5/10', '#E8956D'],
            ['package', 'FMCG', 'Consumer goods', '8.5/10', C.green],
            ['hammer', 'Building materials', 'Hardware', '8/10', C.accentLight],
            ['shopping-bag', 'Online wholesale', 'Alibaba, eBay', '8/10', '#AFA9EC'],
          ].map(([icon, name, sub, score, col]) => (
            <div key={name as string} style={{ background: C.bgMain, border: '1px solid rgba(79,107,244,0.1)', borderRadius: 9, padding: 14, display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 7, background: C.accentBg, color: col as string, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TablerIcon name={icon as string} size={14} color={col as string} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{name as string}</div>
                <div style={{ fontSize: 11, color: C.textTertiary }}>{sub as string}</div>
              </div>
              <span style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 5, flexShrink: 0 }}>{score as string}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PLATFORM POWER */}
      <section style={{ background: C.bgMain, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Platform power</Eyebrow>
        <SectionTitle title="Numbers no competitor can match" sub="Enterprise-grade infrastructure from day one" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(3, 2, 1)}, 1fr)`, gap: 8, maxWidth: 960, margin: '0 auto' }}>
          {[
            ['10', 'Top AI models combined', 'The right model for every task. Not just one.'],
            ['430M+', 'Business credit records', '200+ countries, verified by major rating agencies.'],
            ['12,800+', 'App integrations', '2x more than Salesforce. More than any ERP.'],
            ['36+', 'Voice languages', 'The only ERP your team can speak to natively.'],
            ['80+', 'Features every plan', 'No upsells. No locks. Everything works day one.'],
            ['7', 'AI dashboards', 'AI insights built in — not bolted on.'],
          ].map(([num, title, desc]) => (
            <div key={title as string} style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.1)', borderRadius: 12, padding: 18, textAlign: 'left' }}>
              <div style={{ fontSize: 36, fontWeight: 500, color: C.accent, marginBottom: 4 }}>{num as string}</div>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 3 }}>{title as string}</div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55 }}>{desc as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ background: C.bgCard, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Testimonials</Eyebrow>
        <SectionTitle title="Trusted by distributors in USA and beyond" sub="Early access program feedback" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols(3, 1, 1)}, 1fr)`, gap: 8, maxWidth: 960, margin: '0 auto' }}>
          {[
            ['MR', '#1a2040', C.accentLight, 'My driver speaks Spanish on the phone, invoice created in English. We replaced three separate tools with SOLTOL ONE. Best decision this year.', 'Mike Rodriguez', 'Owner · Southwest Auto Parts', 'Texas, USA · 22 staff · 🇺🇸'],
            ['AM', '#1e3020', C.green, 'AI told me a customer was at default risk 2 weeks before it happened. I collected in time. That insight paid for years of subscription.', 'Ahmed Al-Mansoori', 'Owner · Al-Mansoori Distribution', 'Bahrain · 14 drivers · 🇧🇭'],
            ['SC', '#1e1a30', '#AFA9EC', 'We sell electronics on Amazon. AI demand forecast stopped us over-ordering. Cancelled old ERP and content tool both. SOLTOL ONE does it all.', 'Sarah Chen', 'Founder · TechBox Distribution', 'California, USA · Amazon seller · 🇺🇸'],
          ].map(([init, bg, col, quote, name, role, loc]) => (
            <div key={name as string} style={{ background: C.bgMain, border: '1px solid rgba(79,107,244,0.1)', borderRadius: 12, padding: 18, textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TablerIcon key={i} name="star-filled" size={14} color="#FAC775" />
                ))}
              </div>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', lineHeight: 1.65, marginBottom: 10 }}>"{quote as string}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg as string, color: col as string, fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{init as string}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{name as string}</div>
                  <div style={{ fontSize: 11, color: C.textTertiary }}>{role as string}</div>
                  <div style={{ fontSize: 11, color: C.textTertiary }}>{loc as string}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARE */}
      <section id="compare" style={{ background: C.bgMain, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>Comparison</Eyebrow>
        <SectionTitle title="SOLTOL ONE vs the alternatives" sub="Only platform with voice invoicing, AI advisor, and driver app built in from day one" />
        <div style={{ overflowX: 'auto', maxWidth: 720, margin: '0 auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, textAlign: 'left' }}>
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.35)' }}>
                {['Feature', 'SOLTOL ONE', 'QuickBooks', 'NetSuite', 'Odoo'].map((h, i) => (
                  <th key={h} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(79,107,244,0.1)', background: i === 1 ? 'rgba(79,107,244,0.07)' : undefined, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Voice invoice (36+ langs)', '✓', '✗', '✗', '✗'],
                ['AI advisor (24/7)', '✓', '✗', 'Extra cost', '✗'],
                ['Driver & POD app', '✓', '✗', 'Add-on $$$', 'Add-on'],
                ['12,800+ integrations', '✓', '~700', '~700', '~3,000'],
                ['Multi-language voice', '✓', '✗', '✗', '✗'],
                ['Starting price', 'Free trial', '$30/mo', '$999+/mo', '$20/user'],
              ].map(([feat, ...cols]) => (
                <tr key={feat as string}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(79,107,244,0.08)', color: C.textSecondary }}>{feat as string}</td>
                  {cols.map((c, i) => (
                    <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(79,107,244,0.08)', background: i === 0 ? 'rgba(79,107,244,0.07)' : undefined, color: c === '✓' ? C.green : c === '✗' ? '#E24B4A' : c.includes('Extra') || c.includes('Add') || c.startsWith('~') ? '#EF9F27' : c === 'Free trial' ? C.green : C.textPrimary }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECURITY */}
      <section style={{ background: C.bgCard, padding: '16px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
        {[
          ['lock', 'SSL encrypted'],
          ['database', 'Daily backup'],
          ['users', 'Data isolated per company'],
          ['server', '99.9% uptime'],
          ['eye-off', 'We never share your data'],
          ['map-pin', 'Built in the United States'],
          ['world', '36+ languages'],
        ].map(([icon, text]) => (
          <span key={text as string} style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <TablerIcon name={icon as string} size={16} color={C.accent} /> {text as string}
          </span>
        ))}
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: C.bgMain, padding: '64px 48px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <Eyebrow>FAQ</Eyebrow>
        <SectionTitle title="Common questions answered" sub="Everything you need to know before signing up" />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 7, maxWidth: 540, margin: '0 auto' }}>
          {[
            ['clock', 'How long to go live?', 'Most businesses operational within days. QuickBooks import takes under an hour.'],
            ['microphone', 'How does voice in other languages work?', 'Driver calls your number, speaks naturally in their language. AI understands and creates the invoice in 3 seconds.'],
            ['wifi-off', 'Does the driver app work offline?', 'Fully offline. Syncs automatically when connectivity returns. Built for low-signal areas.'],
            ['shield', 'Is my data private and secure?', 'Completely isolated from other companies. We never share or use your data for AI training.'],
            ['car', 'Works for auto parts and electronics?', 'Yes — any product without temperature control or expiry tracking works perfectly out of the box.'],
            ['plug', 'How does 12,800+ integrations work?', 'One unified layer connects to Amazon, Shopify, QuickBooks, Slack, WhatsApp — no coding needed.'],
          ].map(([icon, q, a]) => (
            <div key={q as string} style={{ background: C.bgCard, border: '1px solid rgba(79,107,244,0.1)', borderRadius: 9, padding: 16, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', gap: 5, marginBottom: 5, alignItems: 'flex-start' }}>
                <TablerIcon name={icon as string} size={14} color={C.accent} />
                {q as string}
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>{a as string}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" style={{ background: C.bgMain, padding: '48px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', background: C.bgCard, border: '1px solid rgba(79,107,244,0.2)', borderRadius: 16, padding: isMobile ? '28px 20px' : '44px 36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, borderRadius: 20, padding: '4px 13px', fontSize: 12 }}>
            <TablerIcon name="rocket" size={12} color={C.green} />
            Launching in USA first · Bahrain · then worldwide
          </div>
          <h2 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.3px', marginBottom: 5 }}>Be first to transform your distribution business</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', marginBottom: 18 }}>Join 247 distributors on the waitlist. Get 3 months free when we launch.</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            {[
              ['MR', '#1a2040', C.accentLight],
              ['AM', '#1e3020', C.green],
              ['SC', '#1e1a30', '#AFA9EC'],
              ['+244', '#2a1a10', '#FAC775'],
            ].map(([init, bg, col], i) => (
              <div key={init as string} style={{ width: 36, height: 36, borderRadius: '50%', background: bg as string, color: col as string, fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.bgMain}`, marginLeft: i > 0 ? -6 : 0 }}>
                {init as string}
              </div>
            ))}
            <span style={{ fontSize: 11, color: C.textSecondary, marginLeft: 4 }}>247 businesses already waiting</span>
          </div>

          {waitlistSuccess ? (
            <div style={{ color: C.green, fontSize: 12, lineHeight: 1.6 }}>
              <TablerIcon name="check" size={16} color={C.green} />
              <div style={{ marginTop: 8 }}>You're on the list! We'll contact you at {submittedEmail} when we launch.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 7, marginBottom: 10 }}>
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistError(''); }}
                  placeholder="Your company email"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(79,107,244,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: C.textPrimary, fontFamily: font, boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => joinWaitlist(waitlistEmail)} style={{ background: C.accent, color: C.textPrimary, border: 'none', borderRadius: 8, padding: '13px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: font }}>
                  Reserve my spot
                </button>
              </div>
              {waitlistError && <div style={{ fontSize: 11, color: '#F09595', marginBottom: 8 }}>{waitlistError}</div>}
            </>
          )}

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 12, marginTop: 12 }}>
            <TablerIcon name="users" size={12} /> USA · Bahrain · and worldwide
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            {['3 months free', 'Priority onboarding', 'Lock in launch price', 'Cancel any time'].map((t) => (
              <span key={t} style={{ fontSize: 15, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TablerIcon name="check" size={11} color="rgba(99,153,34,0.7)" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: C.bgCard, borderTop: '1px solid rgba(79,107,244,0.1)', padding: isMobile ? '16px 20px' : '14px 28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ width: 26, height: 26, background: C.accent, borderRadius: 4, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
          SOLTOL ONE · © 2025 · Built in USA
        </div>
        <div style={{ background: 'rgba(79,107,244,0.1)', border: '1px solid rgba(79,107,244,0.25)', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.accentLight }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green }} /> Live support
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'rgba(255,255,255,0.22)', cursor: 'default' }}>
          <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>Privacy</Link>
          <span style={{ cursor: 'default' }}>Terms</span>
          <span style={{ cursor: 'default' }}>Contact</span>
        </div>
      </footer>
    </div>
  );
}
