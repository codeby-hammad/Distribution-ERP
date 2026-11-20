'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';

export async function createTripFromOrders(payload: string): Promise<{ id?: string; error?: string }> {
  const { supabase } = await requireProfile();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return { error: 'Invalid data' };
  }

  const { data, error } = await supabase.rpc('create_trip', { p: body });
  if (error) return { error: error.message };

  revalidatePath('/orders');
  revalidatePath('/trips');
  return { id: (data as string) ?? (body.id as string) };
}