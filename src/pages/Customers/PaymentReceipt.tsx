import { useState } from 'react';
import { type Customer, createPayment } from '../../services/customerService';

interface PaymentReceiptProps {
  customer: Customer;
  onBack: () => void;
}

export default function PaymentReceipt({ customer, onBack }: PaymentReceiptProps) {
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<'cash' | 'bank' | 'cheque' | 'card'>('cash');
  const [reference, setReference] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customer.id) {
      await createPayment({
        customer_id: customer.id,
        amount,
        payment_method: 'cash',
        reference,
        payment_date: new Date().toISOString()
      });
      alert('Payment Recorded!');
      onBack();
    }
  };

  return (
    <div className="payment-receipt" style={{ padding: '20px', color: '#333' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>New Receipt: {customer.name}</h3>
        <button onClick={onBack} type="button">Back</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', marginTop: '20px' }}>
        <div>
          <label style={{ display: 'block' }}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required style={{ padding: '5px' }} />
        </div>

        <div>
          <label style={{ display: 'block' }}>Payment Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} style={{ padding: '5px' }}>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block' }}>Reference / Note</label>
          <input type="text" value={reference} onChange={e => setReference(e.target.value)} style={{ padding: '5px' }} />
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '10px', padding: '10px' }}>Record Payment</button>
      </form>
    </div>
  );
}
