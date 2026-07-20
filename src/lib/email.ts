import { Resend } from 'resend';

let resend: Resend | null = null;

// Constructed lazily — Resend's constructor throws when the key is missing,
// and Next.js imports this module at build time to collect page data, so
// building without RESEND_API_KEY set would otherwise crash the build even
// though every caller here already tolerates the key being absent.
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_EMAIL = process.env.ORDER_EMAIL_FROM || 'onboarding@resend.dev';
const STAFF_EMAIL = process.env.STAFF_EMAIL;

export interface OrderEmailItem {
  product_name: string;
  quantity: number;
  price_at_time: number;
}

export interface OrderEmailDetails {
  id: number | string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  delivery_lga?: string | null;
  total_amount: number;
}

function renderItemsTable(items: OrderEmailItem[]) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 0;">${item.product_name} &times;${item.quantity}</td>
          <td style="padding:6px 0; text-align:right;">&#8358;${(item.price_at_time * item.quantity).toLocaleString()}</td>
        </tr>`
    )
    .join('');
  return `<table style="width:100%; border-collapse:collapse;">${rows}</table>`;
}

export async function sendOrderConfirmationEmail(order: OrderEmailDetails, items: OrderEmailItem[]) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping customer confirmation email');
    return;
  }
  try {
    await resend.emails.send({
      from: `Hungry Nomad <${FROM_EMAIL}>`,
      to: order.customer_email,
      subject: `Order Confirmed – Hungry Nomad #${order.id}`,
      html: `
        <h2>Thanks for your order, ${order.customer_name}!</h2>
        <p>Your order <strong>#${order.id}</strong> is confirmed and being prepared.</p>
        ${renderItemsTable(items)}
        <p style="margin-top:16px;"><strong>Total: &#8358;${order.total_amount.toLocaleString()}</strong></p>
        <p>Delivering to: ${order.customer_address}${order.delivery_lga ? `, ${order.delivery_lga}` : ''}</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error);
  }
}

export async function sendStaffOrderAlertEmail(order: OrderEmailDetails, items: OrderEmailItem[]) {
  const resend = getResendClient();
  if (!resend || !STAFF_EMAIL) {
    console.warn('RESEND_API_KEY or STAFF_EMAIL not set — skipping staff order alert email');
    return;
  }
  try {
    await resend.emails.send({
      from: `Hungry Nomad Orders <${FROM_EMAIL}>`,
      to: STAFF_EMAIL,
      subject: `New Paid Order #${order.id} – ₦${order.total_amount.toLocaleString()}`,
      html: `
        <h2>New order received</h2>
        <p><strong>${order.customer_name}</strong> — ${order.customer_phone}</p>
        <p>Deliver to: ${order.customer_address}${order.delivery_lga ? `, ${order.delivery_lga}` : ''}</p>
        ${renderItemsTable(items)}
        <p style="margin-top:16px;"><strong>Total: &#8358;${order.total_amount.toLocaleString()}</strong></p>
      `,
    });
  } catch (error) {
    console.error('Failed to send staff order alert email:', error);
  }
}
