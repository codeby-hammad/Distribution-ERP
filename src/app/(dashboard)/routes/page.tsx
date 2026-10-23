import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { CalendarDays, ChevronRight, Route as RouteIcon, UserRound } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { one } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';
import EmptyState from '@/components/EmptyState';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Named = { full_name: string };
type Cnt = { count: number };

export default async function RoutesPage() {
  const { supabase, profile } = await requireProfile();

  async function addRoute(formData: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) return;
    await supabase.from('routes').insert({
      tenant_id: profile.tenant_id,
      name: String(formData.get('name')).trim(),
    });
    revalidatePath('/routes');
  }

  const { data: routes } = await supabase
    .from('routes')
    .select('id, name, visit_days, salesman:profiles!routes_salesman_id_fkey(full_name), shops(count)')
    .is('deleted_at', null)
    .is('shops.deleted_at', null)
    .order('name');

  return (
    <div>
      <PageHeader
        title="Routes"
        subtitle="Assign salesmen, visit days and shop order"
        action={
          canManage(profile.role) && (
            <AddSheet label="Add" title="New route">
              <form action={addRoute} className="space-y-3">
                <div>
                  <label className="label">Route name</label>
                  <input name="name" required className="field" placeholder="e.g. Main Bazaar" />
                </div>
                <button className="btn-primary w-full">Save route</button>
              </form>
            </AddSheet>
          )
        }
      />

      {!routes?.length ? (
        <EmptyState icon={RouteIcon} title="No routes yet" hint="Create a route, then open it to assign shops." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => {
            const count = one(r.shops as unknown as Cnt | Cnt[] | null)?.count ?? 0;
            const man = one(r.salesman as unknown as Named | Named[] | null);
            const days = (r.visit_days ?? []) as number[];
            return (
              <Link
                key={r.id}
                href={`/routes/${r.id}`}
                className="card flex items-center gap-3 p-4 transition active:scale-[0.99]"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                  <RouteIcon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{r.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <UserRound size={12} />
                    {man?.full_name ?? 'No salesman'} · {count} {count === 1 ? 'shop' : 'shops'}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <CalendarDays size={12} />
                    {days.length ? ORDER.filter((d) => days.includes(d)).map((d) => DAY[d]).join(' · ') : 'Every day'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}