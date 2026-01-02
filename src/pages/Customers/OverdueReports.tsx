import { useEffect, useState } from 'react';
import { type Customer, getOverdueCustomers } from '../../services/customerService';

export default function OverdueReports() {
  const [overdueCustomers, setOverdueCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    getOverdueCustomers().then(setOverdueCustomers);
  }, []);

  return (
    <div className="overdue-reports" style={{ padding: '20px', color: '#333' }}>
      <h3>Overdue Management</h3>
      <p>Customers exceeding their credit limit:</p>

      {overdueCustomers.length === 0 ? (
        <p>No overdue customers! Great job.</p>
      ) : (
        <ul style={{ color: 'red' }}>
          {overdueCustomers.map(c => (
            <li key={c.id}>
              <strong>{c.name}</strong> - Balance: {c.balance} / Limit: {c.credit_limit}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
