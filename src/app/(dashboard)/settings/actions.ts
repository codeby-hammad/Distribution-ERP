'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';

const clean = (m: string) => m.replace(/^[A-Z_]+:\s*/, '');
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function saveCompanyAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== 'owner') redirect('/settings?err=Only the owner can change settings');

  const payload: Record<string, unknown> = {
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    ntn: String(formData.get('ntn') ?? ''),
    strn: String(formData.get('strn') ?? ''),
    invoice_footer: String(formData.get('invoice_footer') ?? ''),
    tax_enabled: formData.get('tax_enabled') === '1',
    tax_rate_filer: String(formData.get('tax_rate_filer') ?? '18'),
    tax_rate_nonfiler: String(formData.get('tax_rate_nonfiler') ?? '18'),
  };

  const file = formData.get('logo');
  if (file instanceof File && file.size > 0) {
    const ext = EXT[file.type];
    if (!ext) redirect('/settings?err=Logo must be a PNG, JPG or WebP image');
    if (file.size > 1024 * 1024) redirect('/settings?err=Logo must be under 1 MB');

    const path = `${profile.tenant_id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await adminClient()
      .storage.from('company-logo')
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (upErr) redirect(`/settings?err=${encodeURIComponent(upErr.message)}`);
    payload.logo_path = path;
  } else if (formData.get('remove_logo') === '1') {
    payload.logo_path = '';
  }

  const { error } = await supabase.rpc('update_company_settings', { p: payload });
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  if (error) redirect(`/settings?err=${encodeURIComponent(clean(error.message))}`);
  redirect('/settings?ok=1');
}