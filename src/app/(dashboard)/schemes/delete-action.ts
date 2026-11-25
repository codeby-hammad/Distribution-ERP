'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

export async function deleteSchemeAction(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) {
    redirect('/schemes?err=' + encodeURIComponent('You cannot delete schemes'));
  }

  const { error } = await supabase.rpc('delete_scheme', { p_id: String(formData.get('id') ?? '') });
  if (error) {
    redirect('/schemes?err=' + encodeURIComponent(error.message.replace(/^[A-Z_]+:\s*/, '')));
  }

  revalidatePath('/schemes');
  redirect('/schemes?ok=deleted');
}