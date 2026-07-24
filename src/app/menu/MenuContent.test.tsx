import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import MenuContent from './MenuContent';
import { CartProvider } from '@/context/CartContext';
import { Product } from '@/types';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

const products: Product[] = [
  {
    id: 1,
    name: 'Shawarma Deluxe',
    description: 'Chicken shawarma wrap',
    price: 2500,
    category: 'fast_food',
    subcategory: 'shawarma',
    image_url: '/shawarma.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Loaded Fries',
    description: 'Fries with cheese sauce',
    price: 2000,
    category: 'fast_food',
    subcategory: 'fries',
    image_url: '/fries.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Fried Rice',
    description: 'With plantain and chicken',
    price: 3000,
    category: 'regular',
    image_url: '/friedrice.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 4,
    name: 'Chapman',
    description: 'Fruity mocktail',
    price: 1500,
    category: 'beverages',
    image_url: '/chapman.jpg',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('MenuContent', () => {
  it('shows every product under the "All" category by default', () => {
    searchParams = new URLSearchParams();
    render(<MenuContent initialProducts={products} />, { wrapper });

    for (const p of products) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
  });

  it('filters to only the selected category when a category tab is clicked', async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    render(<MenuContent initialProducts={products} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Beverages' }));

    expect(screen.getByText('Chapman')).toBeInTheDocument();
    // The previous category's grid is wrapped in AnimatePresence and takes a
    // moment to exit-animate out of the DOM, so wait for it to actually leave
    // rather than asserting the instant after the click resolves.
    await waitFor(() => expect(screen.queryByText('Shawarma Deluxe')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Fried Rice')).not.toBeInTheDocument());
  });

  it('pre-selects the category given in the ?category= URL param', () => {
    searchParams = new URLSearchParams('category=regular');
    render(<MenuContent initialProducts={products} />, { wrapper });

    expect(screen.getByText('Fried Rice')).toBeInTheDocument();
    expect(screen.queryByText('Shawarma Deluxe')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regular Dishes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('further filters by subcategory once a fast-food subcategory tab is clicked', async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    render(<MenuContent initialProducts={products} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Fast Food' }));
    expect(screen.getByText('Shawarma Deluxe')).toBeInTheDocument();
    expect(screen.getByText('Loaded Fries')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fries' }));
    expect(screen.getByText('Loaded Fries')).toBeInTheDocument();
    // Same AnimatePresence exit-animation delay as above.
    await waitFor(() => expect(screen.queryByText('Shawarma Deluxe')).not.toBeInTheDocument());
  });

  it('filters by search query across name and description, case-insensitively', async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    render(<MenuContent initialProducts={products} />, { wrapper });

    await user.type(screen.getByPlaceholderText('Search for a dish...'), 'CHEESE');

    expect(screen.getByText('Loaded Fries')).toBeInTheDocument();
    expect(screen.queryByText('Shawarma Deluxe')).not.toBeInTheDocument();
    expect(screen.queryByText('Fried Rice')).not.toBeInTheDocument();
  });

  it('shows a "no dishes match" message when search yields nothing', async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    render(<MenuContent initialProducts={products} />, { wrapper });

    await user.type(screen.getByPlaceholderText('Search for a dish...'), 'nonexistent dish xyz');

    expect(screen.getByText('No dishes match your search.')).toBeInTheDocument();
  });

  it('clears the search query when the clear (X) button is clicked', async () => {
    searchParams = new URLSearchParams();
    const user = userEvent.setup();
    render(<MenuContent initialProducts={products} />, { wrapper });

    const input = screen.getByPlaceholderText('Search for a dish...');
    await user.type(input, 'Chapman');
    expect(screen.queryByText('Fried Rice')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input).toHaveValue('');
    expect(screen.getByText('Fried Rice')).toBeInTheDocument();
  });
});
