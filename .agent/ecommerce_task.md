
# Implementation Plan - E-Commerce Integration

This document outlines the implementation of the "E-Commerce Module" features, enabling multi-channel selling and inventory synchronization.

## 1. Overview
The **E-Commerce Module** allows the ERP to act as the central nervous system for online sales, syncing inventory and orders between the warehouse and platforms like Amazon, eBay, and Shopify.

## 2. Components Created
- **`src/pages/Ecommerce/EcommerceDashboard.tsx`**: The command center showing connected channels, live order stats, and immediate alerts (Part 2).
- **`src/pages/Ecommerce/ChannelIntegration.tsx`**: A configuration page to "Connect" marketplaces. Includes a detailed setup flow for Amazon MWS integration (Part 3).
- **`src/pages/Ecommerce/MultiChannelProducts.tsx`**: A product management view showing listing status per channel (Listed, Unlisted, Error). Includes a modal to "List on Amazon" with pricing markup logic (Part 4).
- **`src/pages/Ecommerce/UnifiedOrders.tsx`**: A combined order list for all channels. Includes a processing workflow for picking, packing, and shipping (Part 5).

## 3. Navigation
- **Sidebar Updated**: Added an "E-Commerce" section with links to Overview, Channels, Products, and Orders.
- **Routes Added**:
    - `/ecommerce/dashboard`
    - `/ecommerce/channels`
    - `/ecommerce/products`
    - `/ecommerce/orders`

## 4. Key Features Implemented
- **Visual Status Indicators**: Real-time "Live/Offline" badges for channels.
- **Channel Specifics**: Amazon-specific fields (Seller ID, MWS Token) in the integration setup.
- **Inventory Logic**: Visual cues for stock reserved by online orders vs. available stock.
- **Order Workflow**: Step-by-step processing from "Pending" to "Shipped".

## 5. Design
- Strictly adhered to the **Oracle Redwood** aesthetic with consistent colors (`redwood-brand`, `amber-500` for Amazon, etc.) and layout patterns.

## 6. Next Steps
- **Backend Integration**: Connect the `ChannelIntegration` form to a real backend service that talks to Amazon SP-API.
- **Inventory Webhooks**: Implement real-time webhooks to decrement stock instantly upon order receipt.
