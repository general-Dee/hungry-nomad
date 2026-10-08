import { supabase } from '@/lib/supabaseClient';
import { BUSINESS_HOURS_LABEL, DEFAULT_CLOSE_MINUTES, DEFAULT_OPEN_MINUTES, type StoreHours } from '@/lib/businessHours';

export async function getStoreHours(): Promise<StoreHours> {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('open_minutes, close_minutes, closed_override, hours_label')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      return { openMinutes: DEFAULT_OPEN_MINUTES, closeMinutes: DEFAULT_CLOSE_MINUTES, closedOverride: false, label: BUSINESS_HOURS_LABEL };
    }
    return {
      openMinutes: Number(data.open_minutes ?? DEFAULT_OPEN_MINUTES),
      closeMinutes: Number(data.close_minutes ?? DEFAULT_CLOSE_MINUTES),
      closedOverride: Boolean(data.closed_override),
      label: data.hours_label || BUSINESS_HOURS_LABEL,
    };
  } catch {
    return { openMinutes: DEFAULT_OPEN_MINUTES, closeMinutes: DEFAULT_CLOSE_MINUTES, closedOverride: false, label: BUSINESS_HOURS_LABEL };
  }
}
