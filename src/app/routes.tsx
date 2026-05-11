import { Routes, Route, Navigate } from 'react-router-dom';
import { Construction } from 'lucide-react';

// Pages
import Dashboard from '../pages/Dashboard/Dashboard';
import CustomerList from '../pages/Customers/CustomerList';
import CustomerOverview from '../pages/Customers/CustomerOverview';
import CustomerFormPage from '../pages/Customers/CustomerFormPage';
import SalesOverview from '../pages/Sales/SalesOverview';
import SalesOrdersWorkflow from '../pages/Sales/SalesOrdersWorkflow';
import SalesOrderFormPage from '../pages/Sales/SalesOrderFormPage';
import SalesOrderDetailPage from '../pages/Sales/SalesOrderDetailPage';
import Quotations from '../pages/Sales/Quotations';
import Invoices from '../pages/Sales/Invoices';
import InvoiceFormPage from '../pages/Sales/InvoiceFormPage';
import CreditNoteFormPage from '../pages/Sales/CreditNoteFormPage';
import CreditNotes from '../pages/Sales/CreditNotes';
import CreditNoteDetailPage from '../pages/Sales/CreditNoteDetailPage';
import SalesByProduct from '../pages/Sales/SalesByProduct';
import SalesByCustomer from '../pages/Sales/SalesByCustomer';
import SalesBySalesman from '../pages/Sales/SalesBySalesman';
import ProfitAnalysis from '../pages/Sales/ProfitAnalysis';
import VanPerformance from '../pages/Sales/VanPerformance';
import SalesReturns from '../pages/Sales/SalesReturns';
import SalesReturnFormPage from '../pages/Sales/SalesReturnFormPage';
import SalesReturnDetailPage from '../pages/Sales/SalesReturnDetailPage';
import VanSalesDashboard from '../pages/VanSales/VanSalesDashboard';
import VanSalesForm from '../pages/VanSales/VanSalesForm';
import VanSalesHistory from '../pages/VanSales/VanSalesHistory';
import VanManagement from '../pages/VanSales/VanManagement';
import AccountsDashboard from '../pages/Accounts/AccountsDashboard';
import ExpenseManagement from '../pages/Accounts/ExpenseManagement';
import PayrollManagement from '../pages/Accounts/PayrollManagement';
import ReportsDashboard from '../pages/Reports/ReportsDashboard';
import PurchasesDashboard from '../pages/Purchases/PurchasesDashboard';
import PurchaseOrderForm from '../pages/Purchases/PurchaseOrderForm';
import SupplierForm from '../pages/Purchases/SupplierForm';
import GoodsReceivedForm from '../pages/Inventory/GoodsReceivedForm';
import GoodsReceivedList from '../pages/Inventory/GoodsReceivedList';
import StockTransfer from '../pages/Inventory/StockTransfer';
import InventoryReports from '../pages/Inventory/InventoryReports';
import SettingsPage from '../pages/Settings/SettingsPage';
import SupplierList from '../pages/Purchases/SupplierList';
import CustomerEditPage from '../pages/Customers/CustomerEditPage';
import SupplierDetail from '../pages/Purchases/SupplierDetail';
import ProductManagement from '../pages/Inventory/ProductManagement';
import ProductForm from '../pages/Inventory/ProductForm';
import ProductOverview from '../pages/Inventory/ProductOverview';
import InvoiceImport from '../pages/Inventory/InvoiceImport';
import AIStockControl from '../pages/Inventory/AIStockControl';
import EmployeePortal from '../pages/Portal/EmployeePortal';
import ProfitabilityReports from '../pages/Reports/ProfitabilityReports';
import CustomerPriceLists from '../pages/Sales/CustomerPriceLists';
import RecurringInvoices from '../pages/Sales/RecurringInvoices';
import AgedReceivable from '../pages/Reports/AgedReceivable';
import AgedPayable from '../pages/Reports/AgedPayable';
import OutstandingBills from '../pages/Reports/OutstandingBills';
import DayBook from '../pages/Reports/DayBook';
import TrialBalance from '../pages/Reports/TrialBalance';
import Banking from '../pages/Accounts/Banking';
import ChartOfAccounts from '../pages/Accounts/ChartOfAccounts';
import JournalVoucher from '../pages/Accounts/JournalVoucher';
import PaymentEdit from '../pages/Accounts/PaymentEdit';
import BadDebtsJV from '../pages/Accounts/BadDebtsJV';
import AIHub from '../pages/AI/AIHub';
import AutoPOGeneration from '../pages/AI/AutoPOGeneration';
import AnomalyDetection from '../pages/AI/AnomalyDetection';
import CustomerForecast from '../pages/AI/CustomerForecast';
import RevenueForecast from '../pages/AI/RevenueForecast';
import AgentHub from '../pages/Agents/AgentHub';
import UserAccessManagement from '../pages/UserManagement/UserAccessManagement';
import NewsIntelligence from '../pages/News/NewsIntelligence';
import MarketingHub from '../pages/Marketing/MarketingHub';
import CreditIntelligence from '../pages/Credit/CreditIntelligence';
import CRMPage from '../pages/CRM/CRM'; // CRM exports as 'CRM'
import TaxSettings from '../pages/TaxSystem/TaxSettings';
import AmazonIntegration from '../pages/Amazon/AmazonIntegration';
import Pulse from '../pages/Pulse/Pulse';
import DataMigration from '../pages/Migration/DataMigration'; // CRM exports as 'CRM'
import AIContentStudio from '../pages/Marketing/AIContentStudio';
import { CustomerSegments, CampaignManager, MarketingAnalytics } from '../pages/Marketing/MarketingPages';
import CustomerServiceAgent from '../pages/Agents/CustomerServiceAgent';
import BusinessAdvisorAgent from '../pages/Agents/BusinessAdvisorAgent';
import DemandForecasting from '../pages/Reports/DemandForecasting';
import InventoryAdjustment from '../pages/Inventory/InventoryAdjustment';
import DriverApp from '../pages/POD/DriverApp';
import ManagementDashboard from '../pages/POD/ManagementDashboard';
import PODTestRunner from '../pages/POD/PODTestRunner';
import VanOperations from '../pages/Logistics/VanOperations';
import RouteNavigator from '../pages/Logistics/RouteNavigator';
import PublicInvoice from '../pages/PublicInvoice';

import OrganizationChart from '../pages/UserManagement/OrganizationChart';
import UserDirectory from '../pages/UserManagement/UserDirectory';
import RoleManager from '../pages/UserManagement/RoleManager';
import DistributorNetwork from '../pages/UserManagement/DistributorNetwork';
import DealerNetwork from '../pages/UserManagement/DealerNetwork';
import PartnerDirectory from '../pages/UserManagement/PartnerDirectory';
import OrgDashboard from '../pages/UserManagement/OrgDashboard';
import OrgPerformance from '../pages/UserManagement/OrgPerformance';
import OrgSettings from '../pages/UserManagement/OrgSettings';
// Placeholder Component
const PlaceholderPage = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-white rounded-xl border-2 border-dashed border-redwood-border/30">
        <div className="w-16 h-16 bg-redwood-bg-light rounded-full flex items-center justify-center mb-4 text-redwood-brand">
            <Construction size={32} />
        </div>
        <h2 className="text-2xl font-black text-redwood-text-main mb-2 uppercase">{title}</h2>
        <p className="text-redwood-text-muted max-w-md">
            This module is currently under development. Check back soon for updates or consult the implementation plan.
        </p>
    </div>
);

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/" element={<Dashboard />} />

            {/* Inventory & Products */}
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductOverview />} />
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products/import" element={<InvoiceImport />} />
            <Route path="/products/reports" element={<InventoryReports />} />

            <Route path="/inventory" element={<Navigate to="/products" replace />} />
            <Route path="/inventory/transfer" element={<StockTransfer />} />
            <Route path="/inventory/adjustments" element={<InventoryAdjustment />} />
            <Route path="/inventory/ai-stock-control" element={<AIStockControl />} />

            {/* Procurement */}
            <Route path="/purchases" element={<PurchasesDashboard />} />
            <Route path="/purchases/new" element={<PurchaseOrderForm />} />
            <Route path="/purchases/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/suppliers/edit/:id" element={<SupplierForm />} />
            <Route path="/receiving" element={<GoodsReceivedList />} />
            <Route path="/receiving/new" element={<GoodsReceivedForm />} />
            <Route path="/receiving/:id" element={<GoodsReceivedForm />} />

            {/* Sales & Revenue */}
            <Route path="/sales" element={<SalesOverview />} />
            <Route path="/sales/orders" element={<SalesOrdersWorkflow />} />
            <Route path="/sales/orders/new" element={<SalesOrderFormPage />} />
            <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
            <Route path="/sales/quotations" element={<Quotations />} />
            <Route path="/sales/estimates" element={<PlaceholderPage title="Sales Estimates" />} />
            <Route path="/sales/delivery-notes" element={<PlaceholderPage title="Delivery Notes" />} />
            <Route path="/sales/invoices" element={<Invoices />} />
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
            <Route path="/sales/invoices/:id" element={<InvoiceFormPage />} />
            <Route path="/sales/returns" element={<SalesReturns />} />
            <Route path="/sales/returns/new" element={<SalesReturnFormPage />} />
            <Route path="/sales/returns/edit/:id" element={<SalesReturnFormPage />} />
            <Route path="/sales/returns/:id" element={<SalesReturnDetailPage />} />
            <Route path="/sales/credit-notes" element={<CreditNotes />} />
            <Route path="/sales/credit-notes/new" element={<CreditNoteFormPage />} />
            <Route path="/sales/credit-notes/edit/:id" element={<CreditNoteFormPage />} />
            <Route path="/sales/credit-notes/:id" element={<CreditNoteDetailPage />} />
            <Route path="/sales/receipts" element={<PlaceholderPage title="Customer Receipts" />} />
            <Route path="/sales/payments" element={<PlaceholderPage title="Payments Received" />} />

            <Route path="/sales/by-product" element={<SalesByProduct />} />
            <Route path="/sales/by-customer" element={<SalesByCustomer />} />
            <Route path="/sales/by-salesman" element={<SalesBySalesman />} />
            <Route path="/sales/profit-analysis" element={<ProfitAnalysis />} />
            <Route path="/sales/van-performance" element={<VanPerformance />} />

            {/* Van Sales Module */}
            <Route path="/van-sales" element={<VanSalesDashboard />} />
            <Route path="/van-sales/new" element={<VanSalesForm />} />
            <Route path="/van-sales/history" element={<VanSalesHistory />} />
            <Route path="/van-sales/manage-vans" element={<VanManagement />} />

            {/* Customers — static paths before :id so /customers/new is not treated as an id */}
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerFormPage />} />
            <Route path="/customers/edit/:id" element={<CustomerEditPage />} />
            <Route path="/customers/:id" element={<CustomerOverview />} />

            {/* Finance & Operations */}
            <Route path="/finance/expenses" element={<ExpenseManagement />} />
            <Route path="/finance/payroll" element={<PayrollManagement />} />
            <Route path="/finance/accounting" element={<AccountsDashboard />} />
            <Route path="/finance/banking" element={<Banking />} />
            <Route path="/finance/chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="/finance/journal-voucher" element={<JournalVoucher />} />
            <Route path="/finance/payment-edit" element={<PaymentEdit />} />
            <Route path="/finance/bad-debts" element={<BadDebtsJV />} />
            <Route path="/ai" element={<AIHub />} />
            <Route path="/ai/auto-po" element={<AutoPOGeneration />} />
            <Route path="/ai/anomaly" element={<AnomalyDetection />} />
            <Route path="/ai/customer-forecast" element={<CustomerForecast />} />
            <Route path="/ai/revenue-forecast" element={<RevenueForecast />} />
            <Route path="/agents" element={<AgentHub />} />
            <Route path="/agents/customer-service" element={<CustomerServiceAgent />} />
            <Route path="/agents/business-advisor" element={<BusinessAdvisorAgent />} />
            <Route path="/access-management" element={<UserAccessManagement />} />
            <Route path="/news" element={<NewsIntelligence />} />
            <Route path="/credit" element={<CreditIntelligence />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/tax" element={<TaxSettings />} />
            <Route path="/amazon" element={<AmazonIntegration />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/migrate" element={<DataMigration />} />
            <Route path="/marketing" element={<MarketingHub />} />
            <Route path="/marketing/studio" element={<AIContentStudio />} />
            <Route path="/marketing/segments" element={<CustomerSegments />} />
            <Route path="/marketing/campaigns" element={<CampaignManager />} />
            <Route path="/marketing/analytics" element={<MarketingAnalytics />} />

            {/* Employee Portal - Module 15 */}
            <Route path="/portal" element={<EmployeePortal />} />

            <Route path="/accounts" element={<Navigate to="/finance/accounting" replace />} />

            {/* Logistics & Delivery */}
            <Route path="/logistics/pod" element={<DriverApp />} />
            <Route path="/pod/driver" element={<DriverApp />} />
            <Route path="/pod/management" element={<ManagementDashboard />} />
            <Route path="/pod/test" element={<PODTestRunner />} />
            <Route path="/logistics/operations" element={<VanOperations />} />
            <Route path="/logistics/routes" element={<RouteNavigator />} />
            <Route path="/routes" element={<Navigate to="/logistics/routes" replace />} />

            {/* User Management */}
            <Route path="/users/dashboard" element={<OrgDashboard />} />
            <Route path="/users/performance" element={<OrgPerformance />} />
            <Route path="/users/hierarchy" element={<OrganizationChart />} />
            <Route path="/users/settings" element={<OrgSettings />} />

            {/* Legacy/Detailed Routes (accessible via Dashboard) */}
            <Route path="/users/organization" element={<OrganizationChart />} />
            <Route path="/users/directory" element={<UserDirectory />} />
            <Route path="/users/roles" element={<RoleManager />} />
            <Route path="/users/distributors" element={<DistributorNetwork />} />
            <Route path="/users/dealers" element={<DealerNetwork />} />
            <Route path="/users/partners" element={<PartnerDirectory />} />

            {/* Reports */}
            <Route path="/reports/sales" element={<ProfitabilityReports />} />
            <Route path="/reports/demand-forecast" element={<DemandForecasting />} />
            <Route path="/sales/price-lists" element={<CustomerPriceLists />} />
            <Route path="/sales/recurring" element={<RecurringInvoices />} />
            <Route path="/reports/aged-receivable" element={<AgedReceivable />} />
            <Route path="/reports/aged-payable" element={<AgedPayable />} />
            <Route path="/reports/outstanding-bills" element={<OutstandingBills />} />
            <Route path="/reports/day-book" element={<DayBook />} />
            <Route path="/reports/trial-balance" element={<TrialBalance />} />
            <Route path="/reports" element={<ReportsDashboard />} />
            <Route path="/reports/*" element={<ReportsDashboard />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/users" element={<PlaceholderPage title="User Management" />} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
