/**
 * Menu categories for the shop.
 *
 * Categories are editable in the admin app (public.categories, added by the
 * admin repo's migration 20261027120000_editable_categories.sql). Until that
 * migration is applied the table does not exist, so everything here falls back
 * to the built-in list below and the menu looks exactly as it did before.
 *
 * products.category (the text slug) stays the source of truth for which
 * section an item is in, and for pricing (see TAKEAWAY_CATEGORIES in
 * pricing.ts). Slugs are immutable in the database, so existing links like
 * /menu?category=regular keep working after a category is renamed.
 */

export interface MenuCategory {
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** Categories that never get a tab on /menu (weekend has its own section). */
export const NON_TAB_SLUGS = ['weekend'];

export const FALLBACK_CATEGORIES: MenuCategory[] = [
  { slug: 'fast_food', name: 'Fast Food', sort_order: 10, is_active: true },
  { slug: 'regular', name: 'Regular Dishes', sort_order: 20, is_active: true },
  { slug: 'chinese', name: 'Chinese', sort_order: 30, is_active: true },
  { slug: 'icecream', name: 'Ice Cream', sort_order: 40, is_active: true },
  { slug: 'beverages', name: 'Beverages', sort_order: 50, is_active: true },
];

/** True when Supabase says the categories table (or a column) does not exist yet. */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code === '42P01' || code === 'PGRST205' || code === '42703') return true;
  return typeof message === 'string' && /does not exist|could not find the table/i.test(message);
}

export function titleCase(slug: string): string {
  return slug
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function sortCategories(list: MenuCategory[]): MenuCategory[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Turn raw rows from public.categories into a clean, sorted list. Returns null
 * when the rows are unusable (so the caller falls back to the built-in list).
 */
export function normaliseCategoryRows(rows: unknown): MenuCategory[] | null {
  if (!Array.isArray(rows)) return null;
  const out: MenuCategory[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.slug !== 'string' || !r.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({
      slug: r.slug,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : titleCase(r.slug),
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : 1000,
      is_active: r.is_active !== false,
    });
  }
  return out.length ? sortCategories(out) : null;
}

/**
 * The tabs to show on /menu: active categories in sort order, minus the
 * weekend section, plus (at the end) any slug that products use but the
 * category list does not know about, so no item is ever unreachable.
 */
export function menuTabs(categories: MenuCategory[], productSlugs: string[]): MenuCategory[] {
  const tabs = sortCategories(categories).filter((c) => c.is_active && !NON_TAB_SLUGS.includes(c.slug));
  const known = new Set(categories.map((c) => c.slug));
  let order = Math.max(0, ...tabs.map((t) => t.sort_order));
  for (const slug of Array.from(new Set(productSlugs))) {
    if (!slug || known.has(slug) || NON_TAB_SLUGS.includes(slug)) continue;
    known.add(slug);
    tabs.push({ slug, name: titleCase(slug), sort_order: ++order, is_active: true });
  }
  return tabs;
}

/** Slugs of categories that have been hidden in admin. */
export function hiddenSlugs(categories: MenuCategory[]): Set<string> {
  return new Set(categories.filter((c) => !c.is_active).map((c) => c.slug));
}

/** Known subcategory tabs, in the order the menu has always shown them. */
export const KNOWN_SUBCATEGORIES: Record<string, { all: string; subs: [string, string][] }> = {
  fast_food: { all: 'All Fast Food', subs: [['grills', 'Grills'], ['shawarma', 'Shawarma / Wraps'], ['fries', 'Fries']] },
  chinese: {
    all: 'All Chinese',
    subs: [['noodles', 'Noodles'], ['rice', 'Rice'], ['sausages', 'Sausages'], ['wings', 'Wings'], ['extras', 'Extras'], ['dips', 'Dips']],
  },
  regular: { all: 'All Regular', subs: [['sides', 'Sides']] },
};

const IGNORED_SUBS = new Set(['', 'general']);

/**
 * Subcategory tabs for one category: the known ones first (always shown, as
 * before), then any other subcategory used by items in that category.
 * Returns [] when there is nothing to filter by.
 */
export function subcategoryTabs(
  category: MenuCategory | undefined,
  products: { category: string; subcategory?: string | null }[]
): { value: string; label: string }[] {
  if (!category) return [];
  const known = KNOWN_SUBCATEGORIES[category.slug];
  const tabs: { value: string; label: string }[] = known ? known.subs.map(([value, label]) => ({ value, label })) : [];
  const seen = new Set(tabs.map((t) => t.value));
  const extra = new Set<string>();
  for (const p of products) {
    if (p.category !== category.slug || typeof p.subcategory !== 'string') continue;
    const sub = p.subcategory.trim();
    if (IGNORED_SUBS.has(sub.toLowerCase()) || seen.has(sub)) continue;
    extra.add(sub);
  }
  for (const sub of Array.from(extra).sort((a, b) => a.localeCompare(b))) tabs.push({ value: sub, label: titleCase(sub) });
  if (!tabs.length) return [];
  return [{ value: 'all', label: known?.all ?? `All ${category.name}` }, ...tabs];
}
