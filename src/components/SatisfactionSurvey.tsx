import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import api from '../api/axios';

const C = {
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

export default function SatisfactionSurvey() {
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const run = async () => {
      try {
        if (localStorage.getItem('survey_shown') === 'true') return;
      } catch {
        return;
      }
      try {
        const res = await api.get<{ should_show: boolean }>('/api/tracking/survey/status');
        if (res.data.should_show) {
          timer = window.setTimeout(() => {
            try {
              setVisible(true);
            } catch {
              // Silent
            }
          }, 3000);
        }
      } catch {
        // Silent — survey status failures must not affect the app
      }
    };
    void run().catch(() => {
      // Silent — uncaught async errors from run()
    });
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem('survey_shown', 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const submit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await api.post('/api/tracking/survey', { rating, comment });
      dismiss();
    } catch {
      dismiss();
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 60,
        width: 'min(360px, calc(100vw - 32px))',
        background: C.bg2,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 18,
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>How is Soltol working for you?</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Your feedback helps us improve SOLTOL ONE.</div>
        </div>
        <button type="button" onClick={dismiss} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: value <= rating ? '#F59E0B' : C.dim,
              padding: 0,
            }}
          >
            <Star size={22} fill={value <= rating ? '#F59E0B' : 'none'} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={3}
        style={{
          width: '100%',
          background: C.bg3,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          color: C.text,
          padding: 10,
          fontSize: 12,
          resize: 'vertical',
          marginBottom: 12,
        }}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={dismiss}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: C.muted, borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          Maybe later
        </button>
        <button
          type="button"
          disabled={rating < 1 || submitting}
          onClick={submit}
          style={{ background: C.blue, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', opacity: rating < 1 ? 0.5 : 1 }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
