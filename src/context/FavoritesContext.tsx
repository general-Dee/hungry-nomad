'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';

type FavoritesState = Set<number>;

type FavoritesAction =
  | { type: 'TOGGLE'; payload: number }
  | { type: 'HYDRATE'; payload: number[] };

const FavoritesContext = createContext<{
  favoriteIds: FavoritesState;
  isLoaded: boolean;
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
} | null>(null);

const favoritesReducer = (state: FavoritesState, action: FavoritesAction): FavoritesState => {
  switch (action.type) {
    case 'TOGGLE': {
      const next = new Set(state);
      if (next.has(action.payload)) {
        next.delete(action.payload);
      } else {
        next.add(action.payload);
      }
      return next;
    }
    case 'HYDRATE':
      return new Set(action.payload);
    default:
      return state;
  }
};

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [favoriteIds, dispatch] = useReducer(favoritesReducer, new Set<number>());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount. Dispatches HYDRATE once with the
  // full parsed array (rather than replaying TOGGLE per item) so this stays
  // correct even if React Strict Mode double-invokes this effect in dev.
  useEffect(() => {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as number[];
        dispatch({ type: 'HYDRATE', payload: parsed });
      } catch {
        // Ignore parse errors – favorites will start empty
      }
    }
    setIsLoaded(true);
  }, []);

  // Save favorites to localStorage on change (skip until the initial load above
  // has run, so we don't briefly overwrite storage with the empty pre-hydration state)
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('favorites', JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds, isLoaded]);

  const toggleFavorite = useCallback((id: number) => dispatch({ type: 'TOGGLE', payload: id }), []);
  const isFavorite = useCallback((id: number) => favoriteIds.has(id), [favoriteIds]);

  const value = useMemo(
    () => ({
      favoriteIds,
      isLoaded,
      toggleFavorite,
      isFavorite,
    }),
    [favoriteIds, isLoaded, toggleFavorite, isFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
