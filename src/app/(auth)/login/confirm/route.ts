import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (!error) redirect('/reset-password');
  }
  redirect('/forgot-password?error=' + encodeURIComponent('This link is invalid or has expired. Request a new one.'));
}