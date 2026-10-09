import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

export async function applyCoupon(code: string | undefined, subtotal: number): Promise<AppliedCoupon | { error: string }> {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return { code: '', discountAmount: 0 };
  const { data, error } = await supabaseAdmin.from('coupons').select('*').eq('code', normalized).maybeSingle();
  if (error || !data) return { error: 'That coupon is not valid' };
  if (!data.is_active) return { error: 'That coupon is not active' };
  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return { error: 'That coupon is not active yet' };
  if (data.ends_at && new Date(data.ends_at).getTime() < now) return { error: 'That coupon has expired' };
  if (data.max_uses != null && data.uses_count >= data.max_uses) return { error: 'That coupon has been used up' };
  if (subtotal < (data.min_subtotal || 0)) return { error: `This coupon needs a food subtotal of at least ₦${Number(data.min_subtotal).toLocaleString()}` };
  const discountAmount = data.discount_type === 'percent'
    ? Math.floor(subtotal * Math.min(Number(data.discount_value), 100) / 100)
    : Math.min(Number(data.discount_value), subtotal);
  if (discountAmount <= 0) return { error: 'That coupon does not apply to this order' };
  return { code: data.code, discountAmount };
}

export async function recordCouponUse(code: string | null | undefined) {
  if (!code) return;
  const { data } = await supabaseAdmin.from('coupons').select('id, uses_count').eq('code', code).maybeSingle();
  if (!data) return;
  await supabaseAdmin.from('coupons').update({ uses_count: (data.uses_count || 0) + 1 }).eq('id', data.id);
}
