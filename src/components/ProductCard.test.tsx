import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import ProductCard from './ProductCard';
import { CartProvider } from '@/context/CartContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';
import { Product } from '@/types';

const { mockMetaPixelEvent } = vi.hoisted(() => ({ mockMetaPixelEvent: vi.fn() }));
vi.mock('@/lib/tracking', () => ({
  metaPixelEvent: mockMetaPixelEvent,
}));

// vitest.setup.ts stubs a no-op global IntersectionObserver (just enough for
// framer-motion's whileInView to mount without throwing) — its `observe()`
// never actually invokes the callback. The ViewContent tests below need to
// simulate a real intersection, so they install this richer fake that
// captures the callback and lets a test fire it manually.
class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  callback: IntersectionObserverCallback;
  disconnected = false;
  observe = vi.fn();
  unobserve = vi.fn();
  // Mirrors real IntersectionObserver semantics (rather than being a bare
  // vi.fn()): once disconnected, it stops delivering entries, since
  // ProductCard's callback relies on that to only ever fire once.
  disconnect = vi.fn(() => {
    this.disconnected = true;
  });
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  trigger(isIntersecting: boolean) {
    if (this.disconnected) return;
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <FavoritesProvider>{children}</FavoritesProvider>
    </CartProvider>
  );
}

const product: Product = {
  id: 42,
  name: 'Peppered Chicken',
  description: 'Grilled and peppered',
  price: 3500,
  category: 'fast_food',
  image_url: '/chicken.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('ProductCard', () => {
  beforeEach(() => {
    mockMetaPixelEvent.mockClear();
  });

  afterEach(() => {
    FakeIntersectionObserver.instances = [];
  });

  it('shows product name, price and an "Add to Cart" button when not in the cart', () => {
    render(<ProductCard product={product} />, { wrapper });
    expect(screen.getByText('Peppered Chicken')).toBeInTheDocument();
    expect(screen.getByText('₦3,500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
  });

  it('switches to a quantity stepper showing 1 after "Add to Cart" is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(screen.queryByRole('button', { name: 'Add to Cart' })).not.toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('increments the shown quantity when the + stepper is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await user.click(screen.getByRole('button', { name: `Increase quantity of ${product.name}` }));

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('decrements back to the "Add to Cart" button once quantity returns to 0', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await user.click(screen.getByRole('button', { name: `Decrease quantity of ${product.name}` }));

    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
  });

  it('disables the + button and shows a max-quantity hint once the cap is reached', () => {
    localStorage.setItem(
      'cart',
      JSON.stringify([{ ...product, quantity: MAX_ITEM_QUANTITY }])
    );
    render(<ProductCard product={product} />, { wrapper });

    const increment = screen.getByRole('button', { name: `Increase quantity of ${product.name}` });
    expect(increment).toBeDisabled();
    expect(screen.getByText(`Max ${MAX_ITEM_QUANTITY} per item`)).toBeInTheDocument();
  });

  it('renders a favorite toggle button that starts unfavorited', () => {
    render(<ProductCard product={product} />, { wrapper });
    const favoriteButton = screen.getByRole('button', { name: `Add ${product.name} to favorites` });
    expect(favoriteButton).toBeInTheDocument();
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles the favorited visual/aria state when the heart button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });

    const favoriteButton = screen.getByRole('button', { name: `Add ${product.name} to favorites` });
    await user.click(favoriteButton);

    const updatedButton = screen.getByRole('button', { name: `Remove ${product.name} from favorites` });
    expect(updatedButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(updatedButton);
    const revertedButton = screen.getByRole('button', { name: `Add ${product.name} to favorites` });
    expect(revertedButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not trigger add-to-cart behavior when the favorite button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });

    await user.click(screen.getByRole('button', { name: `Add ${product.name} to favorites` }));

    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('fires an AddToCart Meta Pixel event with the product id and price when "Add to Cart" is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={product} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(mockMetaPixelEvent).toHaveBeenCalledTimes(1);
    expect(mockMetaPixelEvent).toHaveBeenCalledWith('AddToCart', {
      value: product.price,
      currency: 'NGN',
      content_ids: [product.id.toString()],
      content_type: 'product',
      contents: [{ id: product.id.toString(), quantity: 1 }],
    });
  });

  it('does not fire an AddToCart event just from rendering, only from the click', () => {
    render(<ProductCard product={product} />, { wrapper });
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  describe('ViewContent tracking', () => {
    let originalIntersectionObserver: typeof window.IntersectionObserver;

    beforeEach(() => {
      originalIntersectionObserver = window.IntersectionObserver;
      FakeIntersectionObserver.instances = [];
      window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
      global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
      window.IntersectionObserver = originalIntersectionObserver;
      global.IntersectionObserver = originalIntersectionObserver;
    });

    it('fires a ViewContent Meta Pixel event and disconnects once the card intersects the viewport', () => {
      render(<ProductCard product={product} />, { wrapper });
      expect(FakeIntersectionObserver.instances).toHaveLength(1);
      const observer = FakeIntersectionObserver.instances[0];

      act(() => observer.trigger(true));

      expect(mockMetaPixelEvent).toHaveBeenCalledWith('ViewContent', {
        value: product.price,
        currency: 'NGN',
        content_ids: [product.id.toString()],
        content_type: 'product',
      });
      expect(observer.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not fire ViewContent while the card has not intersected the viewport', () => {
      render(<ProductCard product={product} />, { wrapper });
      const observer = FakeIntersectionObserver.instances[0];

      act(() => observer.trigger(false));

      expect(mockMetaPixelEvent).not.toHaveBeenCalledWith('ViewContent', expect.anything());
      expect(observer.disconnect).not.toHaveBeenCalled();
    });

    it('fires ViewContent only once even if the intersection callback runs again before disconnect takes effect', () => {
      render(<ProductCard product={product} />, { wrapper });
      const observer = FakeIntersectionObserver.instances[0];

      act(() => observer.trigger(true));
      act(() => observer.trigger(true));

      const viewContentCalls = mockMetaPixelEvent.mock.calls.filter(([eventName]) => eventName === 'ViewContent');
      expect(viewContentCalls).toHaveLength(1);
    });
  });
});
