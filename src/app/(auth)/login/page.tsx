import { redirect } from 'next/navigation';
import { BarChart3, Boxes, ClipboardList, Smartphone, Truck, WifiOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import LoginForm from './LoginForm';

const FEATURES = [
  { icon: ClipboardList, title: 'Order booking', text: 'Salesmen book orders on the phone, even offline.' },
  { icon: Truck, title: 'Trips and delivery', text: 'Load vans, print invoices and settle cash per trip.' },
  { icon: BarChart3, title: 'Recovery and reports', text: 'Know who owes what, and what you earned.' },
];

export default async function LoginPage({
  searchParams,
}: {
    searchParams: Promise<{ error?: string; ok?: string }>;

}) {
    const { error, ok } = await searchParams;

  async function signIn(formData: FormData) {
    'use server';
    const supabase = await createClient();

    let email = String(formData.get('email') ?? '').trim();
    if (!email.includes('@')) email = email.toLowerCase() + '@erp.local';

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(formData.get('password') ?? ''),
    });
    if (error) redirect('/login?error=' + encodeURIComponent(error.message));
    redirect('/');
  }

  return (
    <main className="hero relative min-h-dvh overflow-hidden">
      {/* one shared background for the whole page */}
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-sky-300/15 blur-3xl" />

      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        {/* Brand side */}
        <section className="hidden text-white lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
              <Boxes size={22} />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Distribution ERP</p>
              <p className="text-xs text-indigo-100">Built for wholesale distributors</p>
            </div>
          </div>

          <h2 className="mt-14 max-w-md text-4xl font-extrabold leading-tight">
            Run your distribution business from one place.
          </h2>
          <p className="mt-3 max-w-md text-indigo-100">
            Orders, stock, delivery, recovery and reports, with a mobile app for your salesmen and delivery men.
          </p>

          <div className="mt-8 max-w-md space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Icon size={19} />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-indigo-100">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
              <Smartphone size={14} />
              Android app
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
              <WifiOff size={14} />
              Works offline
            </span>
          </div>
        </section>

        {/* Form side */}
        <section className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center text-white lg:hidden">
            <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
              <Boxes size={26} />
            </div>
            <h1 className="text-xl font-bold">Distribution ERP</h1>
            <p className="text-sm text-indigo-100">Built for wholesale distributors</p>
          </div>

          <div className="fade-in rounded-3xl bg-white/95 p-6 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl sm:p-8">
            <div className="mb-5">
              <h1 className="hidden text-2xl font-bold text-slate-900 lg:block">Welcome back</h1>
              <h2 className="text-lg font-bold text-slate-900 lg:hidden">Sign in</h2>
              <p className="text-sm text-slate-500">Use your username or email to continue</p>
            </div>

            <LoginForm action={signIn} error={error} ok={ok} />
          </div>

          <p className="mt-6 text-center text-xs text-indigo-100/80">
            Your data is private to your company and protected by role-based access.
          </p>
        </section>
      </div>
    </main>
  );
}