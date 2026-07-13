import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../../api/axios';
import { getOilErpApiBase } from '../../config/apiBase';
import { formatDateOnly } from '../../utils/formatters';

const API_BASE = getOilErpApiBase();

const DOC_FILTER_OPTIONS = [
  'All',
  'Tax forms',
  'Agreements',
  'ID & compliance',
  'Cheques',
  'Delivery photos',
] as const;

type DocFilter = (typeof DOC_FILTER_OPTIONS)[number];

const FILTER_CATEGORY: Record<DocFilter, string | null> = {
  All: null,
  'Tax forms': 'tax_form',
  Agreements: 'agreement',
  'ID & compliance': 'id_compliance',
  Cheques: 'cheque',
  'Delivery photos': 'delivery_photo',
};

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

const CATEGORY_ICONS: Record<string, string> = {
  tax_form: '📋',
  agreement: '🤝',
  id_compliance: '🪪',
  cheque: '🏦',
  delivery_photo: '📷',
  other: '📄',
};

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    tax_form: 'Tax form',
    agreement: 'Agreement',
    id_compliance: 'ID & compliance',
    cheque: 'Cheque',
    delivery_photo: 'Delivery photo',
    other: 'Other',
  };
  return labels[cat] ?? cat.replace(/_/g, ' ');
}

function isImageDoc(doc: CustomerDocument): boolean {
  return (
    doc.category === 'delivery_photo'
    || (doc.content_type?.startsWith('image/') ?? false)
    || /\.(jpe?g|png|webp)$/i.test(doc.file_name)
  );
}

function fmtUploadDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return formatDateOnly(dateStr, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) || dateStr.slice(0, 10);
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

type Props = {
  customerId: string;
  customerName: string;
};

export default function DocumentVault({ customerId, customerName }: Props) {
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<DocFilter>('All');
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});
  const [openingId, setOpeningId] = useState<number | null>(null);

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

  const filteredDocs = docs.filter((doc) => {
    const cat = FILTER_CATEGORY[docFilter];
    return cat == null || doc.category === cat;
  });

  useEffect(() => {
    let cancelled = false;
    const imageDocs = filteredDocs.filter(isImageDoc);
    imageDocs.forEach((doc) => {
      fetchDocumentDownloadUrl(customerId, doc.id)
        .then((url) => {
          if (!cancelled) {
            setThumbUrls((prev) => (prev[doc.id] ? prev : { ...prev, [doc.id]: url }));
          }
        })
        .catch(() => { /* thumbnail optional */ });
    });
    return () => { cancelled = true; };
  }, [filteredDocs, customerId]);

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

  return (
    <div style={{ background: 'var(--bg0,#060f1c)' }}>
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
                {docs.length} docs
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>
              Click any document to view
            </div>
          </div>
          <button
            type="button"
            style={{
              background: '#FEF08A', color: '#713F12', border: '1px solid #FACC15',
              borderRadius: 8, padding: '5px 11px', fontSize: 10,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            📤 Upload
          </button>
        </div>

        <div style={{ display: 'flex', gap: 5, padding: '8px 12px 4px', flexWrap: 'wrap' }}>
          {DOC_FILTER_OPTIONS.map((tag) => (
            <span
              key={tag}
              role="button"
              tabIndex={0}
              onClick={() => setDocFilter(tag)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDocFilter(tag); }}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                background: docFilter === tag ? '#FEF9C3' : 'rgba(255,255,255,.05)',
                border: docFilter === tag ? '1px solid #FACC15' : '1px solid rgba(255,255,255,.07)',
                color: docFilter === tag ? '#713F12' : 'var(--t2,#8BA3C7)',
              }}
            >
              {tag}{tag === 'All' ? ` (${docs.length})` : ''}
            </span>
          ))}
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
            {filteredDocs.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1', padding: '20px 12px', textAlign: 'center',
                fontSize: 12, color: 'var(--t3,#3E5678)',
              }}>
                No documents in this category
              </div>
            ) : filteredDocs.map((doc) => {
              const thumb = thumbUrls[doc.id];
              const showThumb = isImageDoc(doc) && thumb;
              const border = 'rgba(255,255,255,.07)';
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDocument(doc)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDocument(doc); }}
                  style={{
                    background: 'var(--bg3,#0f1f33)', border: `1px solid ${border}`,
                    borderRadius: 10, padding: showThumb ? 0 : '10px 12px',
                    cursor: openingId === doc.id ? 'wait' : 'pointer',
                    transition: 'border-color .15s', overflow: 'hidden',
                    opacity: openingId === doc.id ? 0.7 : 1,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = '#FACC15'; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = border; }}
                >
                  {showThumb ? (
                    <img
                      src={thumb}
                      alt={doc.file_name}
                      style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: '#FEF9C3',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, marginBottom: 7,
                    }}>
                      {CATEGORY_ICONS[doc.category] ?? '📄'}
                    </div>
                  )}
                  <div style={{ padding: showThumb ? '8px 10px' : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', marginBottom: 2 }}>
                      {doc.file_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2,#8BA3C7)' }}>{categoryLabel(doc.category)}</div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                      display: 'inline-block', marginTop: 4,
                      background: 'rgba(34,197,94,.12)', color: '#16A34A',
                    }}>
                      ✓ On file
                    </div>
                    {doc.uploaded_at && (
                      <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 3 }}>
                        {fmtUploadDate(doc.uploaded_at)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div
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
    </div>
  );
}
