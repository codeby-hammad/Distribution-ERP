import { redirect } from 'next/navigation';
import { Boxes, LogOut } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('name').maybeSingle();
  const companyName = tenant?.name?.trim() || null;

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar
        name={profile.full_name}
        role={profile.role}
        companyName={companyName}
        signOut={signOut}
      />

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="hero grid size-9 shrink-0 place-items-center rounded-xl text-white">
              <Boxes size={18} />
            </div>
            <span className="truncate font-bold text-slate-900">
              {companyName ?? 'Distribution ERP'}
            </span>
          </div>
          <form action={signOut}>
            <button
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
            >
              <LogOut size={17} />
            </button>
          </form>
        </header>

        <main className="fade-in mx-auto w-full max-w-6xl px-4 pb-32 pt-5 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>

      <BottomNav role={profile.role} />
    </div>
  );
}