import { Ratelimit } from '@upstash/ratelimit';
import { NextRequest } from 'next/server';
import { redis } from './redisClient';

// Order creation: generous enough for a real customer placing an order,
// tight enough to stop a script from flooding the orders table.
export const orderCreateRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'ratelimit:orders:create',
    })
  : null;

// Order tracking: someone with the right order ID may retry a couple of
// times with typos, but this isn't a bulk lookup tool.
export const orderTrackRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'ratelimit:orders:track',
    })
  : null;

// Order fetch by id: only called by the success page right after payment
// verification, and requires a matching payment reference, but still
// rate-limited to slow down brute-forcing of the reference value.
export const orderGetRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'ratelimit:orders:get',
    })
  : null;

// Payment verification: makes a live outbound call to Paystack's verify API
// and mutates order status per request, so it needs the same protection as
// the other order-mutating routes to stop it being used to hammer Paystack.
export const paymentVerifyRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'ratelimit:payment:verify',
    })
  : null;

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
