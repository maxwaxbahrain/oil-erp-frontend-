import { useEffect, useState } from 'react';
import { type Customer, getCustomerLedger, type LedgerEntry } from '../../services/customerService';

interface CustomerLedgerProps {
  customer: Customer;
  onBack: () => void;
}

export default function CustomerLedger({ customer, onBack }: CustomerLedgerProps) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (customer.id) {
      getCustomerLedger(customer.id).then(setLedger);
    }
  }, [customer]);

  return (
    <div className="customer-ledger" style={{ padding: '20px', color: '#333' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Ledger: {customer.name}</h3>
        <button onClick={onBack}>Back to List</button>
      </div>

      <p>Balance: <strong>{customer.balance || 0}</strong></p>

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
          {ledger.map((entry) => (
            <tr key={entry.id} style={{ color: '#000' }}>
              <td style={{ padding: '8px' }}>{new Date(entry.date).toLocaleDateString()}</td>
              <td style={{ padding: '8px' }}>{entry.description}</td>
              <td style={{ padding: '8px' }}>{entry.van_number || '-'}</td>
              <td style={{ padding: '8px' }}>{entry.salesman_name || '-'}</td>
              <td style={{ padding: '8px' }}>{(entry.type === 'invoice' || entry.type === 'debit' || entry.type === 'van_sale') ? entry.amount.toFixed(2) : '-'}</td>
              <td style={{ padding: '8px' }}>{(entry.type === 'payment' || entry.type === 'credit') ? entry.amount.toFixed(2) : '-'}</td>
              <td style={{ padding: '8px' }}>{entry.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
