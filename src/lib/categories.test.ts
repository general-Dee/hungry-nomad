import { describe, it, expect } from 'vitest';
import {
  FALLBACK_CATEGORIES,
  hiddenSlugs,
  isMissingTableError,
  menuTabs,
  normaliseCategoryRows,
  subcategoryTabs,
  titleCase,
} from './categories';

describe('normaliseCategoryRows', () => {
  it('sorts by sort_order and cleans rows', () => {
    const rows = [
      { slug: 'chinese', name: 'Chinese', sort_order: 30, is_active: true },
      { slug: 'regular', name: ' Rice & Stews ', sort_order: 10, is_active: true },
      { slug: 'regular', name: 'dup', sort_order: 1, is_active: true },
      { slug: 'desserts', name: '', sort_order: 20, is_active: false },
      { nope: true },
    ];
    expect(normaliseCategoryRows(rows)).toEqual([
      { slug: 'regular', name: 'Rice & Stews', sort_order: 10, is_active: true },
      { slug: 'desserts', name: 'Desserts', sort_order: 20, is_active: false },
      { slug: 'chinese', name: 'Chinese', sort_order: 30, is_active: true },
    ]);
  });

  it('returns null for unusable input so callers fall back', () => {
    expect(normaliseCategoryRows(null)).toBeNull();
    expect(normaliseCategoryRows([])).toBeNull();
  });
});

describe('isMissingTableError', () => {
  it('detects a missing table or column', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true);
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.categories'" })).toBe(true);
    expect(isMissingTableError({ message: 'relation "public.categories" does not exist' })).toBe(true);
    expect(isMissingTableError({ code: '57014', message: 'timeout' })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe('menuTabs', () => {
  it('uses the fallback order by default and never shows weekend', () => {
    expect(menuTabs(FALLBACK_CATEGORIES, ['weekend', 'regular']).map((t) => t.slug)).toEqual([
      'fast_food', 'regular', 'chinese', 'icecream', 'beverages',
    ]);
  });

  it('drops hidden categories and appends unknown product slugs', () => {
    const cats = [
      { slug: 'regular', name: 'Regular Dishes', sort_order: 10, is_active: true },
      { slug: 'chinese', name: 'Chinese', sort_order: 20, is_active: false },
      { slug: 'weekend', name: 'Weekend', sort_order: 900, is_active: true },
    ];
    expect(menuTabs(cats, ['chinese', 'soups', 'soups', ''])).toEqual([
      { slug: 'regular', name: 'Regular Dishes', sort_order: 10, is_active: true },
      { slug: 'soups', name: 'Soups', sort_order: 11, is_active: true },
    ]);
  });
});

describe('hiddenSlugs', () => {
  it('lists inactive slugs', () => {
    expect(Array.from(hiddenSlugs([{ slug: 'a', name: 'A', sort_order: 1, is_active: false }, ...FALLBACK_CATEGORIES]))).toEqual(['a']);
  });
});

describe('subcategoryTabs', () => {
  const regular = FALLBACK_CATEGORIES[1];
  it('keeps the known tabs and adds subcategories used by items', () => {
    const tabs = subcategoryTabs(regular, [
      { category: 'regular', subcategory: 'soups' },
      { category: 'regular', subcategory: 'General' },
      { category: 'regular', subcategory: '' },
      { category: 'chinese', subcategory: 'rice' },
    ]);
    expect(tabs).toEqual([
      { value: 'all', label: 'All Regular' },
      { value: 'sides', label: 'Sides' },
      { value: 'soups', label: 'Soups' },
    ]);
  });

  it('shows nothing for a category without subcategories', () => {
    expect(subcategoryTabs(FALLBACK_CATEGORIES[4], [{ category: 'beverages', subcategory: '' }])).toEqual([]);
    expect(subcategoryTabs(undefined, [])).toEqual([]);
  });

  it('uses the category name for new categories', () => {
    expect(subcategoryTabs({ slug: 'desserts', name: 'Desserts', sort_order: 60, is_active: true }, [{ category: 'desserts', subcategory: 'cakes' }])[0]).toEqual({
      value: 'all',
      label: 'All Desserts',
    });
  });
});

describe('titleCase', () => {
  it('formats slugs', () => {
    expect(titleCase('fast_food')).toBe('Fast Food');
    expect(titleCase('ice-cream')).toBe('Ice Cream');
  });
});
