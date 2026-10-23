'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

const clean = (m: string) => m.replace(/^[A-Z_]+:\s*/, '');

export async function addSchemeAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const [scope, refId] = String(formData.get('target') ?? '').split(':');

  const { error } = await supabase.rpc('add_scheme', {
    p: {
      name: String(formData.get('name') ?? ''),
      scope,
      product_id: scope === 'product' ? refId : null,
      company_id: scope === 'company' ? refId : null,
      type: String(formData.get('type') ?? ''),
      unit: String(formData.get('unit') ?? 'ctn'),
      min_cartons: String(formData.get('min_cartons') ?? ''),
      bonus_cartons: String(formData.get('bonus_cartons') ?? ''),
      percent: String(formData.get('percent') ?? ''),
      flat_per_carton: String(formData.get('flat_per_carton') ?? ''),
      valid_from: String(formData.get('valid_from') ?? ''),
      valid_to: String(formData.get('valid_to') ?? ''),
    },
  });
  revalidatePath('/schemes');
  if (error) redirect(`/schemes?err=${encodeURIComponent(clean(error.message))}`);
  redirect('/schemes?ok=1');
}

export async function toggleSchemeAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc('set_scheme_active', {
    p_id: String(formData.get('id') ?? ''),
    p_active: formData.get('active') === '1',
  });
  revalidatePath('/schemes');
  if (error) redirect(`/schemes?err=${encodeURIComponent(clean(error.message))}`);
  redirect('/schemes');
}