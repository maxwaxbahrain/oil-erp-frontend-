import { useNavigate } from 'react-router-dom';
import CustomerForm from './CustomerForm';

export default function CustomerFormPage() {
  const navigate = useNavigate();

  const handleSave = () => {
    // After saving, go back to customer list
    navigate('/customers');
  };

  const handleCancel = () => {
    // Cancel - go back to customer list
    navigate('/customers');
  };

  return (
    <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
      <CustomerForm
        editingCustomer={null}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}