import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Boxes, CheckCircle2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; user?: string; error?: string }>;
}) {
  const { sent, user, error } = await searchParams;

  async function request(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    // staff usernames have no real inbox
    if (!email.includes('@') || email.endsWith('@erp.local')) redirect('/forgot-password?user=1');
    if (email.length > 200) redirect('/forgot-password?sent=1');

    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email); // result ignored on purpose
    redirect('/forgot-password?sent=1');
  }

  return (
    <main className="hero relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-300/25 blur-3xl" />

      <div className="fade-in relative w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="hero mb-3 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
            <Boxes size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Forgot password</h1>
          <p className="text-sm text-slate-500">We will email you a reset link</p>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

        {user && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
            Staff usernames (like ali.sales) have no email. Ask your owner or administrator to reset your password from the Staff page.
          </p>
        )}

        {sent ? (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>If an account exists for that email, a reset link is on its way. Check your inbox and spam folder. The link works once and expires soon.</p>
          </div>
        ) : (
          <form action={request} className="space-y-4">
            <div>
              <label className="label">Account email</label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input name="email" type="email" required autoComplete="email" className="field pl-11" placeholder="you@company.com" />
              </div>
            </div>
            <button className="btn-primary w-full">Send reset link</button>
          </form>
        )}

        <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}