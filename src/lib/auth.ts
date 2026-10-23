import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const requireProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect(
      '/login?error=' +
        encodeURIComponent('This account is disabled or has no profile. Contact your administrator.')
    );
  }
  return { supabase, profile };
});

export const canManage = (role: string) => ['owner', 'manager'].includes(role);