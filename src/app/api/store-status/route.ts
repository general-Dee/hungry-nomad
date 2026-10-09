import { NextResponse } from 'next/server';
import { isWithinBusinessHours } from '@/lib/businessHours';
import { getStoreHours } from '@/lib/storeSettings';

export async function GET() {
  const hours = await getStoreHours();
  return NextResponse.json({
    open: isWithinBusinessHours(new Date(), hours),
    label: hours.label,
    closedOverride: hours.closedOverride,
  });
}
