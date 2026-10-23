'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

const clean = (m: string) => m.replace(/^[A-Z_]+:\s*/, '');

export async function createReturnAction(payload: string): Promise<{ id?: string; error?: string }> {
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) return { error: 'Not allowed' };

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return { error: 'Invalid data' };
  }

  const { data, error } = await supabase.rpc('create_sales_return', { p: body });
  if (error) return { error: error.message };

  revalidatePath('/returns');
  revalidatePath('/shops');
  revalidatePath('/stock');
  revalidatePath('/products');
  return { id: (data as { id: string }).id };
}

export async function approveRequestAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const wh = String(formData.get('warehouse_id') ?? '');
  const { error } = await supabase.rpc('approve_return_request', {
    p_id: String(formData.get('id') ?? ''),
    p_warehouse: wh || null,
  });
  revalidatePath('/returns');
  revalidatePath('/shops');
  revalidatePath('/stock');
  if (error) redirect(`/returns?tab=requests&err=${encodeURIComponent(clean(error.message))}`);
  redirect('/returns?tab=requests&ok=1');
}

export async function rejectRequestAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc('reject_return_request', {
    p_id: String(formData.get('id') ?? ''),
    p_reason: String(formData.get('reason') ?? ''),
  });
  revalidatePath('/returns');
  if (error) redirect(`/returns?tab=requests&err=${encodeURIComponent(clean(error.message))}`);
  redirect('/returns?tab=requests&rejected=1');
}

export async function claimAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const status = String(formData.get('status') ?? '');
  const ids = formData.getAll('ids').map(String);
  if (!ids.length) redirect(`/returns/claims?err=${encodeURIComponent('Tick at least one line')}`);

  const { error } = await supabase.rpc('set_claim_status', {
    p_ids: ids,
    p_status: status,
    p_ref: String(formData.get('ref') ?? ''),
  });
  revalidatePath('/returns/claims');
  const back = status === 'claimed' ? 'held' : 'claimed';
  if (error) redirect(`/returns/claims?tab=${back}&err=${encodeURIComponent(clean(error.message))}`);
  redirect(`/returns/claims?tab=${back}&ok=1`);
}