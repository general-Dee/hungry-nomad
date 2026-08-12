import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import Header from './Header';
import { CartProvider, useCart } from '@/context/CartContext';
import { CartDrawerProvider, useCartDrawer } from '@/context/CartDrawerContext';
import { Product } from '@/types';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
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

function Seeder({ quantity = 0 }: { quantity?: number }) {
  const { addToCart, updateQuantity } = useCart();
  return (
    <button
      onClick={() => {
        if (quantity > 0) {
          addToCart(product);
          updateQuantity(product.id, quantity);
        }
      }}
    >
      seed
    </button>
  );
}

function renderHeader(quantity = 0) {
  return render(
    <CartProvider>
      <CartDrawerProvider>
        <Seeder quantity={quantity} />
        <Header />
      </CartDrawerProvider>
    </CartProvider>
  );
}

describe('Header', () => {
  afterEach(() => {
    vi.mocked(usePathname).mockReturnValue('/');
  });

  it('renders a Track order link pointing to /track', () => {
    renderHeader();
    const trackLink = screen.getByRole('link', { name: 'Track order' });
    expect(trackLink).toHaveAttribute('href', '/track');
  });

  it('highlights the Track order link and not Home/Menu when on /track', () => {
    vi.mocked(usePathname).mockReturnValue('/track');
    renderHeader();

    expect(screen.getByRole('link', { name: 'Track order' })).toHaveClass('text-accent-700');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('text-accent-700');
    expect(screen.getByRole('link', { name: 'Menu' })).not.toHaveClass('text-accent-700');
  });

  it('does not highlight the Track order link when on another route', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderHeader();

    expect(screen.getByRole('link', { name: 'Track order' })).not.toHaveClass('text-accent-700');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('text-accent-700');
  });

  it('does not show a cart count badge when the cart is empty', () => {
    renderHeader();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the total item count as a badge once items are in the cart', async () => {
    const user = userEvent.setup();
    renderHeader(3);
    await user.click(screen.getByText('seed'));

    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('opens the cart drawer when the header cart button is clicked', async () => {
    const user = userEvent.setup();

    function App() {
      return (
        <CartProvider>
          <CartDrawerProvider>
            <Header />
            <DrawerState />
          </CartDrawerProvider>
        </CartProvider>
      );
    }
    function DrawerState() {
      const { isOpen } = useCartDrawer();
      return <div data-testid="drawer-state">{isOpen ? 'open' : 'closed'}</div>;
    }

    render(<App />);
    expect(screen.getByTestId('drawer-state')).toHaveTextContent('closed');

    await user.click(screen.getAllByRole('button', { name: 'Open cart' })[0]);

    expect(screen.getByTestId('drawer-state')).toHaveTextContent('open');
  });
});
