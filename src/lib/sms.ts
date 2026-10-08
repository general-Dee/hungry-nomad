// Best-effort customer SMS after a verified payment. Missing Termii config
// must not fail payment confirmation.

export async function sendCustomerPaidSms(order: {
  id: number | string;
  customer_phone?: string | null;
  total_amount?: number | null;
}): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;
  const phone = order.customer_phone?.replace(/\s/g, '');
  if (!apiKey || !senderId || !phone) return;

  const to = phone.replace(/^\+/, '');
  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to,
      from: senderId,
      sms: `Hungry Nomad: order #${order.id} is confirmed. We are preparing it now.`,
      type: 'plain',
      channel: 'dnd',
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Termii customer SMS failed (${res.status})`);
  }
}
