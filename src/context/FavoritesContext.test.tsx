import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { FavoritesProvider, useFavorites } from './FavoritesContext';

// Favorites state lives entirely client-side (reducer + localStorage) and
// gates the heart toggle / favorites filter across the menu UI, so a
// regression here would silently drop or duplicate a user's saved items.
// These tests exercise the reducer/context directly, mirroring
// CartContext.test.tsx.

function wrapper({ children }: { children: ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}

describe('FavoritesContext', () => {
  it('starts empty and marked as loaded once the localStorage read completes', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.favoriteIds).toEqual(new Set());
    // isLoaded flips true after the mount effect runs
    await act(async () => {});
    expect(result.current.isLoaded).toBe(true);
  });

  it('toggleFavorite adds an id, then removes it on a second call', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => result.current.toggleFavorite(1));
    expect(result.current.favoriteIds.has(1)).toBe(true);
    expect(result.current.isFavorite(1)).toBe(true);

    act(() => result.current.toggleFavorite(1));
    expect(result.current.favoriteIds.has(1)).toBe(false);
    expect(result.current.isFavorite(1)).toBe(false);
  });

  it('toggleFavorite tracks multiple ids independently', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => {
      result.current.toggleFavorite(1);
      result.current.toggleFavorite(2);
    });
    expect(result.current.favoriteIds).toEqual(new Set([1, 2]));

    act(() => result.current.toggleFavorite(1));
    expect(result.current.favoriteIds).toEqual(new Set([2]));
  });

  it('persists favorites to localStorage after the initial load completes', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await act(async () => {});
    act(() => result.current.toggleFavorite(3));
    const saved = JSON.parse(localStorage.getItem('favorites') ?? '[]');
    expect(saved).toEqual([3]);
  });

  it('hydrates existing favorites from localStorage on mount', async () => {
    localStorage.setItem('favorites', JSON.stringify([4, 5]));
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await act(async () => {});
    expect(result.current.favoriteIds).toEqual(new Set([4, 5]));
    expect(result.current.isFavorite(4)).toBe(true);
    expect(result.current.isFavorite(5)).toBe(true);
  });

  it('ignores corrupt localStorage content and starts with an empty favorites set', async () => {
    localStorage.setItem('favorites', '{not valid json');
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await act(async () => {});
    expect(result.current.favoriteIds).toEqual(new Set());
    expect(result.current.isLoaded).toBe(true);
  });

  it('throws a clear error when useFavorites is called outside a FavoritesProvider', () => {
    // Silence the expected React error boundary console.error noise for this case.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFavorites())).toThrow(
      'useFavorites must be used within a FavoritesProvider'
    );
    spy.mockRestore();
  });
});
