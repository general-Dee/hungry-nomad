import crypto from 'crypto';

const META_CAPI_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// Normalize per Meta's rules before hashing: trim, lowercase, and (for
// phone) strip everything but digits.
function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashPhone(phone: string): string {
  const normalized = phone.trim().toLowerCase().replace(/[^\d]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Server-side Meta Conversions API Purchase event, fired as a best-effort
 * side effect once a payment is confirmed (src/lib/paystackPayment.ts's
 * confirmOrderPaid). Deduplicates against the client-side pixel Purchase
 * event (src/app/success/page.tsx) via a shared eventId — the Paystack
 * payment reference.
 *
 * Mirrors src/lib/ratelimit.ts's pattern of silently no-oping when its
 * required env vars are unset, rather than throwing.
 */
export async function sendMetaPurchaseEvent(params: {
  eventId: string;
  value: number;
  contentIds: string[];
  email?: string | null;
  phone?: string | null;
  eventSourceUrl?: string;
  fbc?: string | null;
}): Promise<void> {
  if (!META_CAPI_TOKEN || !META_PIXEL_ID) {
    console.warn('Meta Conversions API skipped: META_CONVERSIONS_API_TOKEN or NEXT_PUBLIC_META_PIXEL_ID not set');
    return;
  }

  const { eventId, value, contentIds, email, phone, eventSourceUrl, fbc } = params;

  // This call is awaited inside confirmOrderPaid's Promise.all, which is
  // itself awaited and returned directly by the verify-payment and webhook
  // routes — a hung request to Meta must never hang the customer-facing
  // payment-confirmation response for an order that's already been marked
  // paid. Bound the request with a short timeout so it always settles.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const userData: Record<string, string[] | string> = {};
    if (email) userData.em = [hashEmail(email)];
    if (phone) userData.ph = [hashPhone(phone)];
    // fbc is not hashed — per Meta's spec it's sent as plain text, unlike
    // em/ph which must be sha256-hashed.
    if (fbc) userData.fbc = fbc;

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${META_CAPI_TOKEN}`,
        },
        body: JSON.stringify({
          data: [
            {
              event_name: 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
              action_source: 'website',
              user_data: userData,
              custom_data: {
                value,
                currency: 'NGN',
                content_ids: contentIds,
                content_type: 'product',
              },
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.error('Meta Conversions API request failed', {
        status: response.status,
        body: await response.text(),
      });
    }
  } catch (error) {
    console.error('Meta Conversions API error:', error);
  } finally {
    clearTimeout(timeoutId);
  }
}
