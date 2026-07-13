import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../../api/axios';
import { getOilErpApiBase } from '../../config/apiBase';
import { formatDateOnly } from '../../utils/formatters';

const API_BASE = getOilErpApiBase();

/** Fixed vault slots — one per backend category (honest mapping; backend cannot split W-9 vs 1120). */
const DOC_SLOTS = [
  { key: 'tax_form', title: 'Tax forms', subtitle: 'W-9, 1120 — corp tax & tax ID', category: 'tax_form', icon: '📋' },
  { key: 'agreement', title: 'Agreements', subtitle: 'Credit agreement & bank letter', category: 'agreement', icon: '🤝' },
  { key: 'id_compliance', title: 'ID & compliance', subtitle: 'Trade licence & passport', category: 'id_compliance', icon: '🪪' },
  { key: 'cheque', title: 'Cheques', subtitle: 'Customer cheques', category: 'cheque', icon: '🏦' },
  { key: 'delivery_photo', title: 'Delivery photos', subtitle: 'Proof of delivery', category: 'delivery_photo', icon: '📷' },
  { key: 'other', title: 'Other documents', subtitle: 'Anything else on file', category: 'other', icon: '📄' },
] as const;

export interface CustomerDocument {
  id: number;
  customer_id: number;
  category: string;
  file_name: string;
  content_type?: string | null;
  file_size?: number | null;
  uploaded_by?: number | null;
  uploaded_at?: string | null;
}

type VaultSlot = (typeof DOC_SLOTS)[number];

function fmtUploadDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return formatDateOnly(dateStr, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    || dateStr.slice(0, 10);
}

function isImageDoc(doc: CustomerDocument): boolean {
  return (
    doc.category === 'delivery_photo'
    || (doc.content_type?.startsWith('image/') ?? false)
    || /\.(jpe?g|png|webp)$/i.test(doc.file_name)
  );
}

function docsForCategory(docs: CustomerDocument[], category: string): CustomerDocument[] {
  return docs
    .filter((d) => d.category === category)
    .sort((a, b) => String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || '')));
}

async function fetchCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  const res = await authFetch(`${API_BASE}/customers/${encodeURIComponent(customerId)}/documents`);
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchDocumentDownloadUrl(customerId: string, docId: number): Promise<string> {
  const res = await authFetch(
    `${API_BASE}/customers/${encodeURIComponent(customerId)}/documents/${docId}/download`,
  );
  if (!res.ok) throw new Error(`Failed to get download URL (${res.status})`);
  const data = await res.json();
  if (!data?.download_url) throw new Error('Download URL missing');
  return data.download_url as string;
}

async function uploadCustomerDocument(
  customerId: string,
  file: File,
  category: string,
): Promise<CustomerDocument> {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(
    `${API_BASE}/customers/${encodeURIComponent(customerId)}/documents?category=${encodeURIComponent(category)}`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

type Props = {
  customerId: string;
  customerName: string;
};

export default function DocumentVault({ customerId, customerName }: Props) {
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<VaultSlot | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingUploadCategory, setPendingUploadCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerDocuments(customerId);
      setDocs(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load documents';
      setError(msg);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const missingSlotCount = DOC_SLOTS.filter(
    (slot) => docsForCategory(docs, slot.category).length === 0,
  ).length;

  const slotDocs = activeSlot ? docsForCategory(docs, activeSlot.category) : [];

  useEffect(() => {
    if (!activeSlot) return;
    let cancelled = false;
    slotDocs.filter(isImageDoc).forEach((doc) => {
      fetchDocumentDownloadUrl(customerId, doc.id)
        .then((url) => {
          if (!cancelled) {
            setThumbUrls((prev) => (prev[doc.id] ? prev : { ...prev, [doc.id]: url }));
          }
        })
        .catch(() => { /* optional */ });
    });
    return () => { cancelled = true; };
  }, [activeSlot, slotDocs, customerId]);

  const openDocument = async (doc: CustomerDocument) => {
    setOpeningId(doc.id);
    try {
      const url = await fetchDocumentDownloadUrl(customerId, doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not open document';
      window.alert(msg);
    } finally {
      setOpeningId(null);
    }
  };

  const startUpload = (category: string) => {
    setPendingUploadCategory(category);
    fileInputRef.current?.click();
  };

  const handleSlotClick = (slot: VaultSlot) => {
    const count = docsForCategory(docs, slot.category).length;
    if (count > 0) {
      setActiveSlot(slot);
    } else {
      startUpload(slot.category);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const category = pendingUploadCategory || 'other';
    e.target.value = '';
    setPendingUploadCategory(null);
    if (!file) return;

    setUploading(true);
    try {
      await uploadCustomerDocument(customerId, file, category);
      await loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      window.alert(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg0,#060f1c)' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div style={{
        background: 'var(--bg2,#0a1726)',
        border: '1px solid rgba(250,204,21,.25)', borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderBottom: '1px solid rgba(250,204,21,.15)',
        }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 2,
            }}>
              📁 Document vault — {customerName}
              <span style={{
                background: '#FEF9C3', color: '#713F12', fontSize: 9,
                fontWeight: 700, padding: '2px 7px', borderRadius: 8,
              }}>
                {docs.length} docs{missingSlotCount > 0 ? ` · ${missingSlotCount} missing` : ''}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>
              Click a slot to view files or upload
            </div>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => startUpload('other')}
            style={{
              background: '#FEF08A', color: '#713F12', border: '1px solid #FACC15',
              borderRadius: 8, padding: '5px 11px', fontSize: 10,
              fontWeight: 600, cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? 'Uploading…' : '📤 Upload'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--t3,#3E5678)' }}>
            Loading documents…
          </div>
        ) : error ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: '#B91C1C' }}>
            {error}
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(158px,1fr))',
            gap: 8, padding: '8px 12px 14px',
          }}>
            {DOC_SLOTS.map((slot) => {
              const slotItems = docsForCategory(docs, slot.category);
              const count = slotItems.length;
              const onFile = count > 0;
              const latest = slotItems[0];
              const normalBorder = onFile ? 'rgba(255,255,255,.07)' : 'rgba(239,68,68,.3)';
              const badgeBg = onFile ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)';
              const badgeColor = onFile ? '#16A34A' : '#B91C1C';
              const badgeLabel = onFile ? `${count} on file` : '⚠ Missing';

              return (
                <div
                  key={slot.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSlotClick(slot)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') handleSlotClick(slot); }}
                  style={{
                    background: 'var(--bg3,#0f1f33)', border: `1px solid ${normalBorder}`,
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = '#FACC15'; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = normalBorder; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: '#FEF9C3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, marginBottom: 7,
                  }}>
                    {slot.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', marginBottom: 2 }}>
                    {slot.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2,#8BA3C7)' }}>{slot.subtitle}</div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                    display: 'inline-block', marginTop: 4,
                    background: badgeBg, color: badgeColor,
                  }}>
                    {badgeLabel}
                  </div>
                  {latest?.uploaded_at && (
                    <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 3 }}>
                      {fmtUploadDate(latest.uploaded_at)}
                    </div>
                  )}
                </div>
              );
            })}

            <div
              role="button"
              tabIndex={0}
              onClick={() => startUpload('other')}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') startUpload('other'); }}
              style={{
                background: 'rgba(250,204,21,.04)', border: '1px dashed rgba(250,204,21,.3)',
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, textAlign: 'center', minHeight: 92,
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderColor = '#FACC15';
                e.currentTarget.style.background = 'rgba(250,204,21,.1)';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderColor = 'rgba(250,204,21,.3)';
                e.currentTarget.style.background = 'rgba(250,204,21,.04)';
              }}
            >
              <span style={{ fontSize: 20 }}>☁</span>
              <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>Upload new document</div>
            </div>
          </div>
        )}
      </div>

      {activeSlot && (
        <div
          role="presentation"
          onClick={() => setActiveSlot(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520, maxHeight: '75vh',
              background: 'var(--bg2,#0a1726)',
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
              padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t,#EEF2FF)' }}>
                  {activeSlot.icon} {activeSlot.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3,#3E5678)', marginTop: 2 }}>
                  {slotDocs.length} file{slotDocs.length === 1 ? '' : 's'} on file
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                style={{
                  background: 'transparent', border: 'none', fontSize: 18,
                  color: '#888', cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {slotDocs.map((doc) => {
                const thumb = thumbUrls[doc.id];
                const showThumb = isImageDoc(doc) && thumb;
                return (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDocument(doc)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') openDocument(doc); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)',
                      cursor: openingId === doc.id ? 'wait' : 'pointer',
                      opacity: openingId === doc.id ? 0.7 : 1,
                    }}
                  >
                    {showThumb ? (
                      <img
                        src={thumb}
                        alt={doc.file_name}
                        style={{
                          width: 56, height: 56, borderRadius: 8,
                          objectFit: 'cover', background: '#111',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 56, height: 56, borderRadius: 8, background: '#FEF9C3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#713F12',
                      }}>
                        PDF
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {doc.file_name}
                      </div>
                      {doc.uploaded_at && (
                        <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 2 }}>
                          {fmtUploadDate(doc.uploaded_at)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4F8EF7' }}>Open ›</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                const cat = activeSlot.category;
                setActiveSlot(null);
                startUpload(cat);
              }}
              style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 8,
                background: '#FEF08A', color: '#713F12', border: '1px solid #FACC15',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              + Add to {activeSlot.title}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
