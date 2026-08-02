export type RecentOrderRef = { id: number; phone: string };

const STORAGE_KEY = 'recentOrders';
const MAX_RECENT_ORDERS = 5;

export function getRecentOrders(): RecentOrderRef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentOrderRef => typeof r?.id === 'number' && typeof r?.phone === 'string'
    );
  } catch {
    return [];
  }
}

export function addRecentOrder(entry: RecentOrderRef): void {
  if (typeof window === 'undefined') return;
  const existing = getRecentOrders().filter((r) => r.id !== entry.id);
  const updated = [entry, ...existing].slice(0, MAX_RECENT_ORDERS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
