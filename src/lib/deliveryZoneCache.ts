import { DeliveryZone } from '@/types';

const STORAGE_KEY = 'cachedDeliveryZones';

export function getCachedDeliveryZones(): DeliveryZone[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (z): z is DeliveryZone =>
        typeof z?.id === 'number' && typeof z?.lga_name === 'string' && typeof z?.fee === 'number'
    );
  } catch {
    return [];
  }
}

export function setCachedDeliveryZones(zones: DeliveryZone[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  } catch {
    // Ignore write failures (e.g. quota exceeded, Safari private mode) — a
    // successful live fetch must never throw just because we couldn't cache it.
  }
}
