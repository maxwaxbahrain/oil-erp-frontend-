
# Implementation Plan - Van Sales & Inventory Integration

This document outlines the implementation of the "Online Van Sales Software" features, specifically focusing on Van Operations and Inventory Integration.

## 1. Overview
The system now includes a specialized **Van Operations Center** that links Warehouse Inventory with Van Sales. This serves as the "Central Control Dashboard" described in the requirements.

## 2. Components Created
- **`src/pages/Logistics/VanOperations.tsx`**: A multi-tab interface handling:
    - **Overview**: Central dashboard with KPI cards (Warehouse Stock, Van Stock, Revenue) and system health status.
    - **Loading**: "Start of Day" workflow allowing warehouse-to-van stock transfer with specific SKU selection.
    - **Unloading**: "End of Day" reconciliation, tracking products sold, returned, and calculating variance.
    - **Live Inventory**: Real-time visualization of stock distribution (Warehouse vs Vans) and recent movement logs.

## 3. Integration with Logistics
- **`src/pages/Logistics/PODDashboard.tsx`**: (Existing) Handles the "Proof of Delivery" aspect, tracking individual delivery statuses and driver performance.
- The new `VanOperations` module complements this by managing the *stock* that is being delivered.

## 4. Navigation
- Added `/logistics/operations` route.
- Updated Sidebar:
    - **POD Dashboard**: Focused on tracking and delivery completion.
    - **Van Operations**: Focused on inventory movement and daily reconciliation.

## 5. Design
- Followed Oracle Redwood aesthetic (Redwood/Midnight colors, flat cards, high density).
- Used `lucide-react` for icons and `recharts` for visualization.

## 6. Usage Flow
1.  **Morning**: Warehouse Manager goes to **Van Operations > Loading** to allocate stock to drivers.
2.  **Daytime**: Operations team monitors **Van Operations > Overview** and **POD Dashboard** for progress.
3.  **Evening**: Salesmen returns are processed in **Van Operations > Unloading** for reconciliation.
