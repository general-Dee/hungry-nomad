import { describe, it, expect, vi, beforeEach } from 'vitest';

// getDeliveryZones() is the single source of `zone.fee`, which flows
// straight into computeOrderTotal() and therefore what a customer is
// charged — so beyond the plain live/cache happy paths, the cache-shape
// validation and fire-and-forget cache write are covered as first-class
// cases, not afterthoughts.

const { mockSupabaseFrom, mockRedisGet, mockRedisSet, setLiveResult, setLiveError } = vi.hoisted(() => {
  let liveResult: { data: unknown; error: unknown } = { data: [], error: null };

  const mockSupabaseFrom = vi.fn((table: string) => {
    if (table !== 'delivery_zones') throw new Error(`Unexpected table in test mock: ${table}`);
    return {
      select: () => ({
        order: () => ({
          abortSignal: () => Promise.resolve(liveResult),
        }),
      }),
    };
  });

  const mockRedisGet = vi.fn();
  const mockRedisSet = vi.fn().mockResolvedValue('OK');

  return {
    mockSupabaseFrom,
    mockRedisGet,
    mockRedisSet,
    setLiveResult: (data: unknown) => {
      liveResult = { data, error: null };
    },
    setLiveError: (error: unknown) => {
      liveResult = { data: null, error };
    },
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: mockSupabaseFrom },
}));

// redisClient is mutated per-test between "configured" (object with
// get/set) and "not configured" (null) via vi.doMock + resetModules, since
// deliveryZones.ts reads `redis` once at call time via a plain import.
let redisModuleValue: { get: typeof mockRedisGet; set: typeof mockRedisSet } | null = {
  get: mockRedisGet,
  set: mockRedisSet,
};

vi.mock('@/lib/redisClient', () => ({
  get redis() {
    return redisModuleValue;
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { getDeliveryZones } from './deliveryZones';

const ZONE_A = { id: 1, lga_name: 'Ikeja', fee: 500 };
const ZONE_B = { id: 2, lga_name: 'Surulere', fee: 700 };

describe('getDeliveryZones', () => {
  beforeEach(() => {
    mockSupabaseFrom.mockClear();
    mockRedisGet.mockReset();
    mockRedisSet.mockClear().mockResolvedValue('OK');
    setLiveResult([ZONE_A, ZONE_B]);
    redisModuleValue = { get: mockRedisGet, set: mockRedisSet };
  });

  it('returns live zones and their source when the query succeeds with rows', async () => {
    const result = await getDeliveryZones();
    expect(result).toEqual({ zones: [ZONE_A, ZONE_B], source: 'live' });
  });

  it('fire-and-forgets a cache write of the live result to Redis', async () => {
    await getDeliveryZones();
    expect(mockRedisSet).toHaveBeenCalledWith('cache:delivery_zones', [ZONE_A, ZONE_B]);
  });

  it('does not rewrite the zones cache on a second live fetch within the write-interval window', async () => {
    // Simulate Redis's real SET NX semantics for the write-throttle marker
    // key: the first call acquires it, subsequent calls within the window
    // fail (return null) until it "expires" — which the default
    // mockResolvedValue('OK') stub can't express.
    let markerAcquired = false;
    mockRedisSet.mockImplementation((key: string, _value: unknown, opts?: { nx?: boolean }) => {
      if (key === 'cache:delivery_zones:last_written' && opts?.nx) {
        if (markerAcquired) return Promise.resolve(null);
        markerAcquired = true;
        return Promise.resolve('OK');
      }
      return Promise.resolve('OK');
    });

    await getDeliveryZones();
    await getDeliveryZones();

    const zonesCacheWrites = mockRedisSet.mock.calls.filter(([key]) => key === 'cache:delivery_zones');
    expect(zonesCacheWrites).toHaveLength(1);
  });

  it('does not fail the overall call when the fire-and-forget cache write rejects', async () => {
    mockRedisSet.mockReset().mockRejectedValue(new Error('redis unavailable'));
    await expect(getDeliveryZones()).resolves.toEqual({ zones: [ZONE_A, ZONE_B], source: 'live' });
  });

  it('treats a zero-row live result as a failure and falls through to the cache', async () => {
    setLiveResult([]);
    mockRedisGet.mockResolvedValue([ZONE_A]);

    const result = await getDeliveryZones();
    expect(result).toEqual({ zones: [ZONE_A], source: 'cache' });
    // Never treated as a valid empty live result.
    expect(result.source).not.toBe('live');
  });

  it('falls back to a valid Redis cache when the live query fails on every retry attempt', async () => {
    setLiveError(new Error('connection reset'));
    mockRedisGet.mockResolvedValue([ZONE_A, ZONE_B]);

    const result = await getDeliveryZones();
    expect(result).toEqual({ zones: [ZONE_A, ZONE_B], source: 'cache' });
  });

  it('filters out malformed cache entries and does not return partial garbage', async () => {
    setLiveError(new Error('connection reset'));
    mockRedisGet.mockResolvedValue([
      ZONE_A,
      { id: 'not-a-number', lga_name: 'Yaba', fee: 900 },
      { id: 3, lga_name: 'Lekki' }, // missing fee
      { id: 4, fee: 1200 }, // missing lga_name
      null,
    ]);

    const result = await getDeliveryZones();
    expect(result).toEqual({ zones: [ZONE_A], source: 'cache' });
  });

  it('throws when the live query fails and nothing in the cache survives validation', async () => {
    setLiveError(new Error('connection reset'));
    mockRedisGet.mockResolvedValue([
      { id: 'bad', lga_name: 'Yaba', fee: 900 },
      { lga_name: 'Lekki', fee: 1200 },
    ]);

    await expect(getDeliveryZones()).rejects.toThrow('connection reset');
  });

  it('throws when the live query fails and the cache is empty', async () => {
    setLiveError(new Error('connection reset'));
    mockRedisGet.mockResolvedValue(null);

    await expect(getDeliveryZones()).rejects.toThrow('connection reset');
  });

  it('throws when the live query fails and the cache is not an array', async () => {
    setLiveError(new Error('connection reset'));
    mockRedisGet.mockResolvedValue({ id: 1, lga_name: 'Ikeja', fee: 500 });

    await expect(getDeliveryZones()).rejects.toThrow('connection reset');
  });

  it('works normally on the live path when Redis is not configured (client is null)', async () => {
    redisModuleValue = null;

    const result = await getDeliveryZones();
    expect(result).toEqual({ zones: [ZONE_A, ZONE_B], source: 'live' });
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('throws cleanly on the failure path when Redis is not configured, instead of erroring on a null client', async () => {
    redisModuleValue = null;
    setLiveError(new Error('connection reset'));

    await expect(getDeliveryZones()).rejects.toThrow('connection reset');
    expect(mockRedisGet).not.toHaveBeenCalled();
  });
});
