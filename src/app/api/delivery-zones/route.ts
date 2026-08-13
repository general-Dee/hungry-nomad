import { NextResponse } from 'next/server';
import { getDeliveryZones } from '@/lib/deliveryZones';

// GET /api/delivery-zones — public, read-only, low-value target, so no rate
// limiting here (unlike the order-mutating routes in src/lib/ratelimit.ts).
export async function GET() {
  try {
    const { zones, source } = await getDeliveryZones();
    return NextResponse.json({ zones, stale: source === 'cache' });
  } catch {
    return NextResponse.json(
      { error: 'Could not load delivery areas. Please check your connection and try again.' },
      { status: 503 }
    );
  }
}
