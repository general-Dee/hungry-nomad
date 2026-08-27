export interface StoredAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  captured_at?: number;
}

const STORAGE_KEY = 'attribution';
const ATTRIBUTION_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;

/**
 * Reads ad-attribution params (UTMs + fbclid) directly off
 * window.location.search and, if any are present, stores them to
 * localStorage as the current attribution for this browser — last-click:
 * this always overwrites any previously stored value rather than merging,
 * so the most recent ad click a customer arrived from wins.
 *
 * Deliberately reads window.location.search directly instead of
 * useSearchParams() — this is a one-shot side effect (called from
 * MetaPixel's route-change effect), not reactive UI, and useSearchParams()
 * would force a Suspense boundary we don't otherwise need.
 */
export function captureAttributionFromUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const attribution: StoredAttribution = {};

    for (const key of ATTRIBUTION_PARAMS) {
      const value = params.get(key);
      if (value) attribution[key] = value;
    }

    if (Object.keys(attribution).length === 0) return;

    attribution.captured_at = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Ignore write/parse failures (e.g. quota exceeded, Safari private
    // mode) — attribution capture must never break page navigation.
  }
}

export function getStoredAttribution(): StoredAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    // This is optional, best-effort ad-tracking metadata, not core order
    // data — a corrupted/tampered localStorage value (a browser extension
    // writing a non-string into one of these keys, etc.) should never be
    // able to poison the order the customer is about to place. Only carry
    // forward fields that are actually strings; silently drop the rest
    // instead of failing the whole read.
    const parsedFields = parsed as Record<string, unknown>;
    const attribution: StoredAttribution = {};
    for (const key of ATTRIBUTION_PARAMS) {
      const value = parsedFields[key];
      if (typeof value === 'string') attribution[key] = value;
    }
    if (typeof parsedFields.captured_at === 'number') {
      attribution.captured_at = parsedFields.captured_at;
    }
    return attribution;
  } catch {
    return null;
  }
}
