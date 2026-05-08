/**
 * Van Management Page
 * Allows creating, editing, and viewing all vans
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { vanService, type Van } from '../../services/vanService';

export default function VanManagement() {
    const navigate = useNavigate();

    const [vans, setVans] = useState<Van[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingVan, setEditingVan] = useState<Van | null>(null);
    const [formData, setFormData] = useState<Partial<Van>>({
        van_number: '',
        driver_name: '',
        driver_phone: '',
        vehicle_number: '',
        capacity_liters: 5000,
        status: 'active'
    });

    // Load vans
    useEffect(() => {
        loadVans();
    }, []);

    const loadVans = async () => {
        setLoading(true);
        try {
            const data = await vanService.getAll();
            setVans(data);
        } catch (error) {
            console.error('Failed to load vans:', error);
            alert('Failed to load vans');
        } finally {
            setLoading(false);
        }
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingVan) {
                // Update existing van
                await vanService.update(editingVan.id, formData);
                alert('Van updated successfully!');
            } else {
                // Create new van
                await vanService.create(formData);
                alert('Van created successfully!');
            }

            // Reset form and reload
            setShowForm(false);
            setEditingVan(null);
            setFormData({
                van_number: '',
                driver_name: '',
                driver_phone: '',
                vehicle_number: '',
                capacity_liters: 5000,
                status: 'active'
            });
            loadVans();
        } catch (error) {
            console.error('Failed to save van:', error);
            alert('Failed to save van');
        }
    };

    // Handle edit
    const handleEdit = (van: Van) => {
        setEditingVan(van);
        setFormData(van);
        setShowForm(true);
    };

    // Handle delete
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this van?')) return;

        try {
            await vanService.delete(id);
            alert('Van deleted successfully!');
            loadVans();
        } catch (error) {
            console.error('Failed to delete van:', error);
            alert('Failed to delete van');
        }
    };

    // Handle cancel
    const handleCancel = () => {
        setShowForm(false);
        setEditingVan(null);
        setFormData({
            van_number: '',
            driver_name: '',
            driver_phone: '',
            vehicle_number: '',
            capacity_liters: 5000,
            status: 'active'
        });
    };

    return (
        <div className="van-management-page" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #8b1538',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', color: '#8b1538', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Truck size={32} />
                        Van Management
                    </h1>
                    <p style={{ color: '#666', marginTop: '0.5rem' }}>
                        Manage your fleet of delivery vans
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/van-sales')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'white',
                            color: '#8b1538',
                            border: '2px solid #8b1538',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Back to Van Sales
                    </button>
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#8b1538',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Plus size={20} />
                        Add New Van
                    </button>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '2rem',
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', color: '#8b1538', margin: 0 }}>
                                {editingVan ? 'Edit Van' : 'Add New Van'}
                            </h2>
                            <button
                                onClick={handleCancel}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    color: '#666'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Van Number */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Van Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.van_number}
                                        onChange={(e) => setFormData({ ...formData, van_number: e.target.value })}
                                        placeholder="e.g., Van 11"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>

                                {/* Driver Name */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Driver Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.driver_name}
                                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                        placeholder="e.g., John Doe"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>

                                {/* Driver Phone */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Driver Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.driver_phone || ''}
                                        onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                                        placeholder="e.g., +973-1234-5678"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>

                                {/* Vehicle Number */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Vehicle Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.vehicle_number || ''}
                                        onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                                        placeholder="e.g., BH-12345"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>

                                {/* Capacity */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Capacity (Liters)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.capacity_liters || 5000}
                                        onChange={(e) => setFormData({ ...formData, capacity_liters: parseInt(e.target.value) })}
                                        placeholder="5000"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>

                                {/* Status */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>
                                        Status *
                                    </label>
                                    <select
                                        required
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Van['status'] })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #ddd',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="maintenance">Maintenance</option>
                                    </select>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        backgroundColor: 'white',
                                        color: '#666',
                                        border: '2px solid #ddd',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        backgroundColor: '#8b1538',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <Save size={20} />
                                    {editingVan ? 'Update Van' : 'Create Van'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Vans List */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '1.5rem',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '2px solid #e9ecef'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                        All Vans ({vans.length})
                    </h2>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                        Loading vans...
                    </div>
                ) : vans.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>
                        <Truck size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No vans found</p>
                        <p style={{ fontSize: '0.9rem' }}>Click "Add New Van" to create your first van</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#8b1538', color: 'white' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Van Number</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Driver</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Phone</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Vehicle #</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Capacity</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vans.map((van) => (
                                    <tr key={van.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Truck size={18} color="#8b1538" />
                                                {van.van_number}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{van.driver_name}</td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>
                                            {van.driver_phone || 'N/A'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>
                                            {van.vehicle_number || 'N/A'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                            {van.capacity_liters?.toLocaleString() || 0} L
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                backgroundColor:
                                                    van.status === 'active' ? '#e8f5e9' :
                                                        van.status === 'maintenance' ? '#fff3e0' :
                                                            '#ffebee',
                                                color:
                                                    van.status === 'active' ? '#2e7d32' :
                                                        van.status === 'maintenance' ? '#e65100' :
                                                            '#c62828'
                                            }}>
                                                {van.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleEdit(van)}
                                                    style={{
                                                        padding: '0.5rem',
                                                        backgroundColor: '#2196f3',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Edit Van"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(van.id)}
                                                    style={{
                                                        padding: '0.5rem',
                                                        backgroundColor: '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Delete Van"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
