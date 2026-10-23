import { redirect } from 'next/navigation';
import { Boxes, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/forgot-password?error=' + encodeURIComponent('Your reset link expired. Request a new one.'));

  async function save(formData: FormData) {
    'use server';
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');
    if (password.length < 8) redirect('/reset-password?error=' + encodeURIComponent('Password must be at least 8 characters'));
    if (password !== confirm) redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match'));

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect('/reset-password?error=' + encodeURIComponent(error.message));

    await supabase.auth.signOut({ scope: 'global' }); // sign out every device
    redirect('/login?ok=' + encodeURIComponent('Password changed. Sign in with your new password.'));
  }

  return (
    <main className="hero relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-300/25 blur-3xl" />

      <form action={save} className="fade-in relative w-full max-w-sm space-y-4 rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-center pb-1 text-center">
          <div className="hero mb-3 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
            <Boxes size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
          <p className="text-sm text-slate-500">At least 8 characters</p>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

        {(['password', 'confirm'] as const).map((n) => (
          <div key={n}>
            <label className="label">{n === 'password' ? 'New password' : 'Confirm password'}</label>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name={n} type="password" required minLength={8} autoComplete="new-password" className="field pl-11" />
            </div>
          </div>
        ))}

        <button className="btn-primary w-full">Save new password</button>
      </form>
    </main>
  );
}