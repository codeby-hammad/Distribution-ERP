'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

const TABS = ['booked', 'approved', 'rejected', 'all'];

function safeTab(v: FormDataEntryValue | null) {
  const t = String(v ?? 'booked');
  return TABS.includes(t) ? t : 'booked';
}

function clean(m: string) {
  return m.replace(/^[A-Z_]+:\s*/, '');
}

export async function approveOneAction(formData: FormData) {
  const id = String(formData.get('order_id') ?? '');
  const back = safeTab(formData.get('back'));
  const { supabase, profile } = await requireProfile();

  if (!['owner', 'manager'].includes(profile.role)) {
    redirect(`/orders?status=${back}&err=${encodeURIComponent('You cannot approve orders')}`);
  }

  const { error } = await supabase.rpc('approve_order', { p_order_id: id, p_override: false });
  revalidatePath('/orders');

  if (error) {
    redirect(`/orders?status=${back}&err=${encodeURIComponent(clean(error.message))}`);
  }
  redirect(`/orders?status=${back}&done=1`);
}

export async function approveAllAction(formData: FormData) {
  const back = safeTab(formData.get('back'));
  const { supabase, profile } = await requireProfile();

  if (!['owner', 'manager'].includes(profile.role)) {
    redirect(`/orders?status=${back}&err=${encodeURIComponent('You cannot approve orders')}`);
  }

  // ids are read on the server, never trusted from the browser
  const { data: pending } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'booked')
    .is('deleted_at', null)
    .order('booked_at', { ascending: true })
    .limit(100);

  let done = 0;
  let failed = 0;
  let firstErr = '';

  for (const o of pending ?? []) {
    const { error } = await supabase.rpc('approve_order', { p_order_id: o.id, p_override: false });
    if (error) {
      failed++;
      if (!firstErr) firstErr = clean(error.message);
    } else {
      done++;
    }
  }

  revalidatePath('/orders');

  // All approved: go to the Approved tab so a trip can be created right away.
  // Some skipped: stay on Pending so the skipped orders are visible.
  const target = done > 0 && failed === 0 ? 'approved' : back;
  const q = new URLSearchParams({ status: target, done: String(done), failed: String(failed) });
  if (firstErr) q.set('err', firstErr);
  redirect(`/orders?${q.toString()}`);
}