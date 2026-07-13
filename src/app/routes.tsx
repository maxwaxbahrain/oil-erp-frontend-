import { Routes, Route, Navigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import ProtectedRoute from '../components/ProtectedRoute';
import ProductionLockedRoute from './ProductionLockedRoute';
import { FINANCE_ROLES, MANAGEMENT_ROLES, SALES_INTEL_ROLES, SPOD_AI_ROLES, SPOD_COMMON_ROLES, SALES_TOOL_ROLES, DRIVER_TOOL_ROLES, INTERNAL_WEB_ROLES, SALES_VOICE_ROLES } from '../utils/rbac';
import { isStaging } from '../config/appEnv';
import AccountingSetupRequired from '../components/common/AccountingSetupRequired';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import LandingPage from '../pages/LandingPage';
import PrivacyPolicy from '../pages/PrivacyPolicy';
import BillingPage from '../pages/BillingPage';
import BillingCheckoutSuccess from '../pages/Billing/BillingCheckoutSuccess';
import BillingCheckoutCancel from '../pages/Billing/BillingCheckoutCancel';
import SuperAdminPage from '../pages/SuperAdminPage';
import TenantProfilePage from '../pages/TenantProfilePage';

// Pages
import Dashboard from '../pages/Dashboard/Dashboard';
import FinanceDashboard from '../pages/Finance/FinanceDashboard';
import SalesDashboard from '../pages/Sales/SalesDashboard';
import WarehouseDashboard from '../pages/Warehouse/WarehouseDashboard';
import CustomerList from '../pages/Customers/CustomerList';
import CustomerOverview from '../pages/Customers/CustomerOverview';
import CustomerFormPage from '../pages/Customers/CustomerFormPage';
import SalesOverview from '../pages/Sales/SalesOverview';
import SalesOrdersWorkflow from '../pages/Sales/SalesOrdersWorkflow';
import SalesOrderFormPage from '../pages/Sales/SalesOrderFormPage';
import SalesOrderDetailPage from '../pages/Sales/SalesOrderDetailPage';
import Quotations from '../pages/Sales/Quotations';
import QuotationFormPage from '../pages/Sales/QuotationFormPage';
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
import OpeningBalances from '../pages/Accounts/OpeningBalances';
import ExpenseManagement from '../pages/Accounts/ExpenseManagement';
// STEP 6 — AI Bulk Upload for expenses (new route).
import ExpensesBulkUpload from '../pages/Accounts/ExpensesBulkUpload';
// STEP 7 — Expense Approval Queue (new route).
import ExpenseApprovals from '../pages/Accounts/ExpenseApprovals';
// STEP 8 — Mileage Tracker (new route).
import ExpenseMileageTracker from '../pages/Accounts/ExpenseMileageTracker';
// STEP 9 — Expense Reports + NL query (new route).
import ExpenseReports from '../pages/Accounts/ExpenseReports';
// STEP 10 — Expense Settings (new route).
import ExpenseSettingsPage from '../pages/Accounts/ExpenseSettingsPage';
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
import UserManagement from '../pages/Settings/UserManagement';
import ChangePassword from '../pages/Settings/ChangePassword';
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
// ITEM 11 — Central ledger page.
import AllAccountsLedger from '../pages/Accounts/AllAccountsLedger';
// TC-69 — Financial Statement page (P&L, Balance Sheet, Cash Flow).
import FinancialStatement from '../pages/Reports/FinancialStatement';
import PaymentEdit from '../pages/Accounts/PaymentEdit';
import BadDebtsJV from '../pages/Accounts/BadDebtsJV';
import AIHub from '../pages/AI/AIHub';
import AIHubDashboard from '../pages/AIHub/AIHubDashboard';
import AutoPOGeneration from '../pages/AI/AutoPOGeneration';
import AnomalyDetection from '../pages/AI/AnomalyDetection';
import AgentHub from '../pages/Agents/AgentHub';
import UserAccessManagement from '../pages/UserManagement/UserAccessManagement';
import NewsIntelligence from '../pages/News/NewsIntelligence';
import MarketingHub from '../pages/Marketing/MarketingHub';
import CreditIntelligence from '../pages/Credit/CreditIntelligence';
import CRMPage from '../pages/CRM/CRM'; // CRM exports as 'CRM'
import TaxSettings from '../pages/TaxSystem/TaxSettings';
import TaxEngine from '../pages/TaxSystem/TaxEngine';
import TaxCalculatorPage from '../pages/TaxSystem/Calculator';
import TaxTransactions from '../pages/TaxSystem/Transactions';
import TaxRates from '../pages/TaxSystem/Rates';
// Session 2F — Tax Filing wizard (Form 1120 / 1040 / Schedule C / 941).
import TaxFilingList from '../pages/TaxSystem/Filing/TaxFilingList';
import FilingWizardStart from '../pages/TaxSystem/Filing/FilingWizardStart';
import FilingWizard from '../pages/TaxSystem/Filing/FilingWizard';
import FilingPreview from '../pages/TaxSystem/Filing/FilingPreview';
// Session 3A — 96-form IRS catalog.
import TaxFormsLibrary from '../pages/TaxSystem/TaxFormsLibrary';
// Session 3B — AI Tax Advisor (SSE-streaming chat).
import TaxAdvisor from '../pages/TaxSystem/TaxAdvisor';
// Session 3C — live Tax Dashboard.
import TaxDashboard from '../pages/TaxSystem/TaxDashboard';
import AmazonIntegration from '../pages/Amazon/AmazonIntegration';
import Pulse from '../pages/Pulse/PulseDashboard';
import MeetingNotes from '../pages/Pulse/MeetingNotes';
import VoiceDashboard from '../pages/Voice/VoiceDashboard';
import VoiceCallHistory from '../pages/Voice/CallHistory';
import VoiceCallDetail from '../pages/Voice/CallDetail';
import VoiceAnalytics from '../pages/Voice/Analytics';
import VoiceCoachingRules from '../pages/Voice/CoachingRules';
import VoiceTenantOnboard from '../pages/Voice/TenantOnboard';
import DataMigration from '../pages/Migration/DataMigration'; // CRM exports as 'CRM'
import AIContentStudio from '../pages/Marketing/AIContentStudio';
import { CustomerSegments, CampaignManager, MarketingAnalytics } from '../pages/Marketing/MarketingPages';
import CustomerServiceAgent from '../pages/Agents/CustomerServiceAgent';
import BusinessAdvisorAgent from '../pages/Agents/BusinessAdvisorAgent';
import EmailReplyAgent from '../pages/Agents/EmailReplyAgent';
import InventoryAdjustment from '../pages/Inventory/InventoryAdjustment';
import DriverApp from '../pages/POD/DriverApp';
import ManagementDashboard from '../pages/POD/ManagementDashboard';
import VanOperations from '../pages/Logistics/VanOperations';
import RouteNavigator from '../pages/Logistics/RouteNavigator';
import VanTracking from '../pages/Logistics/VanTracking';
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/signup" element={isStaging ? <Navigate to="/login" replace /> : <SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/" element={<LandingPage />} />

            <Route element={<ProtectedRoute />}>
            {/* SPOD common — core self-service, catalog read, PULSE */}
            <Route element={<ProtectedRoute roles={SPOD_COMMON_ROLES} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/portal" element={<EmployeePortal />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/:id" element={<ProductOverview />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/pulse/notes" element={<MeetingNotes />} />
            </Route>

            {/* Sales SPOD tools — sales + internal staff (not driver) */}
            <Route element={<ProtectedRoute roles={SALES_TOOL_ROLES} />}>
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerFormPage />} />
            <Route path="/customers/edit/:id" element={<CustomerEditPage />} />
            <Route path="/customers/:id" element={<CustomerOverview />} />
            <Route path="/sales/orders" element={<SalesOrdersWorkflow />} />
            <Route path="/sales/orders/new" element={<SalesOrderFormPage />} />
            <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
            <Route path="/sales/quotations" element={<Quotations />} />
            <Route path="/sales/quotations/new" element={<QuotationFormPage />} />
            <Route path="/sales/quotations/:id" element={<QuotationFormPage />} />
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
            <Route path="/sales/price-lists" element={<CustomerPriceLists />} />
            <Route path="/sales/recurring" element={<RecurringInvoices />} />
            </Route>

            {/* Driver SPOD tools — logistics (not sales) */}
            <Route element={<ProtectedRoute roles={DRIVER_TOOL_ROLES} />}>
            <Route path="/logistics/pod" element={<DriverApp />} />
            <Route path="/pod/driver" element={<DriverApp />} />
            <Route path="/logistics/operations" element={<VanOperations />} />
            <Route path="/logistics/routes" element={<RouteNavigator />} />
            <Route path="/routes" element={<Navigate to="/logistics/routes" replace />} />
            </Route>

            {/* SPOD AI subset — ARIA, Marcus, AI Hub, news */}
            <Route element={<ProductionLockedRoute />}>
            <Route element={<ProtectedRoute roles={SPOD_AI_ROLES} />}>
            <Route path="/agents/customer-service" element={<CustomerServiceAgent />} />
            <Route path="/agents/business-advisor" element={<BusinessAdvisorAgent />} />
            <Route path="/ai/hub" element={<AIHubDashboard />} />
            <Route path="/news" element={<NewsIntelligence />} />
            </Route>
            </Route>

            {/* Sales voice — not for driver */}
            <Route element={<ProductionLockedRoute />}>
            <Route element={<ProtectedRoute roles={SALES_VOICE_ROLES} />}>
            <Route path="/voice" element={<Navigate to="/voice/dashboard" replace />} />
            <Route path="/voice/dashboard" element={<VoiceDashboard />} />
            <Route path="/voice/calls" element={<VoiceCallHistory />} />
            <Route path="/voice/calls/:callId" element={<VoiceCallDetail />} />
            </Route>
            </Route>

            <Route path="/settings/password" element={<ChangePassword />} />

            {/* Internal web staff — full ERP modules */}
            <Route element={<ProtectedRoute roles={INTERNAL_WEB_ROLES} />}>
            <Route path="/sales/dashboard" element={<SalesDashboard />} />
            <Route path="/warehouse/dashboard" element={<WarehouseDashboard />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products/import" element={<InvoiceImport />} />
            <Route path="/inventory" element={<Navigate to="/products" replace />} />
            <Route path="/inventory/transfer" element={<StockTransfer />} />
            <Route path="/inventory/ai-stock-control" element={<AIStockControl />} />
            <Route path="/purchases" element={<PurchasesDashboard />} />
            <Route path="/purchases/new" element={<PurchaseOrderForm />} />
            <Route path="/purchases/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/suppliers/edit/:id" element={<SupplierForm />} />
            <Route path="/receiving" element={<GoodsReceivedList />} />
            <Route path="/receiving/new" element={<GoodsReceivedForm />} />
            <Route path="/receiving/:id" element={<GoodsReceivedForm />} />
            <Route path="/sales" element={<SalesOverview />} />
            <Route path="/sales/estimates" element={<PlaceholderPage title="Sales Estimates" />} />
            <Route path="/sales/delivery-notes" element={<PlaceholderPage title="Delivery Notes" />} />
            <Route path="/sales/receipts" element={<PlaceholderPage title="Customer Receipts" />} />
            <Route path="/sales/payments" element={<PlaceholderPage title="Payments Received" />} />
            <Route path="/sales/by-product" element={<SalesByProduct />} />
            <Route path="/sales/by-customer" element={<SalesByCustomer />} />
            <Route path="/sales/by-salesman" element={<SalesBySalesman />} />
            <Route path="/sales/profit-analysis" element={<ProfitAnalysis />} />
            <Route path="/sales/van-performance" element={<VanPerformance />} />
            <Route path="/van-sales" element={<VanSalesDashboard />} />
            <Route path="/van-sales/new" element={<VanSalesForm />} />
            <Route path="/van-sales/history" element={<VanSalesHistory />} />
            <Route path="/van-sales/manage-vans" element={<VanManagement />} />
            <Route path="/pod/management" element={<ManagementDashboard />} />
            <Route path="/pod/test" element={<Navigate to="/pod/management" replace />} />
            <Route path="/accounts" element={<Navigate to="/finance/accounting" replace />} />
            </Route>

            {/* Finance — admin + accountant only (backend require_finance) */}
            <Route element={<ProtectedRoute roles={FINANCE_ROLES} />}>
            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route path="/finance/payroll" element={<PayrollManagement />} />
            <Route path="/finance/accounting" element={<AccountsDashboard />} />
            <Route path="/finance/opening-balances" element={<OpeningBalances />} />
            <Route path="/finance/banking" element={<Banking />} />
            <Route path="/finance/chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="/finance/journal-voucher" element={<JournalVoucher />} />
            <Route path="/finance/all-ledger" element={<AllAccountsLedger />} />
            <Route path="/finance/financial-statement" element={<FinancialStatement />} />
            <Route path="/finance/payment-edit" element={<PaymentEdit />} />
            <Route path="/finance/bad-debts" element={<BadDebtsJV />} />
            </Route>

            {/* Management — admin + manager + accountant (backend require_management) */}
            <Route element={<ProtectedRoute roles={MANAGEMENT_ROLES} />}>
            <Route path="/finance/expenses" element={<ExpenseManagement />} />
            <Route path="/finance/expenses/bulk-upload" element={<ExpensesBulkUpload />} />
            <Route path="/finance/expenses/approvals" element={<ExpenseApprovals />} />
            <Route path="/finance/expenses/mileage" element={<ExpenseMileageTracker />} />
            <Route path="/finance/expenses/reports" element={<ExpenseReports />} />
            <Route path="/finance/expenses/settings" element={<ExpenseSettingsPage />} />
            <Route path="/products/reports" element={<InventoryReports />} />
            <Route path="/inventory/adjustments" element={<InventoryAdjustment />} />
            <Route path="/reports/sales" element={<ProfitabilityReports />} />
            <Route path="/reports/aged-receivable" element={<AgedReceivable />} />
            <Route path="/reports/aged-payable" element={<AgedPayable />} />
            <Route path="/reports/outstanding-bills" element={<OutstandingBills />} />
            <Route path="/reports/day-book" element={<DayBook />} />
            <Route path="/reports/trial-balance" element={<TrialBalance />} />
            <Route path="/reports/financial" element={<ProfitabilityReports />} />
            <Route path="/reports/demand-forecast" element={<AccountingSetupRequired />} />
            <Route path="/reports" element={<ReportsDashboard />} />
            <Route path="/reports/*" element={<ReportsDashboard />} />
            <Route path="/logistics/tracking" element={<VanTracking />} />
            </Route>

            {/* Premium / AI — internal staff only (production lock retained) */}
            <Route element={<ProductionLockedRoute />}>
            <Route element={<ProtectedRoute roles={INTERNAL_WEB_ROLES} />}>
            <Route path="/ai" element={<AIHub />} />
            <Route path="/ai/auto-po" element={<AutoPOGeneration />} />
            <Route path="/ai/anomaly" element={<AnomalyDetection />} />
            <Route path="/ai/customer-forecast" element={<AccountingSetupRequired />} />
            <Route path="/ai/revenue-forecast" element={<AccountingSetupRequired />} />
            <Route path="/agents" element={<AgentHub />} />
            <Route path="/agents/email-reply" element={<EmailReplyAgent />} />
            <Route path="/voice/analytics" element={<VoiceAnalytics />} />
            <Route path="/voice/coaching-rules" element={<VoiceCoachingRules />} />
            <Route path="/marketing" element={<MarketingHub />} />
            <Route path="/marketing/studio" element={<AIContentStudio />} />
            <Route path="/marketing/segments" element={<CustomerSegments />} />
            <Route path="/marketing/campaigns" element={<CampaignManager />} />
            <Route path="/marketing/analytics" element={<MarketingAnalytics />} />
            </Route>
            <Route element={<ProtectedRoute roles={SALES_INTEL_ROLES} />}>
            <Route path="/credit" element={<CreditIntelligence />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/amazon" element={<AmazonIntegration />} />
            </Route>
            <Route element={<ProtectedRoute roles={FINANCE_ROLES} />}>
            <Route path="/tax" element={<TaxSettings />} />
            <Route path="/tax/engine" element={<TaxEngine />} />
            <Route path="/tax/calculator" element={<TaxCalculatorPage />} />
            <Route path="/tax/transactions" element={<TaxTransactions />} />
            <Route path="/tax/rates" element={<TaxRates />} />
            <Route path="/tax/filing" element={<TaxFilingList />} />
            <Route path="/tax/filing/new" element={<FilingWizardStart />} />
            <Route path="/tax/filing/wizard/:filingId" element={<FilingWizard />} />
            <Route path="/tax/filing/preview/:filingId" element={<FilingPreview />} />
            <Route path="/tax/forms" element={<TaxFormsLibrary />} />
            <Route path="/tax/advisor" element={<TaxAdvisor />} />
            <Route path="/tax/dashboard" element={<TaxDashboard />} />
            </Route>
            </Route>

            {/* Admin-only routes (tenant admin role) */}
            <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/migrate" element={<DataMigration />} />
                <Route path="/access-management" element={<UserAccessManagement />} />
                <Route path="/users/dashboard" element={<OrgDashboard />} />
                <Route path="/users/performance" element={<OrgPerformance />} />
                <Route path="/users/hierarchy" element={<OrganizationChart />} />
                <Route path="/users/settings" element={<OrgSettings />} />
                <Route path="/users/organization" element={<OrganizationChart />} />
                <Route path="/users/directory" element={<UserDirectory />} />
                <Route path="/users/roles" element={<RoleManager />} />
                <Route path="/users/distributors" element={<DistributorNetwork />} />
                <Route path="/users/dealers" element={<DealerNetwork />} />
                <Route path="/users/partners" element={<PartnerDirectory />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/billing" element={<BillingPage />} />
                <Route path="/billing/success" element={<BillingCheckoutSuccess />} />
                <Route path="/billing/cancel" element={<BillingCheckoutCancel />} />
                <Route path="/settings/users" element={<UserManagement />} />
            </Route>

            {/* Platform super-admin only (username === 'admin') */}
            <Route element={<ProtectedRoute superAdminOnly />}>
                <Route path="/superadmin" element={<SuperAdminPage />} />
                <Route path="/superadmin/emails" element={<SuperAdminPage />} />
                <Route path="/superadmin/tenant/:tenantId" element={<TenantProfilePage />} />
            </Route>

            <Route element={<ProductionLockedRoute />}>
                <Route element={<ProtectedRoute superAdminOnly />}>
                    <Route path="/voice/onboard" element={<VoiceTenantOnboard />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};
