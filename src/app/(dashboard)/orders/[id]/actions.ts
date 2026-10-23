'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';

export async function editOrderAction(
  orderId: string,
  payload: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) return { error: 'Not allowed' };

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return { error: 'Invalid data' };
  }

  const { error } = await supabase.rpc('edit_order', { p_order_id: orderId, p: body });
  if (error) return { error: error.message.replace(/^[A-Z_]+:\s*/, '') };

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}