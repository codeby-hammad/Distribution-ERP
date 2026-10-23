'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';

const clean = (m: string) => m.replace(/^[A-Z_]+:\s*/, '');

export async function addExpenseAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc('add_expense', {
    p_date: String(formData.get('date') ?? ''),
    p_category: String(formData.get('category') ?? ''),
    p_amount: Number(formData.get('amount') ?? 0),
    p_note: String(formData.get('note') ?? ''),
  });
  revalidatePath('/expenses');
  if (error) redirect(`/expenses?err=${encodeURIComponent(clean(error.message))}`);
  redirect('/expenses?ok=1');
}

export async function deleteExpenseAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc('delete_expense', { p_id: String(formData.get('id') ?? '') });
  revalidatePath('/expenses');
  if (error) redirect(`/expenses?err=${encodeURIComponent(clean(error.message))}`);
  redirect('/expenses');
}