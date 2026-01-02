import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import CustomerForm from './CustomerForm';
import { getCustomers, type Customer } from '../../services/customerService';

export default function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const customers = await getCustomers();
        const found = customers.find((c: any) => c.id === id);

        if (found) {
          setCustomer(found);
        } else {
          alert('Customer not found');
          navigate('/customers');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        navigate('/customers');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
      <CustomerForm
        editingCustomer={customer}
        onSave={() => navigate(`/customers/${id}`)}
        onCancel={() => navigate(`/customers/${id}`)}
      />
    </div>
  );
}