import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SuccessPage from './page';

// Purchase-event tracking (GA4 + Meta Pixel) only fires once the browser
// re-fetches the order's own record from /api/orders/[id] — its
// total_amount/items are validated first, since that response is a second
// hop the confirmed-paid status doesn't itself guarantee is well-formed.
// These tests focus on that validation guard and on tracking not being able
// to downgrade an already-successful payment confirmation.

let searchParams = new URLSearchParams('reference=ref_1&order_id=5');
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: pushMock }),
}));

const { mockClearCart } = vi.hoisted(() => ({ mockClearCart: vi.fn() }));
vi.mock('@/context/CartContext', () => ({
  useCart: () => ({ clearCart: mockClearCart }),
}));

const { mockEvent, mockMetaPixelEvent } = vi.hoisted(() => ({
  mockEvent: vi.fn(),
  mockMetaPixelEvent: vi.fn(),
}));
vi.mock('@/lib/tracking', () => ({
  event: mockEvent,
  metaPixelEvent: mockMetaPixelEvent,
}));

const { mockCaptureException } = vi.hoisted(() => ({ mockCaptureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

function mockFetchResponses({ verify, order }: { verify: unknown; order: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/api/verify-payment')) {
        return Promise.resolve({ json: () => Promise.resolve(verify) });
      }
      if (url.includes('/api/orders/')) {
        return Promise.resolve({ json: () => Promise.resolve(order) });
      }
      throw new Error(`Unexpected fetch url in test: ${url}`);
    })
  );
}

describe('SuccessPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    mockClearCart.mockClear();
    mockEvent.mockClear();
    mockMetaPixelEvent.mockClear();
    mockCaptureException.mockClear();
    searchParams = new URLSearchParams('reference=ref_1&order_id=5');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects home without calling the verify API when reference or order_id is missing from the URL', async () => {
    searchParams = new URLSearchParams('reference=ref_1');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SuccessPage />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fires GA4 purchase and Meta Pixel Purchase (with the reference as eventID) when order data is valid', async () => {
    mockFetchResponses({
      verify: { success: true },
      order: {
        id: '5',
        total_amount: 3500,
        items: [{ product_id: 1, product_name: 'Suya', price_at_time: 3500, quantity: 1 }],
      },
    });

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() => expect(mockEvent).toHaveBeenCalled());

    expect(mockEvent).toHaveBeenCalledWith(
      'purchase',
      expect.objectContaining({ transaction_id: '5', value: 3500, currency: 'NGN' })
    );
    expect(mockMetaPixelEvent).toHaveBeenCalledWith(
      'Purchase',
      expect.objectContaining({ value: 3500, currency: 'NGN', content_ids: ['1'] }),
      'ref_1'
    );
  });

  it('skips both GA4 and Meta Pixel purchase events when total_amount is zero', async () => {
    mockFetchResponses({
      verify: { success: true },
      order: {
        id: '5',
        total_amount: 0,
        items: [{ product_id: 1, product_name: 'Suya', price_at_time: 3500, quantity: 1 }],
      },
    });

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Purchase tracking skipped: invalid order data',
        expect.anything()
      )
    );

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  it('skips both GA4 and Meta Pixel purchase events when total_amount is not a finite number', async () => {
    mockFetchResponses({
      verify: { success: true },
      order: {
        id: '5',
        total_amount: Infinity,
        items: [{ product_id: 1, product_name: 'Suya', price_at_time: 3500, quantity: 1 }],
      },
    });

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Purchase tracking skipped: invalid order data',
        expect.anything()
      )
    );

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  it('skips both GA4 and Meta Pixel purchase events when items is an empty array', async () => {
    mockFetchResponses({
      verify: { success: true },
      order: { id: '5', total_amount: 3500, items: [] },
    });

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Purchase tracking skipped: invalid order data',
        expect.anything()
      )
    );

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  it('skips both GA4 and Meta Pixel purchase events when items is missing entirely', async () => {
    mockFetchResponses({
      verify: { success: true },
      order: { id: '5', total_amount: 3500 },
    });

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Purchase tracking skipped: invalid order data',
        expect.anything()
      )
    );

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  it('still shows the success screen and reports to Sentry, without tracking, when fetching order details throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/verify-payment')) {
          return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
        }
        return Promise.reject(new Error('network down'));
      })
    );

    render(<SuccessPage />);
    await screen.findByText('Payment Successful!');
    await waitFor(() => expect(mockCaptureException).toHaveBeenCalled());

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });

  it('shows the error screen when payment verification itself is unsuccessful', async () => {
    mockFetchResponses({ verify: { success: false }, order: {} });

    render(<SuccessPage />);

    await screen.findByText("We're confirming your payment");
    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockMetaPixelEvent).not.toHaveBeenCalled();
  });
});
