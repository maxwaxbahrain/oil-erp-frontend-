// AI Types & Interfaces
export type AdjustmentType = 'auto' | 'approval_required' | 'investigation_required';
export type AdjustmentReason = 'shrinkage' | 'demand_reorder' | 'sales_reconciliation' | 'damage' | 'expiry' | 'location_balance';

export interface AIStockAdjustment {
    id: string;
    productId: string;
    productName: string;
    currentStock: number;
    suggestedAdjustment: number;
    reason: AdjustmentReason;
    description: string;
    confidence: number; // 0-100
    type: AdjustmentType;
    timestamp: string;
    status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
    aiAnalysis?: {
        detectedPattern?: string;
        riskScore: number;
        forecastDays?: number;
        shrinkageRate?: number;
    };
}

export interface AIInsight {
    id: string;
    type: 'success' | 'warning' | 'info';
    message: string;
    metric?: string;
}

// Mock AI Engine Simulation
class AIStockService {

    // Simulate finding anomalies
    async scanForAnomalies(): Promise<AIStockAdjustment[]> {
        return [
            {
                id: 'ADJ-001',
                productId: 'PROD-101',
                productName: 'Bettano 20W50 Motor Oil',
                currentStock: 156,
                suggestedAdjustment: -2,
                reason: 'shrinkage',
                description: 'Normal retail shrinkage (0.5% rate match)',
                confidence: 98,
                type: 'auto',
                timestamp: new Date().toISOString(),
                status: 'auto_applied',
                aiAnalysis: { shrinkageRate: 0.012, riskScore: 5 }
            },
            {
                id: 'ADJ-002',
                productId: 'PROD-105',
                productName: 'Oil Filter A123',
                currentStock: 48,
                suggestedAdjustment: 0,
                reason: 'demand_reorder',
                description: 'Usage velocity increased 25%. Reorder needed NOW.',
                confidence: 95,
                type: 'approval_required',
                timestamp: new Date().toISOString(),
                status: 'pending',
                aiAnalysis: { forecastDays: 8, riskScore: 20 }
            },
            {
                id: 'ADJ-003',
                productId: 'PROD-202',
                productName: 'Transmission Fluid ATF',
                currentStock: 100,
                suggestedAdjustment: -50,
                reason: 'sales_reconciliation',
                description: 'Critical Discrepancy: Sales recorded 0, Stock dropped 50.',
                confidence: 60,
                type: 'investigation_required',
                timestamp: new Date().toISOString(),
                status: 'pending',
                aiAnalysis: { detectedPattern: 'Missing Sales Record', riskScore: 90 }
            },
            {
                id: 'ADJ-004',
                productId: 'PROD-305',
                productName: 'Break Fluid DOT4',
                currentStock: 25,
                suggestedAdjustment: -5,
                reason: 'expiry',
                description: 'Batch expiring in 5 days. Low velocity.',
                confidence: 92,
                type: 'approval_required',
                timestamp: new Date().toISOString(),
                status: 'pending',
                aiAnalysis: { forecastDays: 120, riskScore: 40 }
            },
            {
                id: 'ADJ-005',
                productId: 'PROD-999',
                productName: 'Coolant Concentrate',
                currentStock: 200,
                suggestedAdjustment: -1,
                reason: 'damage',
                description: 'Expected damage reserve (0.5% historical rate)',
                confidence: 96,
                type: 'auto',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                status: 'auto_applied',
                aiAnalysis: { riskScore: 2 }
            }
        ];
    }

    async getInsights(): Promise<AIInsight[]> {
        return [
            { id: 'INS-1', type: 'success', message: 'Shrinkage rate decreased 0.3% this month', metric: '-0.3%' },
            { id: 'INS-2', type: 'success', message: 'Van 1 inventory accuracy hit 98.5%', metric: '98.5%' },
            { id: 'INS-3', type: 'warning', message: 'Warehouse Section B overdue for Cycle Count', metric: '60 Days' },
            { id: 'INS-4', type: 'info', message: 'Seasonal demand spike predicted in 2 weeks', metric: '+15%' },
        ];
    }

    async approveAdjustment(id: string): Promise<boolean> {
        console.log('Approving', id);
        await new Promise(r => setTimeout(r, 800));
        return true;
    }

    async rejectAdjustment(id: string): Promise<boolean> {
        console.log('Rejecting', id);
        await new Promise(r => setTimeout(r, 800));
        return true;
    }
}

export const aiStockService = new AIStockService();
