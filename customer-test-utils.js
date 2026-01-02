// ============================================
// CUSTOMER MODULE TESTING UTILITIES
// Run these in Browser Console for quick verification
// ============================================

/**
 * Test Suite: Quick Verification Functions
 * Copy and paste these into your browser console while testing
 */

// ============================================
// 1. CHECK MOCK DATA STATUS
// ============================================

function checkMockData() {
    console.log('=== MOCK DATA STATUS ===\n');

    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    const ledger = JSON.parse(localStorage.getItem('customer_ledger') || '[]');
    const payments = JSON.parse(localStorage.getItem('payments') || '[]');

    console.log(`✅ Customers: ${customers.length}`);
    console.log(`✅ Ledger Entries: ${ledger.length}`);
    console.log(`✅ Payments: ${payments.length}\n`);

    if (customers.length > 0) {
        console.log('📋 Customer List:');
        customers.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.name} (Balance: ${c.balance || 0})`);
        });
    }

    return { customers, ledger, payments };
}

// ============================================
// 2. VERIFY CUSTOMER STRUCTURE
// ============================================

function verifyCustomerStructure(customerId) {
    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    const customer = customers.find(c => c.id === customerId) || customers[0];

    if (!customer) {
        console.error('❌ No customer found');
        return;
    }

    console.log('=== CUSTOMER STRUCTURE ===\n');
    console.log('✅ Required Fields:');
    console.log(`  - id: ${customer.id ? '✓' : '✗'}`);
    console.log(`  - name: ${customer.name ? '✓' : '✗'}`);

    console.log('\n📋 Optional Fields:');
    const optionalFields = ['email', 'phone', 'address', 'city', 'country',
        'category', 'balance', 'credit_limit', 'status'];
    optionalFields.forEach(field => {
        console.log(`  - ${field}: ${customer[field] !== undefined ? '✓ ' + customer[field] : '✗'}`);
    });

    return customer;
}

// ============================================
// 3. TEST LEDGER CALCULATIONS
// ============================================

function verifyLedgerCalculations(customerId) {
    const ledger = JSON.parse(localStorage.getItem('customer_ledger') || '[]');
    const customerLedger = ledger.filter(e => e.customer_id === customerId);

    if (customerLedger.length === 0) {
        console.log('⚠️  No ledger entries for this customer');
        return;
    }

    console.log('=== LEDGER VERIFICATION ===\n');

    // Sort by date
    const sorted = customerLedger.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let calculatedBalance = 0;
    let errors = 0;

    sorted.forEach((entry, i) => {
        // Calculate expected balance
        if (entry.type === 'payment' || entry.type === 'credit') {
            calculatedBalance -= entry.amount;
        } else {
            calculatedBalance += entry.amount;
        }

        const match = Math.abs(calculatedBalance - entry.balance) < 0.01;
        const status = match ? '✅' : '❌';

        if (!match) errors++;

        console.log(`${status} Entry ${i + 1}: ${entry.type}`);
        console.log(`   Amount: ${entry.amount}, Recorded Balance: ${entry.balance}, Calculated: ${calculatedBalance}`);
    });

    console.log(`\n${errors === 0 ? '✅' : '❌'} Balance Calculations: ${errors === 0 ? 'CORRECT' : errors + ' ERRORS'}`);

    return { entries: sorted, errors };
}

// ============================================
// 4. SIMULATE CUSTOMER CREATION
// ============================================

function simulateCustomerCreation(testData = {}) {
    const defaultData = {
        name: 'Test Customer ' + Date.now(),
        email: 'test@example.com',
        phone: '+1234567890',
        address: 'Test Address',
        category: 'Retail',
        balance: -1000,
        credit_limit: 5000,
        status: 'Active'
    };

    const customerData = { ...defaultData, ...testData };

    console.log('=== SIMULATING CUSTOMER CREATION ===\n');
    console.log('📝 Customer Data:', customerData);

    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    const newCustomer = {
        id: crypto.randomUUID(),
        ...customerData,
        created_at: new Date().toISOString()
    };

    customers.unshift(newCustomer);
    localStorage.setItem('customers', JSON.stringify(customers));

    console.log('\n✅ Customer Created!');
    console.log('ID:', newCustomer.id);
    console.log('Name:', newCustomer.name);

    return newCustomer;
}

// ============================================
// 5. SIMULATE PAYMENT
// ============================================

function simulatePayment(customerId, amount, method = 'Cash') {
    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    const customer = customers.find(c => c.id === customerId);

    if (!customer) {
        console.error('❌ Customer not found');
        return;
    }

    console.log('=== SIMULATING PAYMENT ===\n');
    console.log(`Customer: ${customer.name}`);
    console.log(`Amount: ${amount}`);
    console.log(`Method: ${method}`);
    console.log(`Current Balance: ${customer.balance || 0}`);

    // Create payment
    const payment = {
        id: crypto.randomUUID(),
        customer_id: customerId,
        amount: amount,
        payment_date: new Date().toISOString(),
        payment_method: method,
        reference: 'TEST-' + Date.now(),
        created_at: new Date().toISOString()
    };

    const payments = JSON.parse(localStorage.getItem('payments') || '[]');
    payments.unshift(payment);
    localStorage.setItem('payments', JSON.stringify(payments));

    // Create ledger entry
    const ledger = JSON.parse(localStorage.getItem('customer_ledger') || '[]');
    const customerLedger = ledger.filter(e => e.customer_id === customerId);
    const lastBalance = customerLedger.length > 0
        ? customerLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance
        : (customer.balance || 0);

    const newBalance = lastBalance - amount;

    const ledgerEntry = {
        id: crypto.randomUUID(),
        customer_id: customerId,
        date: new Date().toISOString(),
        type: 'payment',
        amount: amount,
        balance: newBalance,
        description: `Payment received - ${method}`,
        reference: payment.reference,
        payment_method: method
    };

    ledger.unshift(ledgerEntry);
    localStorage.setItem('customer_ledger', JSON.stringify(ledger));

    // Update customer balance
    customer.balance = newBalance;
    localStorage.setItem('customers', JSON.stringify(customers));

    console.log(`\n✅ Payment Recorded!`);
    console.log(`New Balance: ${newBalance}`);
    console.log(`Payment ID: ${payment.id}`);

    return { payment, ledgerEntry, newBalance };
}

// ============================================
// 6. RESET TO SAMPLE DATA
// ============================================

function resetToSampleData() {
    console.log('=== RESETTING TO SAMPLE DATA ===\n');

    const sampleCustomers = [
        {
            id: crypto.randomUUID(),
            name: 'Al-Khaleej Trading Co.',
            email: 'info@alkhaleej.com',
            phone: '+971-4-1234567',
            address: 'Sheikh Zayed Road, Dubai',
            city: 'Dubai',
            country: 'UAE',
            category: 'Wholesale',
            balance: -15000,
            credit_limit: 50000,
            status: 'Active',
            created_at: new Date('2024-01-15').toISOString()
        },
        {
            id: crypto.randomUUID(),
            name: 'Pakistan Motors Ltd.',
            email: 'sales@pakmotors.pk',
            phone: '+92-21-35678901',
            address: 'I.I. Chundrigar Road, Karachi',
            city: 'Karachi',
            country: 'Pakistan',
            category: 'Retail',
            balance: -8500,
            credit_limit: 25000,
            status: 'Active',
            created_at: new Date('2024-02-20').toISOString()
        },
        {
            id: crypto.randomUUID(),
            name: 'Gulf Petroleum Services',
            email: 'contact@gulfpetro.com',
            phone: '+966-11-4567890',
            address: 'King Fahd Road, Riyadh',
            city: 'Riyadh',
            country: 'Saudi Arabia',
            category: 'Wholesale',
            balance: 0,
            credit_limit: 100000,
            status: 'Active',
            created_at: new Date('2024-03-10').toISOString()
        }
    ];

    localStorage.setItem('customers', JSON.stringify(sampleCustomers));
    localStorage.setItem('customer_ledger', '[]');
    localStorage.setItem('payments', '[]');

    console.log('✅ Sample data restored!');
    console.log('📋 3 customers created');
    console.log('🔄 Reload page to see changes');

    return sampleCustomers;
}

// ============================================
// 7. COMPREHENSIVE HEALTH CHECK
// ============================================

function healthCheck() {
    console.log('=== CUSTOMER MODULE HEALTH CHECK ===\n');

    const data = checkMockData();

    console.log('\n🔍 Data Integrity:');

    // Check for duplicate IDs
    const customerIds = data.customers.map(c => c.id);
    const uniqueIds = new Set(customerIds);
    console.log(`  ${uniqueIds.size === customerIds.length ? '✅' : '❌'} No duplicate customer IDs`);

    // Check required fields
    const missingNames = data.customers.filter(c => !c.name);
    console.log(`  ${missingNames.length === 0 ? '✅' : '❌'} All customers have names`);

    // Check ledger references
    const orphanedLedger = data.ledger.filter(l =>
        !data.customers.find(c => c.id === l.customer_id)
    );
    console.log(`  ${orphanedLedger.length === 0 ? '✅' : '❌'} All ledger entries have valid customer references`);

    // Check payment references
    const orphanedPayments = data.payments.filter(p =>
        !data.customers.find(c => c.id === p.customer_id)
    );
    console.log(`  ${orphanedPayments.length === 0 ? '✅' : '❌'} All payments have valid customer references`);

    console.log('\n📊 Summary:');
    console.log(`  Total Customers: ${data.customers.length}`);
    console.log(`  Total Ledger Entries: ${data.ledger.length}`);
    console.log(`  Total Payments: ${data.payments.length}`);
    console.log(`  Total Receivables: ${data.customers.reduce((sum, c) => sum + Math.abs(Math.min(c.balance || 0, 0)), 0)}`);

    return {
        healthy: orphanedLedger.length === 0 && orphanedPayments.length === 0 && missingNames.length === 0,
        data
    };
}

// ============================================
// 8. EXPORT ALL DATA (FOR BACKUP)
// ============================================

function exportAllData() {
    const data = {
        customers: JSON.parse(localStorage.getItem('customers') || '[]'),
        ledger: JSON.parse(localStorage.getItem('customer_ledger') || '[]'),
        payments: JSON.parse(localStorage.getItem('payments') || '[]'),
        exportDate: new Date().toISOString()
    };

    console.log('=== EXPORTING DATA ===');
    console.log(JSON.stringify(data, null, 2));

    // Copy to clipboard if available
    if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        console.log('\n✅ Data copied to clipboard!');
    }

    return data;
}

// ============================================
// 9. IMPORT DATA (FROM BACKUP)
// ============================================

function importData(jsonData) {
    try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (data.customers) {
            localStorage.setItem('customers', JSON.stringify(data.customers));
        }
        if (data.ledger) {
            localStorage.setItem('customer_ledger', JSON.stringify(data.ledger));
        }
        if (data.payments) {
            localStorage.setItem('payments', JSON.stringify(data.payments));
        }

        console.log('✅ Data imported successfully!');
        console.log('🔄 Reload page to see changes');

        return true;
    } catch (error) {
        console.error('❌ Import failed:', error);
        return false;
    }
}

// ============================================
// USAGE INSTRUCTIONS
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║     CUSTOMER MODULE TESTING UTILITIES LOADED ✅             ║
╚════════════════════════════════════════════════════════════╝

Available Functions:

📊 DATA INSPECTION:
  checkMockData()                    - View all mock data
  verifyCustomerStructure(id)        - Check customer fields
  verifyLedgerCalculations(id)       - Verify balance calculations
  healthCheck()                      - Comprehensive health check

🧪 TESTING:
  simulateCustomerCreation(data)     - Create test customer
  simulatePayment(id, amount, method) - Record test payment

🔄 DATA MANAGEMENT:
  resetToSampleData()                - Reset to 3 sample customers
  exportAllData()                    - Export all data (backup)
  importData(jsonData)               - Import data (restore)

EXAMPLES:
  // Check current data
  checkMockData();

  // Create test customer
  const customer = simulateCustomerCreation({ name: 'Test Corp' });

  // Record payment
  simulatePayment(customer.id, 1000, 'Cash');

  // Verify everything
  healthCheck();

  // Reset if needed
  resetToSampleData();
`);

// Make functions globally available
window.customerTestUtils = {
    checkMockData,
    verifyCustomerStructure,
    verifyLedgerCalculations,
    simulateCustomerCreation,
    simulatePayment,
    resetToSampleData,
    healthCheck,
    exportAllData,
    importData
};
