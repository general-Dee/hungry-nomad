import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import CartDrawer from './CartDrawer';
import { CartProvider, useCart } from '@/context/CartContext';
import { CartDrawerProvider, useCartDrawer } from '@/context/CartDrawerContext';
import { TAKEAWAY_FEE } from '@/lib/pricing';
import { Product } from '@/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const beverage: Product = {
  id: 1,
  name: 'Chapman',
  description: 'Fruity cocktail',
  price: 1500,
  category: 'beverages',
  image_url: '/chapman.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

const regularDish: Product = {
  id: 2,
  name: 'Egusi Soup',
  description: 'With assorted meat',
  price: 4000,
  category: 'regular',
  image_url: '/egusi.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Harness that seeds the cart and opens the drawer, mirroring how a real
// user reaches this state (add items, then open the cart), rather than
// reaching into context internals.
function Harness({ seed = [] as Product[] }: { seed?: Product[] }) {
  const { addToCart } = useCart();
  const { openDrawer } = useCartDrawer();
  return (
    <>
      <button
        onClick={() => {
          seed.forEach(addToCart);
          openDrawer();
        }}
      >
        seed-and-open
      </button>
      <CartDrawer />
    </>
  );
}

function renderDrawer(seed: Product[] = []) {
  return render(<Harness seed={seed} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <CartProvider>
        <CartDrawerProvider>{children}</CartDrawerProvider>
      </CartProvider>
    ),
  });
}

describe('CartDrawer', () => {
  it('renders nothing visible while closed', () => {
    renderDrawer();
    expect(screen.queryByText('Your Cart')).not.toBeInTheDocument();
  });

  it('shows an empty-cart state with a link back to the menu once opened with no items', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText('seed-and-open'));

    expect(screen.getByText('Your Cart')).toBeInTheDocument();
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse menu' })).toHaveAttribute('href', '/menu');
  });

  it('lists each cart item with its line total and no takeaway fee for non-triggering categories', async () => {
    const user = userEvent.setup();
    renderDrawer([beverage]);
    await user.click(screen.getByText('seed-and-open'));

    expect(screen.getByText('Chapman')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.queryByText('Takeaway pack fee')).not.toBeInTheDocument();
    // Subtotal and estimated total both equal 1500 (no takeaway fee, delivery TBD)
    expect(screen.getAllByText('₦1,500').length).toBeGreaterThanOrEqual(1);
  });

  it('adds the takeaway pack fee line and folds it into the estimated total for a triggering category', async () => {
    const user = userEvent.setup();
    renderDrawer([regularDish]);
    await user.click(screen.getByText('seed-and-open'));

    expect(screen.getByText('Takeaway pack fee')).toBeInTheDocument();
    expect(screen.getByText(`₦${TAKEAWAY_FEE.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText(`₦${(4000 + TAKEAWAY_FEE).toLocaleString()}`)).toBeInTheDocument();
  });

  it('increments an item quantity and updates its line total via the + button', async () => {
    const user = userEvent.setup();
    renderDrawer([beverage]);
    await user.click(screen.getByText('seed-and-open'));

    await user.click(screen.getByRole('button', { name: 'Increase quantity of Chapman' }));

    expect(screen.getByText('2')).toBeInTheDocument();
    // Line total, Subtotal, and Estimated total are all ₦3,000 here (no
    // takeaway fee for beverages, delivery is TBD), so multiple elements
    // match; assert the line total (1500 * 2) is among them.
    expect(screen.getAllByText('₦3,000').length).toBeGreaterThanOrEqual(1);
  });

  it('removes an item entirely when Remove is clicked, falling back to the empty state', async () => {
    const user = userEvent.setup();
    renderDrawer([beverage]);
    await user.click(screen.getByText('seed-and-open'));

    await user.click(screen.getByText('Remove'));

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('links Checkout to /checkout', async () => {
    const user = userEvent.setup();
    renderDrawer([beverage]);
    await user.click(screen.getByText('seed-and-open'));

    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout');
  });
});
