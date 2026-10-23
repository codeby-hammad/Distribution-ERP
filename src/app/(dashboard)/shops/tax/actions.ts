'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

export async function saveShopTaxAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc('set_shop_tax', {
    p_shop: String(formData.get('id') ?? ''),
    p_status: String(formData.get('status') ?? 'unknown'),
    p_ntn: String(formData.get('ntn') ?? ''),
  });
  revalidatePath('/shops/tax');
  const q = String(formData.get('q') ?? '');
  const back = q ? `&q=${encodeURIComponent(q)}` : '';
  if (error) redirect(`/shops/tax?err=${encodeURIComponent(error.message.replace(/^[A-Z_]+:\s*/, ''))}${back}`);
  redirect(`/shops/tax?ok=1${back}`);
}