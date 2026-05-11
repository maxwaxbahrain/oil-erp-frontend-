import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload, CheckCircle, AlertCircle, RefreshCw, Download,
    ArrowLeft, FileText, Database, ChevronDown, ChevronUp, X
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
interface ImportResult {
    entity: string;
    total: number;
    imported: number;
    skipped: number;
    errors: string[];
}

interface ImportSummary {
    source: string;
    file: string;
    timestamp: string;
    results: ImportResult[];
    totalImported: number;
}

const IMPORT_HISTORY_KEY = 'soltol_import_history';
const CUSTOMERS_KEY = 'bettano_customers_imported';
const SUPPLIERS_KEY = 'bettano_suppliers_imported';
const PRODUCTS_KEY = 'bettano_imported_products';
const INVOICES_KEY = 'bettano_invoices_imported';

// ── Source definitions ─────────────────────────────────────────
const SOURCES = [
    {
        id: 'soltol_db',
        name: 'Soltol / Bettano DB',
        icon: '🗄️',
        description: 'Import from your previous Soltol/Bettano SQLite database backup (.db file)',
        formats: ['.db', '.sqlite'],
        color: 'bg-orange-50 border-orange-200',
        badgeColor: 'bg-orange-100 text-orange-700',
        instructions: [
            'Open your old Soltol/Bettano ERP software',
            'Go to Settings → Backup → Export Database',
            'Save the .db file to your computer',
            'Upload it here — all customers, products, invoices transfer automatically',
        ],
        fields: ['Customers (account_detail)', 'Products (item_measure)', 'Sales/Invoices (vouchers)', 'Suppliers (Sundry Creditors)', 'Purchase history'],
    },
    {
        id: 'quickbooks',
        name: 'QuickBooks',
        icon: '📊',
        description: 'Import from QuickBooks IIF, CSV exports or Excel reports',
        formats: ['.csv', '.iif', '.xlsx', '.xml'],
        color: 'bg-green-50 border-green-200',
        badgeColor: 'bg-green-100 text-green-700',
        instructions: [
            'In QuickBooks: go to File → Utilities → Export → Lists to IIF Files',
            'OR: Reports → any report → Export to Excel/CSV',
            'For customers: Lists → Customer:Job List → Export',
            'For invoices: Reports → Sales → Export to CSV',
        ],
        fields: ['Customers', 'Vendors/Suppliers', 'Items/Products', 'Invoices', 'Chart of Accounts'],
    },
    {
        id: 'ms_dynamics',
        name: 'Microsoft Dynamics 365',
        icon: '🔷',
        description: 'Import from Dynamics 365 CSV/Excel data exports',
        formats: ['.csv', '.xlsx', '.xml'],
        color: 'bg-blue-50 border-blue-200',
        badgeColor: 'bg-blue-100 text-blue-700',
        instructions: [
            'Go to Settings → Data Management → Export Data',
            'Select the entities: Accounts, Products, Invoices',
            'Choose CSV format and download',
            'Upload each file separately here',
        ],
        fields: ['Accounts (Customers)', 'Products', 'Sales Orders', 'Invoices', 'Contacts'],
    },
    {
        id: 'oracle_netsuite',
        name: 'Oracle NetSuite',
        icon: '🔴',
        description: 'Import from NetSuite Saved Searches CSV exports',
        formats: ['.csv', '.xlsx'],
        color: 'bg-red-50 border-red-200',
        badgeColor: 'bg-red-100 text-red-700',
        instructions: [
            'Go to Reports → Saved Searches → Create New Search',
            'Select record type (Customer, Invoice, Item)',
            'Set results columns and run the search',
            'Click Export → CSV and download',
        ],
        fields: ['Customers', 'Vendors', 'Inventory Items', 'Transactions', 'Financial Data'],
    },
    {
        id: 'cin7',
        name: 'Cin7 Core (DEAR Systems)',
        icon: '📦',
        description: 'Import from Cin7 Core data export tool',
        formats: ['.csv', '.xlsx'],
        color: 'bg-purple-50 border-purple-200',
        badgeColor: 'bg-purple-100 text-purple-700',
        instructions: [
            'Go to Settings → Data Export in Cin7 Core',
            'Select modules: Customers, Products, Sales, Inventory',
            'Export as CSV or Excel',
            'Upload the files here',
        ],
        fields: ['Customers', 'Suppliers', 'Products/SKUs', 'Sales Orders', 'Stock Levels'],
    },
    {
        id: 'generic_csv',
        name: 'Generic CSV / Excel',
        icon: '📋',
        description: 'Import from any CSV or Excel file with standard column names',
        formats: ['.csv', '.xlsx', '.xls'],
        color: 'bg-gray-50 border-gray-200',
        badgeColor: 'bg-gray-100 text-gray-700',
        instructions: [
            'Download the template CSV for each data type',
            'Fill in your data following the column format',
            'Save as CSV and upload here',
            'Use the column mapping tool if your columns differ',
        ],
        fields: ['Customers (name, email, phone, address)', 'Products (name, sku, price, stock)', 'Invoices (customer, date, amount, status)'],
    },
];

// ── CSV Template definitions ───────────────────────────────────
const TEMPLATES = {
    customers: 'Name,Email,Phone,Address,City,State,ZIP,Credit Limit,Opening Balance\nJohn Auto Shop,john@auto.com,555-0001,123 Main St,New York,NY,10001,5000,0\n',
    products: 'Name,SKU,Category,Selling Price,Cost Price,Stock Quantity,Unit,Description\nEngine Oil 5W30,OIL-5W30,Lubricants,34.99,22.00,100,Bottle,Premium synthetic\n',
    suppliers: 'Name,Email,Phone,Address,City,State,Contact Person,Opening Balance\nPetro Choice,info@petro.com,555-0002,933 First Ave,King of Prussia,PA,John Smith,0\n',
    invoices: 'Invoice Number,Customer Name,Invoice Date,Due Date,Product,Qty,Rate,Amount,Status\nINV-001,John Auto Shop,2024-01-15,2024-02-15,Engine Oil 5W30,10,34.99,349.90,Unpaid\n',
};

function downloadTemplate(type: keyof typeof TEMPLATES) {
    const content = TEMPLATES[type];
    const blob = new Blob([content], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `soltol_${type}_template.csv`;
    a.click();
}

// ── Main Parser ────────────────────────────────────────────────
async function parseFile(file: File, sourceId: string): Promise<ImportSummary> {
    const ext = file.name.toLowerCase().split('.').pop();
    const results: ImportResult[] = [];

    if (ext === 'db' || ext === 'sqlite') {
        return parseSQLiteDB(file, sourceId);
    } else if (ext === 'csv') {
        return parseCSV(file, sourceId);
    } else if (ext === 'xlsx' || ext === 'xls') {
        return parseExcel(file, sourceId);
    } else if (ext === 'iif') {
        return parseIIF(file, sourceId);
    } else if (ext === 'xml') {
        return parseXML(file, sourceId);
    }

    return {
        source: sourceId, file: file.name,
        timestamp: new Date().toISOString(),
        results, totalImported: 0
    };
}

// ── SQLite DB Parser (Soltol/Bettano format) ──────────────────
async function parseSQLiteDB(file: File, sourceId: string): Promise<ImportSummary> {
    const results: ImportResult[] = [];

    try {
        // Load SQL.js to parse SQLite in browser
        // @ts-ignore
        const initSqlJs = (window as any).initSqlJs || await loadSqlJs();
        const buffer = await file.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` });
        const db = new SQL.Database(new Uint8Array(buffer));

        // ── Import Customers (account_detail where a_type = Sundry Debtors) ──
        const custResult: ImportResult = { entity: 'Customers', total: 0, imported: 0, skipped: 0, errors: [] };
        try {
            const stmt = db.exec(`SELECT aname, address, phone, email_id, a_type FROM account_detail WHERE a_type LIKE '%Debtors%' OR a_type LIKE '%Customer%'`);
            if (stmt[0]) {
                const rows = stmt[0].values;
                custResult.total = rows.length;
                const existing = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
                const existingNames = new Set(existing.map((c: any) => c.name?.toLowerCase()));
                const newCustomers = rows.map((r: any[]) => ({
                    id: `IMP-CUST-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                    name: r[0] || '', address: r[1] || '', phone: r[2] || '',
                    email: r[3] || '', category: r[4] || 'Customer', isActive: true,
                    importedFrom: 'Soltol DB', importedAt: new Date().toISOString()
                })).filter((c: any) => {
                    if (!c.name || existingNames.has(c.name.toLowerCase())) { custResult.skipped++; return false; }
                    return true;
                });
                custResult.imported = newCustomers.length;
                const allCustomers = [...existing, ...newCustomers];
                localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(allCustomers));
            }
        } catch (e: any) { custResult.errors.push(e.message); }
        results.push(custResult);

        // ── Import Suppliers (Sundry Creditors) ──
        const suppResult: ImportResult = { entity: 'Suppliers', total: 0, imported: 0, skipped: 0, errors: [] };
        try {
            const stmt = db.exec(`SELECT aname, address, phone, email_id FROM account_detail WHERE a_type LIKE '%Creditors%' OR a_type LIKE '%Supplier%'`);
            if (stmt[0]) {
                const rows = stmt[0].values;
                suppResult.total = rows.length;
                const existing = JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '[]');
                const existingNames = new Set(existing.map((s: any) => s.name?.toLowerCase()));
                const newSuppliers = rows.map((r: any[]) => ({
                    id: `IMP-SUPP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                    name: r[0] || '', address: r[1] || '', phone: r[2] || '',
                    email: r[3] || '', importedFrom: 'Soltol DB'
                })).filter((s: any) => {
                    if (!s.name || existingNames.has(s.name.toLowerCase())) { suppResult.skipped++; return false; }
                    return true;
                });
                suppResult.imported = newSuppliers.length;
                localStorage.setItem(SUPPLIERS_KEY, JSON.stringify([...existing, ...newSuppliers]));
            }
        } catch (e: any) { suppResult.errors.push(e.message); }
        results.push(suppResult);

        // ── Import Products (item_measure) ──
        const prodResult: ImportResult = { entity: 'Products', total: 0, imported: 0, skipped: 0, errors: [] };
        try {
            const stmt = db.exec(`SELECT item, units_name, sku, item_desc FROM item_measure WHERE item IS NOT NULL`);
            if (stmt[0]) {
                const rows = stmt[0].values;
                prodResult.total = rows.length;
                const existing = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
                const existingNames = new Set(existing.map((p: any) => p.name?.toLowerCase()));
                const newProducts = rows.map((r: any[], i: number) => ({
                    id: `IMP-PROD-${Date.now()}-${i}`,
                    name: r[0] || '', sku: r[2] || '',
                    description: r[3] || r[1] || '',
                    category: 'Imported',
                    pricing: { sellingPrice: 0, purchasePriceExWorks: 0 },
                    locations: [{ name: 'Main Warehouse', currentStock: 0, minStock: 0 }],
                    isActive: true, importedFrom: 'Soltol DB'
                })).filter((p: any) => {
                    if (!p.name || existingNames.has(p.name.toLowerCase())) { prodResult.skipped++; return false; }
                    return true;
                });
                prodResult.imported = newProducts.length;
                localStorage.setItem(PRODUCTS_KEY, JSON.stringify([...existing, ...newProducts]));
            }
        } catch (e: any) { prodResult.errors.push(e.message); }
        results.push(prodResult);

        // ── Import Invoices from vouchers ──
        const invResult: ImportResult = { entity: 'Invoices / Receipts', total: 0, imported: 0, skipped: 0, errors: [] };
        try {
            const stmt = db.exec(`SELECT v_id, debit, credit, amount, date, narration, v_type, vch_no FROM vouchers WHERE v_type IN ('Sales','Receipt','Purchase','Sales Return','Payment') LIMIT 2000`);
            if (stmt[0]) {
                const rows = stmt[0].values;
                invResult.total = rows.length;
                const existing = JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]');
                const existingNums = new Set(existing.map((i: any) => i.vchNo));
                const newInvoices = rows.map((r: any[]) => ({
                    id: `IMP-INV-${r[0]}`,
                    vchNo: r[7] || `IMP-${r[0]}`,
                    debit: r[1], credit: r[2], amount: r[3] || 0,
                    date: r[4] || '', narration: r[5] || '',
                    type: r[6] || 'Invoice',
                    importedFrom: 'Soltol DB', status: 'Imported'
                })).filter((i: any) => {
                    if (existingNums.has(i.vchNo)) { invResult.skipped++; return false; }
                    return true;
                });
                invResult.imported = newInvoices.length;
                localStorage.setItem(INVOICES_KEY, JSON.stringify([...existing, ...newInvoices]));
            }
        } catch (e: any) { invResult.errors.push(e.message); }
        results.push(invResult);

        db.close();
    } catch (e: any) {
        results.push({ entity: 'Database', total: 0, imported: 0, skipped: 0, errors: [`Failed to parse database: ${e.message}. Make sure SQL.js is loaded.`] });
    }

    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    return { source: sourceId, file: file.name, timestamp: new Date().toISOString(), results, totalImported };
}

// ── CSV Parser ────────────────────────────────────────────────
async function parseCSV(file: File, sourceId: string): Promise<ImportSummary> {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows = lines.slice(1).map(l => {
        const vals = l.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
    }).filter(r => Object.values(r).some(v => v));

    const results: ImportResult[] = [];

    // Detect file type from headers
    const isCustomer = headers.some(h => h.includes('customer') || h.includes('client') || (h === 'name' && headers.includes('email')));
    const isProduct = headers.some(h => h.includes('sku') || h.includes('product') || h.includes('item'));
    const isInvoice = headers.some(h => h.includes('invoice') || h.includes('amount') || h.includes('total'));
    const isSupplier = headers.some(h => h.includes('supplier') || h.includes('vendor'));

    const nameField = headers.find(h => h === 'name' || h === 'customer name' || h === 'company name' || h === 'account name') || 'name';
    const emailField = headers.find(h => h.includes('email')) || '';
    const phoneField = headers.find(h => h.includes('phone') || h.includes('mobile')) || '';
    const addrField = headers.find(h => h.includes('address') || h.includes('street')) || '';
    const amtField = headers.find(h => h.includes('amount') || h.includes('total') || h.includes('balance')) || '';
    const skuField = headers.find(h => h.includes('sku') || h.includes('code') || h.includes('item')) || '';
    const priceField = headers.find(h => h.includes('price') || h.includes('rate') || h.includes('selling')) || '';
    const stockField = headers.find(h => h.includes('stock') || h.includes('qty') || h.includes('quantity')) || '';

    if (isCustomer || (!isProduct && !isInvoice && !isSupplier)) {
        const result: ImportResult = { entity: 'Customers', total: rows.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
        const existingNames = new Set(existing.map((c: any) => c.name?.toLowerCase()));
        const newOnes = rows.map((r, i) => ({
            id: `CSV-CUST-${Date.now()}-${i}`,
            name: r[nameField] || '', email: emailField ? r[emailField] : '',
            phone: phoneField ? r[phoneField] : '', address: addrField ? r[addrField] : '',
            balance: amtField ? parseFloat(r[amtField]) || 0 : 0,
            importedFrom: `CSV (${file.name})`
        })).filter(c => { if (!c.name || existingNames.has(c.name.toLowerCase())) { result.skipped++; return false; } return true; });
        result.imported = newOnes.length;
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    if (isProduct) {
        const result: ImportResult = { entity: 'Products', total: rows.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
        const existingSkus = new Set(existing.map((p: any) => p.sku?.toLowerCase()));
        const newOnes = rows.map((r, i) => ({
            id: `CSV-PROD-${Date.now()}-${i}`,
            name: r[nameField] || r[skuField] || '',
            sku: skuField ? r[skuField] : '',
            pricing: {
                sellingPrice: priceField ? parseFloat(r[priceField]) || 0 : 0,
                purchasePriceExWorks: 0
            },
            locations: [{ name: 'Main Warehouse', currentStock: stockField ? parseInt(r[stockField]) || 0 : 0 }],
            category: 'Imported', importedFrom: `CSV (${file.name})`
        })).filter(p => { if (!p.name || (p.sku && existingSkus.has(p.sku.toLowerCase()))) { result.skipped++; return false; } return true; });
        result.imported = newOnes.length;
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    if (isSupplier) {
        const result: ImportResult = { entity: 'Suppliers', total: rows.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '[]');
        const existingNames = new Set(existing.map((s: any) => s.name?.toLowerCase()));
        const newOnes = rows.map((r, i) => ({
            id: `CSV-SUPP-${Date.now()}-${i}`,
            name: r[nameField] || '', email: emailField ? r[emailField] : '',
            phone: phoneField ? r[phoneField] : '', importedFrom: `CSV (${file.name})`
        })).filter(s => { if (!s.name || existingNames.has(s.name.toLowerCase())) { result.skipped++; return false; } return true; });
        result.imported = newOnes.length;
        localStorage.setItem(SUPPLIERS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    return { source: sourceId, file: file.name, timestamp: new Date().toISOString(), results, totalImported };
}

// ── Excel Parser ──────────────────────────────────────────────
async function parseExcel(file: File, sourceId: string): Promise<ImportSummary> {
    // Convert to CSV-like via ArrayBuffer and XLSX library
    try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(ws);
        const csvFile = new File([csvText], file.name.replace(/\.xlsx?$/, '.csv'), { type: 'text/csv' });
        return parseCSV(csvFile, sourceId);
    } catch {
        return { source: sourceId, file: file.name, timestamp: new Date().toISOString(), results: [{ entity: 'Excel', total: 0, imported: 0, skipped: 0, errors: ['XLSX library not available. Please convert to CSV first.'] }], totalImported: 0 };
    }
}

// ── IIF Parser (QuickBooks) ───────────────────────────────────
async function parseIIF(file: File, sourceId: string): Promise<ImportSummary> {
    const text = await file.text();
    const lines = text.split('\n');
    const results: ImportResult[] = [];

    // IIF format: !CUST section for customers, !INVITEM for items
    let currentSection = '';
    let headers: string[] = [];
    const customers: any[] = [];
    const items: any[] = [];

    lines.forEach(line => {
        if (line.startsWith('!')) {
            currentSection = line.split('\t')[0].slice(1);
            headers = line.split('\t').map(h => h.trim().slice(1));
            return;
        }
        if (!line.trim() || line.startsWith('!HDR')) return;
        const vals = line.split('\t').map(v => v.trim());
        if (currentSection === 'CUST') {
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = vals[i] || '');
            if (obj.NAME) customers.push(obj);
        } else if (currentSection === 'INVITEM') {
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = vals[i] || '');
            if (obj.NAME) items.push(obj);
        }
    });

    if (customers.length > 0) {
        const result: ImportResult = { entity: 'Customers (QuickBooks)', total: customers.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
        const existingNames = new Set(existing.map((c: any) => c.name?.toLowerCase()));
        const newOnes = customers.map((c, i) => ({
            id: `IIF-CUST-${Date.now()}-${i}`,
            name: c.NAME || c.COMPANYNAME || '', email: c.EMAIL || '', phone: c.PHONE1 || '',
            address: c.ADDR1 || '', importedFrom: 'QuickBooks IIF'
        })).filter(c => { if (!c.name || existingNames.has(c.name.toLowerCase())) { result.skipped++; return false; } return true; });
        result.imported = newOnes.length;
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    if (items.length > 0) {
        const result: ImportResult = { entity: 'Products (QuickBooks)', total: items.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
        const newOnes = items.map((it, i) => ({
            id: `IIF-PROD-${Date.now()}-${i}`,
            name: it.NAME || '', sku: it.REFNUM || '',
            pricing: { sellingPrice: parseFloat(it.PRICE || '0') || 0, purchasePriceExWorks: parseFloat(it.COST || '0') || 0 },
            locations: [{ name: 'Main Warehouse', currentStock: 0 }],
            category: it.TYPE || 'Imported', importedFrom: 'QuickBooks IIF'
        })).filter(p => { if (!p.name) { result.skipped++; return false; } return true; });
        result.imported = newOnes.length;
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    if (results.length === 0) {
        results.push({ entity: 'IIF File', total: 0, imported: 0, skipped: 0, errors: ['No recognizable IIF sections found. Try exporting Customer List or Item List separately.'] });
    }

    return { source: sourceId, file: file.name, timestamp: new Date().toISOString(), results, totalImported: results.reduce((s, r) => s + r.imported, 0) };
}

// ── XML Parser ────────────────────────────────────────────────
async function parseXML(file: File, sourceId: string): Promise<ImportSummary> {
    const text = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const results: ImportResult[] = [];

    const customers = xml.querySelectorAll('Customer, Account, Party');
    if (customers.length > 0) {
        const result: ImportResult = { entity: 'Customers (XML)', total: customers.length, imported: 0, skipped: 0, errors: [] };
        const existing = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
        const existingNames = new Set(existing.map((c: any) => c.name?.toLowerCase()));
        const newOnes: any[] = [];
        customers.forEach((c, i) => {
            const name = c.querySelector('Name, CompanyName, AccountName')?.textContent?.trim() || '';
            if (!name || existingNames.has(name.toLowerCase())) { result.skipped++; return; }
            newOnes.push({
                id: `XML-CUST-${Date.now()}-${i}`, name,
                email: c.querySelector('Email')?.textContent?.trim() || '',
                phone: c.querySelector('Phone, PhoneNumber')?.textContent?.trim() || '',
                importedFrom: 'XML Export'
            });
        });
        result.imported = newOnes.length;
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([...existing, ...newOnes]));
        results.push(result);
    }

    if (results.length === 0) results.push({ entity: 'XML', total: 0, imported: 0, skipped: 0, errors: ['No standard XML customer/product records found.'] });
    return { source: sourceId, file: file.name, timestamp: new Date().toISOString(), results, totalImported: results.reduce((s, r) => s + r.imported, 0) };
}

// ── Main Component ────────────────────────────────────────────
export default function DataMigration() {
    const navigate = useNavigate();
    const [selectedSource, setSelectedSource] = useState<string>('soltol_db');
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [history, setHistory] = useState<ImportSummary[]>(() => {
        try { return JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY) || '[]'); } catch { return []; }
    });
    const [showHistory, setShowHistory] = useState(false);
    const [activeTab, setActiveTab] = useState<'import' | 'templates' | 'history'>('import');
    const fileRef = useRef<HTMLInputElement>(null);

    const source = SOURCES.find(s => s.id === selectedSource)!;

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) setFile(f);
    };

    const runImport = async () => {
        if (!file) return;
        setImporting(true); setSummary(null); setProgress(10);
        try {
            setProgress(30);
            const result = await parseFile(file, selectedSource);
            setProgress(90);
            setSummary(result);
            const updated = [result, ...history].slice(0, 20);
            setHistory(updated);
            localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated));
            setProgress(100);
        } catch (e: any) {
            setSummary({ source: selectedSource, file: file.name, timestamp: new Date().toISOString(), results: [{ entity: 'Import', total: 0, imported: 0, skipped: 0, errors: [e.message] }], totalImported: 0 });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Settings
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Database size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Data Migration Center</h1>
                        <p className="text-gray-400 text-xs mt-0.5">Import from QuickBooks · Dynamics 365 · NetSuite · Cin7 · Soltol DB · CSV</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { id: 'import', label: '📥 Import Data' },
                    { id: 'templates', label: '📋 Download Templates' },
                    { id: 'history', label: `📋 Import History (${history.length})` },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── IMPORT TAB ── */}
            {activeTab === 'import' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

                    {/* Source Selection */}
                    <div className="xl:col-span-1 space-y-2">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Select Your Previous Software</p>
                        {SOURCES.map(s => (
                            <button key={s.id} onClick={() => setSelectedSource(s.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedSource === s.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                <span className="text-2xl flex-shrink-0">{s.icon}</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-gray-900">{s.name}</p>
                                    <p className="text-[10px] text-gray-400">{s.formats.join(' · ')}</p>
                                </div>
                                {selectedSource === s.id && <CheckCircle size={16} className="text-gray-900 ml-auto flex-shrink-0" />}
                            </button>
                        ))}
                    </div>

                    {/* Upload + Instructions */}
                    <div className="xl:col-span-2 space-y-4">
                        {/* How to export instructions */}
                        <div className={`rounded-2xl border p-5 ${source.color}`}>
                            <p className="text-xs font-black text-gray-700 uppercase tracking-widest mb-3">
                                How to export from {source.name}
                            </p>
                            <ol className="space-y-2">
                                {source.instructions.map((inst, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 ${source.badgeColor}`}>{i + 1}</span>
                                        {inst}
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                                <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Data that will be imported:</p>
                                <div className="flex flex-wrap gap-1">
                                    {source.fields.map((f, i) => (
                                        <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${source.badgeColor}`}>{f}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Drop zone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-white'}`}>
                            <input ref={fileRef} type="file" accept={source.formats.join(',')} className="hidden"
                                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                            {file ? (
                                <div>
                                    <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-black text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB · {source.name}</p>
                                    <button onClick={e => { e.stopPropagation(); setFile(null); setSummary(null); }}
                                        className="mt-2 text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1 mx-auto">
                                        <X size={12} /> Remove
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={36} className="text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm font-black text-gray-600">Drop your file here or click to browse</p>
                                    <p className="text-xs text-gray-400 mt-1">Supported: {source.formats.join(', ')}</p>
                                </div>
                            )}
                        </div>

                        {/* Progress */}
                        {importing && (
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <RefreshCw size={14} className="animate-spin text-blue-500" />
                                    <span className="text-sm font-black text-gray-700">Importing data... {progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Import button */}
                        <button onClick={runImport} disabled={!file || importing}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-gray-700 disabled:opacity-50 transition-all shadow-md">
                            {importing ? <><RefreshCw size={18} className="animate-spin" /> Importing...</> : <><Upload size={18} /> Start Import — {source.name}</>}
                        </button>

                        {/* Result summary */}
                        {summary && !importing && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className={`px-5 py-4 flex items-center gap-3 ${summary.totalImported > 0 ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-red-50 border-b border-red-100'}`}>
                                    {summary.totalImported > 0
                                        ? <CheckCircle size={20} className="text-emerald-600" />
                                        : <AlertCircle size={20} className="text-red-600" />}
                                    <div>
                                        <p className={`text-sm font-black ${summary.totalImported > 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                            {summary.totalImported > 0 ? `✅ Import Complete — ${summary.totalImported} records imported` : '⚠️ Import completed with issues'}
                                        </p>
                                        <p className="text-[10px] text-gray-500">{summary.file} · {new Date(summary.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {summary.results.map((r, i) => (
                                        <div key={i} className="px-5 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-gray-900">{r.entity}</p>
                                                {r.errors.map((e, j) => <p key={j} className="text-xs text-red-500 mt-0.5">{e}</p>)}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-mono">
                                                <span className="text-emerald-600 font-black">{r.imported} imported</span>
                                                {r.skipped > 0 && <span className="text-amber-600">{r.skipped} skipped</span>}
                                                <span className="text-gray-400">{r.total} total</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {summary.totalImported > 0 && (
                                    <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                                        <p className="text-xs text-blue-700 font-bold">
                                            ✅ Data is now available in your ERP. Go to Customers, Products, or Suppliers to view imported records.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── TEMPLATES TAB ── */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <p className="text-sm font-black text-blue-800 mb-1">📋 CSV Templates — Generic Format</p>
                        <p className="text-xs text-blue-700">Use these templates if your software doesn't support direct export. Fill in the data manually or via copy-paste, then upload.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { key: 'customers' as const, name: 'Customers Template', icon: '👥', desc: 'Name, Email, Phone, Address, Balance', rows: '3 sample rows' },
                            { key: 'products' as const, name: 'Products Template', icon: '📦', desc: 'Name, SKU, Price, Cost, Stock, Category', rows: '3 sample rows' },
                            { key: 'suppliers' as const, name: 'Suppliers Template', icon: '🏭', desc: 'Name, Email, Phone, Address, Contact', rows: '3 sample rows' },
                            { key: 'invoices' as const, name: 'Invoices Template', icon: '📄', desc: 'Invoice No, Customer, Date, Product, Amount', rows: '3 sample rows' },
                        ].map(t => (
                            <div key={t.key} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{t.icon}</span>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">{t.name}</p>
                                        <p className="text-xs text-gray-400">{t.desc}</p>
                                        <p className="text-[10px] text-gray-300">{t.rows} included</p>
                                    </div>
                                </div>
                                <button onClick={() => downloadTemplate(t.key)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-gray-700 transition-all">
                                    <Download size={12} /> Download
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Column Format Guide</p>
                        <div className="space-y-2 text-xs text-gray-600">
                            <p>• <strong>Required columns</strong> are in the template — do not remove them</p>
                            <p>• <strong>Column order</strong> doesn't matter — the system reads by header name</p>
                            <p>• <strong>Dates</strong> should be in YYYY-MM-DD format (e.g. 2024-01-15)</p>
                            <p>• <strong>Numbers</strong> should use . as decimal point (e.g. 34.99 not 34,99)</p>
                            <p>• <strong>Empty cells</strong> are OK — only Name is required for customers/suppliers</p>
                            <p>• <strong>Duplicates</strong> are automatically detected and skipped</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div className="space-y-3">
                    {history.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                            <Database size={40} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 font-bold">No imports yet</p>
                        </div>
                    ) : history.map((h, i) => {
                        const sourceDef = SOURCES.find(s => s.id === h.source);
                        return (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{sourceDef?.icon || '📁'}</span>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{h.file}</p>
                                            <p className="text-[10px] text-gray-400">{sourceDef?.name} · {new Date(h.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black px-3 py-1 rounded-full ${h.totalImported > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {h.totalImported} imported
                                    </span>
                                </div>
                                <div className="px-5 py-3 flex flex-wrap gap-4">
                                    {h.results.map((r, j) => (
                                        <div key={j} className="text-xs text-gray-600">
                                            <span className="font-black">{r.entity}:</span> {r.imported} imported · {r.skipped} skipped
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {history.length > 0 && (
                        <button onClick={() => { setHistory([]); localStorage.removeItem(IMPORT_HISTORY_KEY); }}
                            className="text-xs text-red-400 hover:text-red-600 font-bold transition-all">
                            Clear Import History
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
