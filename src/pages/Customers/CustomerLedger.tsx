import { useEffect, useState } from 'react';
import { type Customer } from '../../services/customerService';
import { getCustomerLedger, type PartyLedgerRow } from '../../services/api';

interface CustomerLedgerProps {
  customer: Customer;
  onBack: () => void;
}

export default function CustomerLedger({ customer, onBack }: CustomerLedgerProps) {
  const [rows, setRows] = useState<PartyLedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [closingBalance, setClosingBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!customer.id) return;
    getCustomerLedger(customer.id).then((ledger) => {
      setOpeningBalance(ledger.opening_balance);
      setClosingBalance(ledger.closing_balance);
      setRows(ledger.rows);
    });
  }, [customer]);

  return (
    <div className="customer-ledger" style={{ padding: '20px', color: '#333' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Ledger: {customer.name}</h3>
        <button onClick={onBack}>Back to List</button>
      </div>

      <p>
        Outstanding balance:{' '}
        <strong>{closingBalance != null ? closingBalance.toFixed(2) : '—'}</strong>
      </p>

      <table border={1} style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: 'white' }}>
        <thead style={{ background: '#eee', color: '#000' }}>
          <tr>
            <th style={{ padding: '8px' }}>Date</th>
            <th style={{ padding: '8px' }}>Description</th>
            <th style={{ padding: '8px' }}>Van</th>
            <th style={{ padding: '8px' }}>Salesman</th>
            <th style={{ padding: '8px' }}>Debit</th>
            <th style={{ padding: '8px' }}>Credit</th>
            <th style={{ padding: '8px' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {openingBalance != null && (
            <tr style={{ background: '#f5f5f5', color: '#000' }}>
              <td colSpan={6} style={{ padding: '8px', fontWeight: 700 }}>Opening balance</td>
              <td style={{ padding: '8px', fontWeight: 700 }}>{openingBalance.toFixed(2)}</td>
            </tr>
          )}
          {rows.map((entry) => (
            <tr key={entry.id} style={{ color: '#000' }}>
              <td style={{ padding: '8px' }}>{entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '8px' }}>{entry.description || entry.type}</td>
              <td style={{ padding: '8px' }}>{entry.van_number || '-'}</td>
              <td style={{ padding: '8px' }}>{entry.salesman_name || '-'}</td>
              <td style={{ padding: '8px' }}>{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
              <td style={{ padding: '8px' }}>{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
              <td style={{ padding: '8px' }}>{Number(entry.running_balance).toFixed(2)}</td>
            </tr>
          ))}
          {closingBalance != null && (
            <tr style={{ background: '#f5f5f5', color: '#000' }}>
              <td colSpan={6} style={{ padding: '8px', fontWeight: 700 }}>Closing balance</td>
              <td style={{ padding: '8px', fontWeight: 700 }}>{closingBalance.toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
