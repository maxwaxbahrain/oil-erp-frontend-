/**
 * Van Sales History Page
 * Displays list of all van sales with filtering and search
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Filter,
    Eye,
    Truck,
    User,
    Receipt,
    Loader,
    RefreshCw,
    X
} from 'lucide-react';
import { vanSalesService } from '../../services/vanSalesService';
import { receiptService } from '../../services/receiptService';
import type { VanSale } from '../../types/vanSales';

export default function VanSalesHistory() {
    const navigate = useNavigate();

    const [sales, setSales] = useState<VanSale[]>([]);
    const [filteredSales, setFilteredSales] = useState<VanSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVan, setFilterVan] = useState('');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Load sales
    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        setLoading(true);
        try {
            const data = await vanSalesService.getAll();
            setSales(data);
            setFilteredSales(data);
        } catch (error) {
            console.error('Failed to load sales:', error);
        } finally {
            setLoading(false);
        }
    };

    // Apply filters
    useEffect(() => {
        let filtered = [...sales];

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(sale =>
                sale.receipt_number.toLowerCase().includes(search) ||
                sale.customer_name?.toLowerCase().includes(search) ||
                sale.driver_name?.toLowerCase().includes(search)
            );
        }

        // Van filter
        if (filterVan) {
            filtered = filtered.filter(sale => sale.van_id === filterVan);
        }

        // Payment method filter
        if (filterPaymentMethod) {
            filtered = filtered.filter(sale => sale.payment_method === filterPaymentMethod);
        }

        // Status filter
        if (filterStatus) {
            filtered = filtered.filter(sale => sale.status === filterStatus);
        }

        setFilteredSales(filtered);
    }, [sales, searchTerm, filterVan, filterPaymentMethod, filterStatus]);

    // Get unique van IDs
    const uniqueVans = Array.from(new Set(sales.map(s => s.van_id))).sort();

    // Calculate stats
    const stats = {
        totalSales: filteredSales.filter(s => s.status === 'completed').length,
        totalAmount: filteredSales
            .filter(s => s.status === 'completed')
            .reduce((sum, s) => sum + s.total_amount, 0),
        cashSales: filteredSales.filter(s => s.payment_method === 'cash' && s.status === 'completed').length,
        creditSales: filteredSales.filter(s =>
            (s.payment_method === 'credit_no_advance' ||
                s.payment_method === 'credit_with_advance' ||
                s.payment_method === 'cash_credit_split') &&
            s.status === 'completed'
        ).length
    };

    // Handle view receipt
    const handleViewReceipt = (sale: VanSale) => {
        const receiptData = receiptService.generate(sale);
        receiptService.print(receiptData);
    };

    // Clear filters
    const clearFilters = () => {
        setSearchTerm('');
        setFilterVan('');
        setFilterPaymentMethod('');
        setFilterStatus('');
    };

    const hasActiveFilters = searchTerm || filterVan || filterPaymentMethod || filterStatus;

    return (
        <div className="van-sales-history-page">
            {/* Header */}
            <div className="page-header" style={{
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #8b1538'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', color: '#8b1538', margin: 0 }}>
                            📊 Van Sales History
                        </h1>
                        <p style={{ color: '#666', marginTop: '0.5rem' }}>
                            View and manage all van sales records
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/van-sales/new')}
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
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        <Plus size={20} />
                        New Sale
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div className="stat-card" style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: '4px solid #8b1538'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Total Sales</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b1538' }}>{stats.totalSales}</div>
                </div>
                <div className="stat-card" style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: '4px solid #4caf50'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Total Amount</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>
                        ${stats.totalAmount.toFixed(2)}
                    </div>
                </div>
                <div className="stat-card" style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: '4px solid #2196f3'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Cash Sales</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3' }}>{stats.cashSales}</div>
                </div>
                <div className="stat-card" style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: '4px solid #ff9800'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Credit Sales</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9800' }}>{stats.creditSales}</div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="search-filter-section" style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: showFilters ? '1rem' : 0, flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <Search size={18} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#666'
                        }} />
                        <input
                            type="text"
                            placeholder="Search by receipt #, customer, or driver..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                border: '2px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: showFilters ? '#8b1538' : 'white',
                            color: showFilters ? 'white' : '#8b1538',
                            border: '2px solid #8b1538',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Filter size={18} />
                        Filters
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={loadSales}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'white',
                            color: '#666',
                            border: '2px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                {/* Filter Options */}
                {showFilters && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #eee'
                    }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                Van
                            </label>
                            <select
                                value={filterVan}
                                onChange={(e) => setFilterVan(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            >
                                <option value="">All Vans</option>
                                {uniqueVans.map(vanId => (
                                    <option key={vanId} value={vanId}>Van {vanId}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                Payment Method
                            </label>
                            <select
                                value={filterPaymentMethod}
                                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            >
                                <option value="">All Methods</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="digital">Digital</option>
                                <option value="credit">Credit</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                Status
                            </label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            >
                                <option value="">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="refunded">Refunded</option>
                            </select>
                        </div>

                        {hasActiveFilters && (
                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                    onClick={clearFilters}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#f44336',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <X size={16} />
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sales Table */}
            <div className="sales-table-container" style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <Loader className="spinner" size={48} />
                        <p style={{ marginTop: '1rem', color: '#666' }}>Loading sales...</p>
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>
                        <Receipt size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No sales found</p>
                        <p style={{ fontSize: '0.9rem' }}>
                            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first van sale to get started'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#8b1538', color: 'white' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Receipt #</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Van</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Payment</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                                            {sale.receipt_number}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                            {receiptService.formatDateTime(sale.sale_date)}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Truck size={16} color="#8b1538" />
                                                Van {sale.van_id}
                                            </div>
                                            {sale.driver_name && (
                                                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                                                    {sale.driver_name}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <User size={16} color="#666" />
                                                {sale.customer_name || 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                            {receiptService.formatCurrency(sale.total_amount)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                backgroundColor:
                                                    sale.payment_method === 'cash' ? '#e8f5e9' :
                                                        sale.payment_method === 'card' ? '#e3f2fd' :
                                                            sale.payment_method === 'digital' ? '#f3e5f5' :
                                                                '#fff3e0',
                                                color:
                                                    sale.payment_method === 'cash' ? '#2e7d32' :
                                                        sale.payment_method === 'card' ? '#1565c0' :
                                                            sale.payment_method === 'digital' ? '#6a1b9a' :
                                                                '#e65100'
                                            }}>
                                                {sale.payment_method.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                backgroundColor:
                                                    sale.status === 'completed' ? '#e8f5e9' :
                                                        sale.status === 'cancelled' ? '#ffebee' :
                                                            '#fff3e0',
                                                color:
                                                    sale.status === 'completed' ? '#2e7d32' :
                                                        sale.status === 'cancelled' ? '#c62828' :
                                                            '#e65100'
                                            }}>
                                                {sale.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleViewReceipt(sale)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    backgroundColor: '#8b1538',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.85rem'
                                                }}
                                                title="View Receipt"
                                            >
                                                <Eye size={16} />
                                                Receipt
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
        </div>
    );
}
