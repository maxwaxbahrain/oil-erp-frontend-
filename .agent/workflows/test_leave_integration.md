---
description: How to test the Leave Management and Employee Portal integration
---

# Testing Leave Management & Employee Portal

This workflow guides you through verifying the integration between the new Leave Management Service and the Employee Portal.

1.  **Start the Application**:
    Run `npm run dev` in the terminal.

2.  **Access the Employee Portal**:
    -   Navigate to `http://localhost:5173/portal` (or click "Employee Portal" in the sidebar).
    -   Observe the "Good Afternoon, [Name]" greeting.
    -   Check "Leave Balance" card shows available days (e.g., 18 for PTO).

3.  **Submit a Leave Request**:
    -   Click "Review Balances" or the "Leave" tab.
    -   Click "New Request".
    -   Select "Sick Leave" (or another type).
    -   Choose dates and click "Submit Request".
    -   Verify the new request appears in "My Leave Requests" with "Pending" status.

4.  **Approve as Admin**:
    -   Navigate to `http://localhost:5173/finance/payroll` (Payroll Management).
    -   Locate the "Pending Leave Requests" widget.
    -   You should see the request you just created (e.g., "Sick Leave" for the employee).
    -   Click "Approve".

5.  **Verify Balance Update**:
    -   Return to the Employee Portal (`/portal`).
    -   Check the "Leave Balance" again. It should have decreased by the number of days you requested.
    -   In the "Leave" tab history, the request status should now be "Approved".

6.  **Verify Payroll Reflection (Simulated)**:
    -   In Payroll Management, click "Run Payroll".
    -   The system will process payroll. In a full implementation, this would account for unpaid leave deductions if applicable (currently simulated).
