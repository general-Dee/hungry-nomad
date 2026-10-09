// Best-effort staff WhatsApp via Termii. Missing config must not fail payment.

function staffNumbers(): string[] {
  const raw = process.env.STAFF_WHATSAPP_NUMBERS || process.env.STAFF_NOTIFICATION_PHONE_NUMBERS || '';
  return raw
    .split(',')
    .map((n) => n.trim().replace(/^\+/, ''))
    .filter(Boolean);
}

export async function sendStaffOrderWhatsApp(order: {
  id: number | string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  delivery_lga?: string | null;
  total_amount?: number | null;
  customer_note?: string | null;
}, items: { product_name: string; quantity: number }[] = []): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;
  const numbers = staffNumbers();
  if (!apiKey || !senderId || numbers.length === 0) return;

  const itemLine = items.length
    ? items.map((item) => `${item.quantity}x ${item.product_name}`).join(', ')
    : '';
  const sms = [
    `Hungry Nomad paid order #${order.id}`,
    order.customer_name || '',
    order.customer_phone || '',
    order.total_amount != null ? `NGN ${Number(order.total_amount).toLocaleString()}` : '',
    [order.customer_address, order.delivery_lga].filter(Boolean).join(', '),
    itemLine,
    order.customer_note ? `Note: ${order.customer_note}` : '',
  ].filter(Boolean).join(' — ').slice(0, 1000);

  const results = await Promise.allSettled(numbers.map(async (to) => {
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to,
        from: senderId,
        sms,
        type: 'plain',
        channel: 'whatsapp',
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `Termii WhatsApp failed (${res.status})`);
    }
  }));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length === numbers.length) {
    throw (failures[0] as PromiseRejectedResult).reason;
  }
}
