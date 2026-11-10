import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Boxes, ShieldCheck, AlertCircle } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type SP = {
  token_hash?: string;
  type?: string;
  code?: string;
  next?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const hasToken = Boolean(sp.token_hash && sp.type);
  const hasCode = Boolean(sp.code);
  const problem =
    sp.error_description?.replace(/\+/g, ' ') ||
    (hasToken || hasCode ? '' : 'This link is not valid. Request a new reset email.');

  async function confirm(formData: FormData) {
    'use server';
    const token_hash = String(formData.get('token_hash') ?? '');
    const type = String(formData.get('type') ?? '') as EmailOtpType;
    const code = String(formData.get('code') ?? '');
    const nextRaw = String(formData.get('next') ?? '/reset-password');
    const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/reset-password';

    const supabase = await createClient();
    let failMsg = '';

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      failMsg = error?.message ?? '';
    } else {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      failMsg = error?.message ?? '';
    }

    if (failMsg) {
      redirect(
        '/forgot-password?error=' +
          encodeURIComponent(`Reset failed: ${failMsg}. Request a new link.`)
      );
    }
    redirect(next);
  }

  return (
    <main className="hero relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-300/25 blur-3xl" />

      <div className="fade-in relative w-full max-w-sm space-y-4 rounded-3xl bg-white/95 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="hero mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
          <Boxes size={26} />
        </div>

        {problem ? (
          <>
            <div className="flex items-center justify-center gap-2 text-red-700">
              <AlertCircle size={18} />
              <h1 className="text-lg font-bold">Link problem</h1>
            </div>
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{problem}</p>
            <Link href="/forgot-password" className="btn-primary block w-full">
              Request a new link
            </Link>
          </>
        ) : (
          <form action={confirm} className="space-y-4">
            <input type="hidden" name="token_hash" value={sp.token_hash ?? ''} />
            <input type="hidden" name="type" value={sp.type ?? ''} />
            <input type="hidden" name="code" value={sp.code ?? ''} />
            <input type="hidden" name="next" value={sp.next ?? '/reset-password'} />
            <div className="flex items-center justify-center gap-2 text-slate-900">
              <ShieldCheck size={20} className="text-indigo-600" />
              <h1 className="text-xl font-bold">Confirm password reset</h1>
            </div>
            <p className="text-sm text-slate-500">Press the button to continue and choose a new password.</p>
            <button className="btn-primary w-full">Continue</button>
          </form>
        )}
      </div>
    </main>
  );
}