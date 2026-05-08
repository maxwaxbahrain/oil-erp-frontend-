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

/** Shared API prefix (host + `/api`) for fallback fetches. */
function defaultApiPrefix(): string {
    const viteHost = String(import.meta.env.VITE_API_URL || '')
        .trim()
        .replace(/\/+$/, '');
    if (viteHost) return `${viteHost}/api`;
    const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (base) return base;
    return 'http://localhost:8000/api';
}

// Mock AI Engine Simulation with Product Catalog Integration
class AIStockService {
    private lastAdjustments: Record<string, AIStockAdjustment> = {};

    private getProductApiBases(): string[] {
        const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
        const candidates = [
            defaultApiPrefix(),
            envBase,
            '/api',
            'http://127.0.0.1:8000/api',
            'http://localhost:8000/api',
        ].filter(Boolean);
        return Array.from(new Set(candidates));
    }

    private async fetchProductsFromDatabase(): Promise<any[]> {
        const bases = this.getProductApiBases();
        for (const base of bases) {
            try {
                const response = await fetch(`${base}/products/?limit=5000`, { cache: 'no-store' });
                if (!response.ok) continue;
                const data = await response.json();
                if (Array.isArray(data)) return data;
            } catch {
                // try next candidate
            }
        }
        return [];
    }

    // Generate AI adjustments from real DB products
    private async generateAIAdjustments(): Promise<AIStockAdjustment[]> {
        const products = await this.fetchProductsFromDatabase();
        const adjustments: AIStockAdjustment[] = [];

        products.forEach((product) => {
            const currentStock = Number(product.stock ?? 0);
            const minStock = Number(product.min_stock ?? 0);
            const reorderQty = Math.max(1, Math.ceil((minStock > 0 ? minStock : 10) - currentStock));
            const productName = product.name || `Product ${product.id}`;
            const productId = String(product.id);

            // Low stock: always create pending approval using real stock values.
            if (currentStock <= minStock) {
                adjustments.push({
                    id: `ADJ-LOW-${productId}`,
                    productId,
                    productName,
                    currentStock,
                    suggestedAdjustment: reorderQty,
                    reason: 'demand_reorder',
                    description: `Low stock detected: current ${currentStock}, minimum ${minStock}. Replenishment approval required.`,
                    confidence: 92,
                    type: 'approval_required',
                    timestamp: new Date().toISOString(),
                    status: 'pending',
                    aiAnalysis: { forecastDays: 7, riskScore: currentStock <= 0 ? 80 : 35 }
                });
            }

            // Zero/negative stock creates critical investigation.
            if (currentStock <= 0) {
                adjustments.push({
                    id: `ADJ-CRIT-${productId}`,
                    productId,
                    productName,
                    currentStock,
                    suggestedAdjustment: Math.max(1, minStock || 10),
                    reason: 'sales_reconciliation',
                    description: `Critical stock state: ${currentStock}. Immediate validation and restock investigation required.`,
                    confidence: 70,
                    type: 'investigation_required',
                    timestamp: new Date().toISOString(),
                    status: 'pending',
                    aiAnalysis: { detectedPattern: 'Zero Stock', riskScore: 92 }
                });
            }

            // Normal healthy stock appears in auto-log.
            if (currentStock > minStock) {
                adjustments.push({
                    id: `ADJ-AUTO-${productId}`,
                    productId,
                    productName,
                    currentStock,
                    suggestedAdjustment: 0,
                    reason: 'sales_reconciliation',
                    description: `Inventory status healthy. Monitoring based on live catalog stock ${currentStock}.`,
                    confidence: 96,
                    type: 'auto',
                    timestamp: new Date().toISOString(),
                    status: 'auto_applied',
                    aiAnalysis: { riskScore: 8 }
                });
            }
        });

        return adjustments;
    }

    // Simulate finding anomalies
    async scanForAnomalies(): Promise<AIStockAdjustment[]> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const data = await this.generateAIAdjustments();
        this.lastAdjustments = data.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {} as Record<string, AIStockAdjustment>);
        return data;
    }

    async getInsights(): Promise<AIInsight[]> {
        const products = await this.fetchProductsFromDatabase();
        const lowStock = products.filter((p) => Number(p.stock ?? 0) <= Number(p.min_stock ?? 0)).length;
        const total = products.length;
        return [
            {
                id: 'INS-1',
                type: lowStock > 0 ? 'warning' : 'success',
                message: lowStock > 0
                    ? `${lowStock} products are below minimum stock and moved to pending approval`
                    : 'All products are above minimum stock levels',
                metric: `${lowStock}/${total}`,
            },
            {
                id: 'INS-2',
                type: 'info',
                message: 'Insights are generated from live product catalog database records',
                metric: 'LIVE',
            },
        ];
    }

    async approveAdjustment(id: string): Promise<boolean> {
        const adjustment = this.lastAdjustments[id];
        if (!adjustment) return true;

        const bases = this.getProductApiBases();
        const nextStock = adjustment.currentStock + adjustment.suggestedAdjustment;
        for (const base of bases) {
            try {
                const response = await fetch(`${base}/products/${adjustment.productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stock: nextStock }),
                });
                if (response.ok) return true;
            } catch {
                // try next candidate
            }
        }
        throw new Error('Failed to update product stock on backend');
    }

    async rejectAdjustment(_id: string): Promise<boolean> {
        await new Promise(r => setTimeout(r, 300));
        return true;
    }
}

export const aiStockService = new AIStockService();
