'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const CartDrawerContext = createContext<{
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
} | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the user navigates (e.g. tapping Checkout inside it)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <CartDrawerContext.Provider
      value={{
        isOpen,
        openDrawer: () => setIsOpen(true),
        closeDrawer: () => setIsOpen(false),
      }}
    >
      {children}
    </CartDrawerContext.Provider>
  );
}

export const useCartDrawer = () => {
  const context = useContext(CartDrawerContext);
  if (!context) {
    throw new Error('useCartDrawer must be used within a CartDrawerProvider');
  }
  return context;
};
