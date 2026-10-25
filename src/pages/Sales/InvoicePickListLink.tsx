import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPickListForInvoice, type PickListDetail } from '../../services/pickingService';

/** Small invoice-header link. A missing open list (404) renders nothing. */
export default function InvoicePickListLink({ invoiceId }: { invoiceId: number }) {
  const [row, setRow] = useState<PickListDetail | null>(null);

  useEffect(() => {
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) return;
    let cancelled = false;
    getPickListForInvoice(invoiceId)
      .then((list) => {
        if (!cancelled) setRow(list);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (!row) return null;
  return (
    <Link
      to={`/warehouse/picking/${row.id}`}
      data-testid="invoice-pick-list-link"
      style={{ fontSize: 11, color: '#4F8EF7', fontWeight: 600 }}
    >
      {`Pick list ${row.number} · ${row.status}`}
    </Link>
  );
}
