

// ==========================================
// 🏖️ ENTERPRISE LEAVE MANAGEMENT ENGINE
// Module 4: Integrated Leave Management
// ==========================================

export type LeaveType =
    | 'Paid Time Off'
    | 'Sick Leave'
    | 'Casual Leave'
    | 'Maternity/Paternity'
    | 'Bereavement'
    | 'Unpaid Leave'
    | 'Work From Home';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeavePolicy {
    leaveType: LeaveType;
    annualQuota: number; // Days per year
    accrualRate: 'Monthly' | 'Annualy' | 'Upfront';
    canCarryForward: boolean;
    maxCarryForwardDays: number;
    requiresApproval: boolean;
    minNoticeDays: number;
}

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    status: LeaveStatus;
    appliedOn: string;
    approvedBy?: string;
    approvedOn?: string;
    rejectionReason?: string;
}

export interface Holiday {
    date: string;
    name: string;
    isMandatory: boolean;
}

// 🏢 Implementation of Enterprise Leave Policies
const DEFAULT_POLICIES: Record<LeaveType, LeavePolicy> = {
    'Paid Time Off': {
        leaveType: 'Paid Time Off',
        annualQuota: 18,
        accrualRate: 'Monthly', // 1.5 days per month
        canCarryForward: true,
        maxCarryForwardDays: 10,
        requiresApproval: true,
        minNoticeDays: 7
    },
    'Sick Leave': {
        leaveType: 'Sick Leave',
        annualQuota: 12,
        accrualRate: 'Upfront',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: false, // Auto-approve for simulation
        minNoticeDays: 0
    },
    'Casual Leave': {
        leaveType: 'Casual Leave',
        annualQuota: 7,
        accrualRate: 'Upfront',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: true,
        minNoticeDays: 2
    },
    'Maternity/Paternity': {
        leaveType: 'Maternity/Paternity',
        annualQuota: 90,
        accrualRate: 'Upfront',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: true,
        minNoticeDays: 30
    },
    'Bereavement': {
        leaveType: 'Bereavement',
        annualQuota: 5,
        accrualRate: 'Upfront',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: true,
        minNoticeDays: 0
    },
    'Unpaid Leave': {
        leaveType: 'Unpaid Leave',
        annualQuota: 365,
        accrualRate: 'Upfront',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: true,
        minNoticeDays: 7
    },
    'Work From Home': {
        leaveType: 'Work From Home',
        annualQuota: 24, // 2 days a month
        accrualRate: 'Monthly',
        canCarryForward: false,
        maxCarryForwardDays: 0,
        requiresApproval: true,
        minNoticeDays: 1
    }
};

// Storage Keys
const LEAVE_REQUESTS_KEY = 'zavi_leave_requests';

// ==========================================
// 🛠️ SERVICE FUNCTIONS
// ==========================================

export const getLeavePolicies = (): LeavePolicy[] => Object.values(DEFAULT_POLICIES);

export const getLeaveRequests = (): LeaveRequest[] => {
    const stored = localStorage.getItem(LEAVE_REQUESTS_KEY);
    if (stored) return JSON.parse(stored);

    // Seed Data
    const seed: LeaveRequest[] = [
        {
            id: 'REQ-101',
            employeeId: 'EMP001',
            employeeName: 'Sarah Johnson',
            leaveType: 'Paid Time Off',
            startDate: '2025-01-15',
            endDate: '2025-01-20',
            daysCount: 4,
            reason: 'Family Vacation',
            status: 'Pending',
            appliedOn: '2025-01-02'
        },
        {
            id: 'REQ-102',
            employeeId: 'EMP002',
            employeeName: 'Mike Chen',
            leaveType: 'Sick Leave',
            startDate: '2025-01-10',
            endDate: '2025-01-10',
            daysCount: 1,
            reason: 'Flu',
            status: 'Approved',
            appliedOn: '2025-01-10',
            approvedBy: 'System',
            approvedOn: '2025-01-10'
        }
    ];
    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(seed));
    return seed;
};

export const submitLeaveRequest = async (request: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn' | 'daysCount'>): Promise<LeaveRequest> => {
    // 1. Calculate Business Days (Simplified)
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

    // 2. Validate Policy
    const policy = DEFAULT_POLICIES[request.leaveType];
    if (daysCount > policy.annualQuota) {
        throw new Error(`Request exceeds annual quota for ${request.leaveType}`);
    }

    // 3. Create Request
    const newRequest: LeaveRequest = {
        ...request,
        id: `REQ-${Date.now()}`,
        status: 'Pending',
        appliedOn: new Date().toISOString().split('T')[0],
        daysCount
    };

    // 4. Save
    const requests = getLeaveRequests();
    requests.unshift(newRequest);
    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));

    // 5. Simulate AI/Auto Approval
    if (!policy.requiresApproval) {
        approveLeaveRequest(newRequest.id, 'Auto-System');
    }

    return newRequest;
};

export const approveLeaveRequest = async (requestId: string, approverId: string) => {
    const requests = getLeaveRequests();
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error('Request not found');

    requests[index].status = 'Approved';
    requests[index].approvedBy = approverId;
    requests[index].approvedOn = new Date().toISOString();

    // In a real system, we would deduct from employee balance here

    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
};

export const rejectLeaveRequest = async (requestId: string, reason: string) => {
    const requests = getLeaveRequests();
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error('Request not found');

    requests[index].status = 'Rejected';
    requests[index].rejectionReason = reason;

    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
};

export const getEmployeeLeaveBalance = (_employeeId: string): Record<LeaveType, { total: number, used: number, available: number }> => {
    // In a real system, this would query the DB. Here we calculate mock balances.
    // We'll simulate that every employee has used a random amount.

    const balances: any = {};

    (Object.keys(DEFAULT_POLICIES) as LeaveType[]).forEach(type => {
        const policy = DEFAULT_POLICIES[type];
        const total = policy.annualQuota;
        const used = Math.floor(Math.random() * (total / 3)); // Mock usage
        balances[type] = {
            total,
            used,
            available: total - used
        };
    });

    return balances;
};

export const getUpcomingHolidays = (): Holiday[] => [
    { date: '2025-01-01', name: 'New Year\'s Day', isMandatory: true },
    { date: '2025-01-20', name: 'Martin Luther King Jr. Day', isMandatory: true },
    { date: '2025-05-26', name: 'Memorial Day', isMandatory: true },
    { date: '2025-07-04', name: 'Independence Day', isMandatory: true },
    { date: '2025-09-01', name: 'Labor Day', isMandatory: true },
    { date: '2025-11-27', name: 'Thanksgiving Day', isMandatory: true },
    { date: '2025-12-25', name: 'Christmas Day', isMandatory: true }
];
