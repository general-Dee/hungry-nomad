import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import StickyCartBar from './StickyCartBar';
import { CartProvider, useCart } from '@/context/CartContext';
import { Product } from '@/types';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const product: Product = {
  id: 1,
  name: 'Suya',
  description: 'Spicy grilled beef',
  price: 1800,
  category: 'fast_food',
  image_url: '/suya.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

function Seeder() {
  const { addToCart } = useCart();
  return <button onClick={() => addToCart(product)}>seed</button>;
}

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe('StickyCartBar', () => {
  it('stays hidden while the cart is empty', () => {
    mockPathname = '/menu';
    render(<StickyCartBar />, { wrapper });
    expect(screen.queryByText(/View Cart/)).not.toBeInTheDocument();
  });

  it('appears with item count and total once the cart has items', async () => {
    mockPathname = '/menu';
    const user = userEvent.setup();
    render(
      <>
        <Seeder />
        <StickyCartBar />
      </>,
      { wrapper }
    );

    await user.click(screen.getByText('seed'));

    expect(screen.getByText('View Cart')).toBeInTheDocument();
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Cart/ })).toHaveAttribute('href', '/cart');
  });

  it.each(['/cart', '/checkout', '/success', '/cancel'])(
    'stays hidden on %s even with items in the cart',
    async (route) => {
      mockPathname = route;
      const user = userEvent.setup();
      render(
        <>
          <Seeder />
          <StickyCartBar />
        </>,
        { wrapper }
      );

      await user.click(screen.getByText('seed'));

      expect(screen.queryByText('View Cart')).not.toBeInTheDocument();
    }
  );
});
