import { useState, useEffect, useRef, useCallback, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Tag,
  Wallet,
  Calendar,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomer, updateCustomer, type Customer } from '../../services/customerService';
import { localIsoDate } from '../../utils/localDate';
import { isStaging } from '../../config/appEnv';
import { MANAGEMENT_ROLES } from '../../utils/rbac';
import { extractUserManagementError } from '../Settings/userManagementErrors';
import TellZavaBox, {
  type ZavaAutoPatch,
  type ZavaFillableField,
  type ZavaFormSnapshot,
} from './TellZavaBox';

interface CustomerFormProps {
  editingCustomer: Customer | null;
  onSave: () => void;
  onCancel: () => void;
}

const C = {
  navy: '#0B1120',
  navyDeep: '#070D18',
  navyPanel: '#0A1220',
  navyField: '#0F1A2E',
  border: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.07)',
  blue: '#4F8EF7',
  green: '#22c55e',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#5A7394',
  red: '#F87171',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: C.muted,
  marginBottom: 4,
};

const fieldWrap: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputBase: CSSProperties = {
  width: '100%',
  background: C.navyField,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 10px 8px 34px',
  fontSize: 13,
  color: C.text,
  outline: 'none',
  fontFamily: 'inherit',
};

const iconInField: CSSProperties = {
  position: 'absolute',
  left: 10,
  color: C.dim,
  pointerEvents: 'none',
  flexShrink: 0,
};

const zavaTagStyle: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: 6,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: C.green,
  background: C.navyPanel,
  border: `1px solid ${C.green}`,
  borderRadius: 4,
  padding: '1px 5px',
  pointerEvents: 'none',
};

export default function CustomerForm({ editingCustomer, onSave, onCancel }: CustomerFormProps) {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const tellZavaAvailable = isStaging && hasRole(...MANAGEMENT_ROLES);
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: 'retail',
    credit_limit: undefined,
    opening_balance: undefined,
    gps_location: '',
    notes: '',
  });
  const [openingSide, setOpeningSide] = useState<'debit' | 'credit'>('debit');
  const [openingAsOf, setOpeningAsOf] = useState(localIsoDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [zavaTagged, setZavaTagged] = useState<Set<ZavaFillableField>>(() => new Set());
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (editingCustomer) {
      setFormData(editingCustomer);
      setZavaTagged(new Set());
    }
  }, [editingCustomer]);

  const growNotes = useCallback(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => {
    growNotes();
  }, [formData.notes, growNotes]);

  const isDirty = useCallback(() => {
    if (editingCustomer) {
      const base = editingCustomer;
      return (
        (formData.name || '') !== (base.name || '') ||
        (formData.email || '') !== (base.email || '') ||
        (formData.phone || '') !== (base.phone || '') ||
        (formData.address || '') !== (base.address || '') ||
        (formData.category || 'retail') !== (base.category || 'retail') ||
        Number(formData.credit_limit ?? 0) !== Number(base.credit_limit ?? 0) ||
        (formData.notes || '') !== (base.notes || '')
      );
    }
    const hasText =
      Boolean(formData.name?.trim()) ||
      Boolean(formData.email?.trim()) ||
      Boolean(formData.phone?.trim()) ||
      Boolean(formData.address?.trim()) ||
      Boolean(formData.notes?.trim());
    const categoryChanged = (formData.category || 'retail') !== 'retail';
    const creditSet = formData.credit_limit !== undefined && Number(formData.credit_limit) !== 0;
    const openingSet =
      (formData.opening_balance !== undefined && Number(formData.opening_balance) !== 0) ||
      openingSide !== 'debit';
    return hasText || categoryChanged || creditSet || openingSet;
  }, [editingCustomer, formData, openingSide]);

  const requestClose = useCallback(() => {
    if (discardOpen) {
      setDiscardOpen(false);
      return;
    }
    if (isDirty()) {
      setDiscardOpen(true);
      return;
    }
    onCancel();
  }, [discardOpen, isDirty, onCancel]);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  function clearZavaTag(name: string) {
    if (
      name === 'name' ||
      name === 'email' ||
      name === 'phone' ||
      name === 'address' ||
      name === 'category' ||
      name === 'credit_limit' ||
      name === 'opening_balance' ||
      name === 'notes'
    ) {
      setZavaTagged((prev) => {
        if (!prev.has(name)) return prev;
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    clearZavaTag(name);
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'credit_limit' || name === 'opening_balance'
          ? value === ''
            ? undefined
            : parseFloat(value)
          : value,
    }));
  }

  const applyZavaPatch = useCallback((patch: ZavaAutoPatch) => {
    if (patch.form && Object.keys(patch.form).length > 0) {
      setFormData((prev) => ({ ...prev, ...patch.form }));
    }
    if (patch.openingSide) setOpeningSide(patch.openingSide);
    if (patch.openingAsOf) setOpeningAsOf(patch.openingAsOf);
    if (patch.tagged.length > 0) {
      setZavaTagged((prev) => {
        const next = new Set(prev);
        for (const f of patch.tagged) next.add(f);
        return next;
      });
    }
  }, []);

  const zavaSnapshot: ZavaFormSnapshot = {
    name: formData.name || '',
    email: formData.email || '',
    phone: formData.phone || '',
    address: formData.address || '',
    category: formData.category || 'retail',
    credit_limit: formData.credit_limit,
    opening_balance: formData.opening_balance,
    openingSide,
    openingAsOf,
    notes: formData.notes || '',
    isEdit: Boolean(editingCustomer),
  };

  function fieldStyle(base: CSSProperties, field: ZavaFillableField): CSSProperties {
    if (!zavaTagged.has(field)) return base;
    return { ...base, border: `1.5px solid ${C.green}` };
  }

  function ZavaTag({ field }: { field: ZavaFillableField }) {
    if (!zavaTagged.has(field)) return null;
    return (
      <span data-testid={`zava-tag-${field}`} style={zavaTagStyle}>
        Zava
      </span>
    );
  }

  function FieldShell({ field, children }: { field: ZavaFillableField; children: ReactNode }) {
    return (
      <div style={{ position: 'relative' }}>
        {children}
        <ZavaTag field={field} />
      </div>
    );
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    // Sync ref covers double Ctrl+Enter before React re-renders `saving`.
    if (saving || savingRef.current) return;
    setError(null);

    if (!formData.name) {
      setError('Customer Name is required');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const typedOpening = Number(formData.opening_balance);
      if (!editingCustomer && Number.isFinite(typedOpening) && typedOpening < 0) {
        setError('Opening balance amount must be greater than zero. Choose Credit if the customer is in credit.');
        return;
      }
      const openingAmount = Number.isFinite(typedOpening) ? Math.abs(typedOpening) : 0;
      const payload: Partial<Customer> = {
        ...formData,
        credit_limit: formData.credit_limit || 0,
      };

      if (editingCustomer && editingCustomer.id) {
        delete payload.opening_balance;
        delete payload.opening_side;
        delete payload.opening_as_of;
        await updateCustomer(editingCustomer.id, payload);
      } else {
        payload.opening_balance = openingAmount;
        payload.opening_side = openingSide;
        payload.opening_as_of = openingAmount > 0 ? openingAsOf : undefined;
        await createCustomer(payload);
      }

      onSave();
    } catch (err: unknown) {
      setError(extractUserManagementError(err, 'Failed to save customer data'));
      console.error(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const isEdit = Boolean(editingCustomer);
  const guideTitle = isEdit ? 'Edit customer' : 'Add a new customer';

  return (
    <div
      data-testid="customer-form"
      className="w-full max-w-[920px] mx-auto overflow-hidden"
      style={{
        position: 'relative',
        background: C.navy,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        maxHeight: 'min(680px, calc(100vh - 24px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="flex flex-1 min-h-0">
        {/* LEFT guide — hidden on small screens */}
        <aside
          data-testid="customer-form-guide"
          className="hidden md:flex flex-col shrink-0"
          style={{
            width: 248,
            background: C.navyDeep,
            borderRight: `1px solid ${C.borderSoft}`,
            padding: '18px 16px 12px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: C.blue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <User size={18} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>
            {guideTitle}
          </h2>
          <p style={{ margin: '6px 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.4 }}>
            {tellZavaAvailable
              ? 'Customers appear in invoices, collections and Zava straight away.'
              : 'Customers appear in invoices and collections straight away.'}
          </p>
          <ul
            data-testid="customer-form-guide-tips"
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {[
              ...(tellZavaAvailable
                ? ['Speak or type one sentence — Zava fills the fields']
                : []),
              tellZavaAvailable
                ? 'Credit limit lets Zava warn you before they owe too much'
                : 'Credit limit warns you before a customer owes too much',
              'Opening balance is money they owed before SOLTOL',
            ].map((tip) => (
              <li key={tip} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: C.text, lineHeight: 1.35 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'rgba(34,197,94,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Check size={10} color={C.green} strokeWidth={3} />
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {tellZavaAvailable ? (
            <div
              data-testid="customer-form-zava-guide-note"
              style={{
                marginTop: 14,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 11,
                color: C.muted,
                lineHeight: 1.4,
              }}
            >
              Fields filled by Zava are marked <span style={{ color: C.green, fontWeight: 700 }}>Zava</span> and
              outlined green. You can change anything.
            </div>
          ) : null}
          <p style={{ marginTop: 'auto', paddingTop: 12, fontSize: 11, color: C.dim }}>
            Tip: press{' '}
            <kbd
              style={{
                display: 'inline-block',
                padding: '1px 5px',
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                background: C.navyField,
                fontSize: 10,
                color: C.muted,
              }}
            >
              Ctrl
            </kbd>{' '}
            <kbd
              style={{
                display: 'inline-block',
                padding: '1px 5px',
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                background: C.navyField,
                fontSize: 10,
                color: C.muted,
              }}
            >
              Enter
            </kbd>{' '}
            to save
          </p>
        </aside>

        {/* RIGHT form */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0" style={{ background: C.navyPanel }}>
          <div
            className="flex items-center justify-between shrink-0"
            style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.borderSoft}` }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Customer details</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.muted,
                cursor: 'pointer',
                padding: 4,
                display: 'inline-flex',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <form
            ref={formRef}
            noValidate
            onSubmit={handleSubmit}
            onKeyDown={onFormKeyDown}
            className="flex-1 min-h-0 flex flex-col"
            style={{ padding: '10px 16px 12px' }}
          >
            {tellZavaAvailable ? (
              <TellZavaBox
                snapshot={zavaSnapshot}
                onApply={applyZavaPatch}
                onOpenDuplicate={(id) => navigate(`/customers/${id}`)}
              />
            ) : (
              <div data-testid="customer-form-zava-slot" hidden aria-hidden="true" style={{ display: 'none' }} />
            )}

            {error && (
              <div
                data-testid="customer-form-error"
                role="alert"
                style={{
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(248,113,113,0.12)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: C.red,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div
              data-testid="customer-form-fields"
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div>
                <label style={labelStyle}>
                  Customer name <span style={{ color: C.red }}>*</span>
                </label>
                <FieldShell field="name">
                  <div style={fieldWrap}>
                    <User size={14} style={iconInField} />
                    <input
                      type="text"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleChange}
                      aria-required="true"
                      placeholder="e.g. Acme Corp"
                      data-testid="customer-name"
                      style={fieldStyle(inputBase, 'name')}
                    />
                  </div>
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label style={labelStyle}>Email</label>
                  <FieldShell field="email">
                    <div style={fieldWrap}>
                      <Mail size={14} style={iconInField} />
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        placeholder="name@company.com"
                        data-testid="customer-email"
                        style={fieldStyle(inputBase, 'email')}
                      />
                    </div>
                  </FieldShell>
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <FieldShell field="phone">
                    <div style={fieldWrap}>
                      <Phone size={14} style={iconInField} />
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone || ''}
                        onChange={handleChange}
                        placeholder="(555) 123-4567"
                        data-testid="customer-phone"
                        style={fieldStyle(inputBase, 'phone')}
                      />
                    </div>
                  </FieldShell>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Address</label>
                <FieldShell field="address">
                  <div style={fieldWrap}>
                    <MapPin size={14} style={iconInField} />
                    <input
                      type="text"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleChange}
                      placeholder="123 Main St, City, State ZIP"
                      data-testid="customer-address"
                      style={fieldStyle(inputBase, 'address')}
                    />
                  </div>
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label style={labelStyle}>Category</label>
                  <FieldShell field="category">
                    <div style={fieldWrap}>
                      <Tag size={14} style={iconInField} />
                      <select
                        name="category"
                        value={formData.category || 'retail'}
                        onChange={handleChange}
                        data-testid="customer-category"
                        style={fieldStyle({ ...inputBase, appearance: 'none', cursor: 'pointer' }, 'category')}
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="partner">Partner</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </FieldShell>
                </div>
                <div>
                  <label style={labelStyle}>Credit limit</label>
                  <FieldShell field="credit_limit">
                    <div style={fieldWrap}>
                      <Wallet size={14} style={iconInField} />
                      <span
                        style={{
                          position: 'absolute',
                          left: 30,
                          color: C.dim,
                          fontSize: 13,
                          pointerEvents: 'none',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        name="credit_limit"
                        value={formData.credit_limit === undefined ? '' : formData.credit_limit}
                        onChange={handleChange}
                        placeholder="0.00"
                        data-testid="customer-credit-limit"
                        style={fieldStyle({ ...inputBase, paddingLeft: 42 }, 'credit_limit')}
                      />
                    </div>
                  </FieldShell>
                </div>
              </div>

              {/* Hidden GPS (unchanged behaviour) */}
              <div className="hidden">
                <input name="gps_location" value={formData.gps_location || ''} onChange={handleChange} />
              </div>

              <div>
                <label style={labelStyle}>Opening balance</label>
                {isEdit ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      data-testid="customer-opening-readonly"
                      style={{
                        ...inputBase,
                        paddingLeft: 12,
                        background: 'rgba(255,255,255,0.04)',
                        color: C.muted,
                      }}
                    >
                      {Math.abs(Number(editingCustomer?.opening_balance) || 0) <= 0.005
                        ? 'None'
                        : `${(Number(editingCustomer?.opening_balance) || 0) < 0 ? 'Cr' : 'Dr'} ${Math.abs(Number(editingCustomer?.opening_balance) || 0).toFixed(2)}`}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: C.dim, lineHeight: 1.35 }}>
                      Opening balance cannot be edited. To correct it, reverse the opening journal, then post a journal
                      voucher.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-testid="opening-side-debit"
                        onClick={() => {
                          clearZavaTag('opening_balance');
                          setOpeningSide('debit');
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: openingSide === 'debit' ? `1.5px solid ${C.blue}` : `1px solid ${C.border}`,
                          background: openingSide === 'debit' ? C.blue : C.navyField,
                          color: openingSide === 'debit' ? '#fff' : C.text,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Debit (Dr)</div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            opacity: openingSide === 'debit' ? 0.9 : 0.65,
                            marginTop: 2,
                          }}
                        >
                          They owe us
                        </div>
                      </button>
                      <button
                        type="button"
                        data-testid="opening-side-credit"
                        onClick={() => {
                          clearZavaTag('opening_balance');
                          setOpeningSide('credit');
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: openingSide === 'credit' ? `1.5px solid ${C.blue}` : `1px solid ${C.border}`,
                          background: openingSide === 'credit' ? C.blue : C.navyField,
                          color: openingSide === 'credit' ? '#fff' : C.text,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Credit (Cr)</div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            opacity: openingSide === 'credit' ? 0.9 : 0.65,
                            marginTop: 2,
                          }}
                        >
                          We owe them
                        </div>
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: C.dim, lineHeight: 1.35 }}>
                      Debit = money the customer already owed you before SOLTOL. Credit = money you owe them (advance or
                      overpayment).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label style={labelStyle}>Amount</label>
                        <FieldShell field="opening_balance">
                          <div style={fieldWrap}>
                            <span
                              style={{
                                position: 'absolute',
                                left: 12,
                                color: C.dim,
                                fontSize: 13,
                                pointerEvents: 'none',
                              }}
                            >
                              $
                            </span>
                            <input
                              type="number"
                              name="opening_balance"
                              min="0"
                              step="0.01"
                              value={formData.opening_balance === undefined ? '' : formData.opening_balance}
                              onChange={handleChange}
                              placeholder="0.00"
                              data-testid="customer-opening-amount"
                              style={fieldStyle({ ...inputBase, paddingLeft: 24 }, 'opening_balance')}
                            />
                          </div>
                        </FieldShell>
                      </div>
                      <div>
                        <label style={labelStyle}>As of</label>
                        <div style={fieldWrap}>
                          <Calendar size={14} style={iconInField} />
                          <input
                            type="date"
                            value={openingAsOf}
                            onChange={(e) => setOpeningAsOf(e.target.value)}
                            data-testid="customer-opening-as-of"
                            style={inputBase}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <FieldShell field="notes">
                  <div style={fieldWrap}>
                    <FileText size={14} style={{ ...iconInField, top: 10 }} />
                    <textarea
                      ref={notesRef}
                      name="notes"
                      value={formData.notes || ''}
                      onChange={(e) => {
                        handleChange(e);
                        requestAnimationFrame(growNotes);
                      }}
                      rows={1}
                      placeholder="Anything to remember..."
                      data-testid="customer-notes"
                      style={fieldStyle(
                        {
                          ...inputBase,
                          paddingTop: 8,
                          paddingBottom: 8,
                          resize: 'none',
                          overflow: 'hidden',
                          minHeight: 36,
                          lineHeight: 1.4,
                        },
                        'notes',
                      )}
                    />
                  </div>
                </FieldShell>
              </div>
            </div>

            <div
              className="shrink-0 flex justify-end items-center gap-3"
              style={{ paddingTop: 10, borderTop: `1px solid ${C.borderSoft}`, marginTop: 8 }}
            >
              <button
                type="button"
                onClick={requestClose}
                data-testid="customer-cancel"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="customer-save"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: C.blue,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                <Save size={15} />
                {saving ? 'Saving...' : 'Save customer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {discardOpen && (
        <div
          data-testid="customer-discard-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-discard-title"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,12,24,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 340,
              background: C.navyPanel,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '18px 16px 14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
            }}
          >
            <p
              id="customer-discard-title"
              style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.text }}
            >
              Discard this customer?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="customer-discard-keep"
                onClick={() => setDiscardOpen(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  color: C.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  fontFamily: 'inherit',
                }}
              >
                Keep editing
              </button>
              <button
                type="button"
                data-testid="customer-discard-confirm"
                onClick={onCancel}
                style={{
                  background: C.blue,
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  fontFamily: 'inherit',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
