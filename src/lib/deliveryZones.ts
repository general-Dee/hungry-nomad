import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabaseClient';
import { redis } from '@/lib/redisClient';
import { withRetry } from '@/lib/fetchWithRetry';
import { DeliveryZone } from '@/types';

const CACHE_KEY = 'cache:delivery_zones';
// Separate short-lived marker key used only to throttle how often we
// rewrite CACHE_KEY (see below) — never read for zone data itself.
const CACHE_WRITE_MARKER_KEY = 'cache:delivery_zones:last_written';
const CACHE_WRITE_INTERVAL_SECONDS = 60 * 60;
const ATTEMPTS = 2;
const TIMEOUT_MS = 5000;

export interface DeliveryZonesResult {
  zones: DeliveryZone[];
  source: 'live' | 'cache';
}

// Central place to fetch delivery zones with retry + Redis-backed fallback.
// Used both by the public /api/delivery-zones route (which the checkout page
// calls) and directly by POST /api/orders when re-deriving the delivery fee
// server-side — both need the same resilience against a transient Supabase
// outage.
export async function getDeliveryZones(): Promise<DeliveryZonesResult> {
  try {
    const zones = await withRetry<DeliveryZone[]>(
      async (signal) => {
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .order('lga_name', { ascending: true })
          .abortSignal(signal);
        if (error) throw error;
        // Treat zero rows the same as a failure so we fall through to the
        // cached fallback below rather than serving an empty list — an
        // empty `delivery_zones` table is never a legitimate live state.
        if (!data || data.length === 0) throw new Error('delivery_zones query returned no rows');
        return data;
      },
      { attempts: ATTEMPTS, timeoutMs: TIMEOUT_MS }
    );

    // Fire-and-forget cache write for the fallback path below. This is
    // static reference data maintained by a separate admin app, so no TTL on
    // the cached zones themselves — they're only ever replaced by the next
    // gated live write below. This endpoint is hit on every checkout page
    // load and every order submission, so rewriting the cache on every
    // single successful fetch would be wasteful Redis write volume for data
    // that rarely changes — gate it with a short-lived marker key so only
    // the first successful live fetch within each write-interval window
    // actually rewrites the cache.
    if (redis) {
      const client = redis;
      void client
        .set(CACHE_WRITE_MARKER_KEY, Date.now(), { nx: true, ex: CACHE_WRITE_INTERVAL_SECONDS })
        .then((acquired) => (acquired === 'OK' ? client.set(CACHE_KEY, zones) : null))
        .catch((cacheErr) => {
          console.error('Failed to cache delivery zones:', cacheErr);
        });
    }

    return { zones, source: 'live' };
  } catch (lastError) {
    // All attempts exhausted — log with enough detail to tell an RLS/
    // permission denial (Supabase/PostgREST errors carry .code/.details/
    // .hint) apart from a genuine network failure, since default Sentry
    // serialization of a plain error can lose those fields.
    const supabaseError = lastError as
      | { code?: string; message?: string; details?: string; hint?: string }
      | null;
    console.error('Failed to fetch delivery zones:', lastError);
    Sentry.captureException(lastError, {
      tags: { zone_fetch_error_code: supabaseError?.code ?? 'unknown' },
      extra: {
        supabaseErrorCode: supabaseError?.code,
        supabaseErrorMessage: supabaseError?.message,
        supabaseErrorDetails: supabaseError?.details,
        supabaseErrorHint: supabaseError?.hint,
        attempts: ATTEMPTS,
      },
    });

    if (redis) {
      try {
        const cached = await redis.get<DeliveryZone[]>(CACHE_KEY);
        // The cache is trusted at the type level only — validate shape at
        // runtime before letting `zone.fee` flow into server-authoritative
        // pricing, same as the client-side cache in deliveryZoneCache.ts.
        const validCached = (Array.isArray(cached) ? cached : []).filter(
          (z): z is DeliveryZone =>
            typeof z?.id === 'number' && typeof z?.lga_name === 'string' && typeof z?.fee === 'number'
        );
        if (validCached.length > 0) {
          return { zones: validCached, source: 'cache' };
        }
      } catch (cacheReadErr) {
        console.error('Failed to read cached delivery zones:', cacheReadErr);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Could not load delivery zones');
  }
}
