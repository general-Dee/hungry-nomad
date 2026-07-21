import { Order } from '@/types';

export type OrderStatus = Order['status'];

/**
 * Valid order-status transitions, keyed by current status.
 *
 * - pending -> paid: set by POST /api/verify-payment on a Paystack-amount-verified payment.
 * - pending -> failed: payment attempt abandoned/failed before ever succeeding.
 * - paid -> delivered: order handed to the customer.
 * - paid -> failed: covers a paid order that needs to be walked back (e.g. a refund/chargeback);
 *   this app has no refund flow today, but the state is allowed so a staff app isn't blocked on it.
 *
 * Anything not listed here (e.g. delivered -> pending, failed -> paid, any status -> itself)
 * is rejected. `delivered` and `failed` are terminal — no transitions out of them.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'failed'],
  paid: ['delivered', 'failed'],
  delivered: [],
  failed: [],
};

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'paid', 'failed', 'delivered'];

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates a proposed status transition, returning either `{ ok: true }` or
 * `{ ok: false, error }` with a human-readable reason suitable for an API response.
 */
export function validateTransition(
  from: OrderStatus,
  to: OrderStatus
): { ok: true } | { ok: false; error: string } {
  if (!isValidOrderStatus(to)) {
    return { ok: false, error: `Invalid status "${to}". Must be one of: ${ORDER_STATUSES.join(', ')}.` };
  }

  if (!canTransition(from, to)) {
    return { ok: false, error: `Cannot transition order from "${from}" to "${to}".` };
  }

  return { ok: true };
}
