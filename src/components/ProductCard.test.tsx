import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import ProductCard from './ProductCard';
import { CartProvider } from '@/context/CartContext';
import { MAX_ITEM_QUANTITY } from '@/lib/pricing';
import { Product } from '@/types';

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
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
});
