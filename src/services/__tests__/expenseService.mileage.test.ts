import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/axios', () => ({
    authFetch: vi.fn(),
}));

function http(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as Response;
}

describe('expenseService mileage API', () => {
    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('getMileageSettings reads tenant defaults', async () => {
        const { authFetch } = await import('../../api/axios');
        vi.mocked(authFetch).mockResolvedValueOnce(
            http({ distance_unit: 'miles', mileage_rate: 0.7 }),
        );
        const { getMileageSettings } = await import('../expenseService');
        const s = await getMileageSettings();
        expect(s).toEqual({ distance_unit: 'miles', mileage_rate: 0.7 });
    });

    it('patchMileageSettings sends distance_unit and mileage_rate', async () => {
        const { authFetch } = await import('../../api/axios');
        vi.mocked(authFetch).mockResolvedValueOnce(
            http({ distance_unit: 'km', mileage_rate: 0.45 }),
        );
        const { patchMileageSettings } = await import('../expenseService');
        const s = await patchMileageSettings({ distance_unit: 'km', mileage_rate: 0.45 });
        expect(s.mileage_rate).toBe(0.45);
        expect(vi.mocked(authFetch).mock.calls[0]?.[1]).toMatchObject({
            method: 'PATCH',
            body: JSON.stringify({ distance_unit: 'km', mileage_rate: 0.45 }),
        });
    });

    it('createMileageTrip POSTs camelCase createExpense and roundTrip', async () => {
        const { authFetch } = await import('../../api/axios');
        vi.mocked(authFetch).mockResolvedValueOnce(
            http({
                id: 9,
                date: '2026-10-23T00:00:00',
                origin: 'A',
                destination: 'B',
                distance: 24.8,
                unit: 'miles',
                rate: 0.7,
                round_trip: true,
                purpose: 'Visit',
                amount: 17.36,
                expense_id: 3,
            }, 201),
        );
        const { createMileageTrip } = await import('../expenseService');
        const trip = await createMileageTrip({
            date: '2026-10-23',
            origin: 'A',
            destination: 'B',
            distance: 12.4,
            roundTrip: true,
            purpose: 'Visit',
            createExpense: true,
        });
        expect(trip.amount).toBe(17.36);
        expect(vi.mocked(authFetch).mock.calls[0]?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                date: '2026-10-23',
                origin: 'A',
                destination: 'B',
                distance: 12.4,
                roundTrip: true,
                purpose: 'Visit',
                createExpense: true,
            }),
        });
    });

    it('estimateMileage parses distance in requested unit with fallback', async () => {
        const { authFetch } = await import('../../api/axios');
        vi.mocked(authFetch).mockResolvedValueOnce(
            http({ reply: '{"distance_miles": 12.4, "confidence": "approximate", "note": ""}' }),
        );
        const { estimateMileage } = await import('../expenseService');
        const est = await estimateMileage('Home', 'Office', 'miles');
        expect(est.distance).toBe(12.4);
        expect(est.unit).toBe('miles');
    });
});
