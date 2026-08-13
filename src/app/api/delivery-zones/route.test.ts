import { describe, it, expect, vi } from 'vitest';

// GET /api/delivery-zones is a thin wrapper around getDeliveryZones() — its
// whole job is translating { source } into the `stale` flag the checkout
// page uses to warn the customer, and translating a thrown error into a 503
// rather than letting it bubble into the generic Next.js error page.

const { mockGetDeliveryZones } = vi.hoisted(() => ({
  mockGetDeliveryZones: vi.fn(),
}));

vi.mock('@/lib/deliveryZones', () => ({
  getDeliveryZones: mockGetDeliveryZones,
}));

import { GET } from './route';

const ZONES = [{ id: 1, lga_name: 'Ikeja', fee: 500 }];

describe('GET /api/delivery-zones', () => {
  it('returns zones with stale: false when getDeliveryZones resolves from the live source', async () => {
    mockGetDeliveryZones.mockResolvedValue({ zones: ZONES, source: 'live' });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ zones: ZONES, stale: false });
  });

  it('returns zones with stale: true when getDeliveryZones resolves from the cache source', async () => {
    mockGetDeliveryZones.mockResolvedValue({ zones: ZONES, source: 'cache' });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ zones: ZONES, stale: true });
  });

  it('returns 503 with an error body when getDeliveryZones throws', async () => {
    mockGetDeliveryZones.mockRejectedValue(new Error('connection reset'));

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'Could not load delivery areas. Please check your connection and try again.',
    });
  });
});
