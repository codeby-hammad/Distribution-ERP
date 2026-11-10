import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Boxes, Mail, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  async function send(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      redirect('/forgot-password?error=' + encodeURIComponent('Enter a valid email address'));
    }
    if (email.endsWith('@erp.local')) {
      redirect(
        '/forgot-password?error=' +
          encodeURIComponent('This account has no real email. Ask the owner to reset your password on the Staff page.')
      );
    }

    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
    const site = (process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`).replace(/\/$/, '');

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}/auth/confirm?next=/reset-password`,
    });

    if (error && /rate limit|too many/i.test(error.message)) {
      redirect('/forgot-password?error=' + encodeURIComponent('Too many requests. Wait a few minutes and try again.'));
    }

    redirect(
      '/forgot-password?ok=' +
        encodeURIComponent('If that email has an account, a reset link is on its way. Check spam too.')
    );
  }

  return (
    <main className="hero relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-300/25 blur-3xl" />

      <form action={send} className="fade-in relative w-full max-w-sm space-y-4 rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-center pb-1 text-center">
          <div className="hero mb-3 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
            <Boxes size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Forgot password?</h1>
          <p className="text-sm text-slate-500">We will email you a reset link</p>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
        {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 ring-1 ring-emerald-100">{ok}</p>}

        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="field pl-11" />
          </div>
        </div>

        <button className="btn-primary w-full">Send reset link</button>

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </form>
    </main>
  );
}