import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Gift, Percent, ShieldAlert, Tag } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, one } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';
import EmptyState from '@/components/EmptyState';
import SchemeForm from '@/components/SchemeForm';
import DeleteScheme from '@/components/DeleteScheme';
import { addSchemeAction, toggleSchemeAction } from './actions';
import { deleteSchemeAction } from './delete-action';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(new Date(d + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / DAY);

type Sch = {
  id: string;
  name: string;
  scope: 'product' | 'company';
  type: 'bonus' | 'percent' | 'flat';
  unit: 'ctn' | 'pcs' | null;
  min_cartons: number;
  bonus_cartons: number | null;
  percent: number | null;
  flat_per_carton: number | null;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  products: { name: string } | { name: string }[] | null;
  companies: { name: string } | { name: string }[] | null;
};

type Key = 'active' | 'upcoming' | 'ended';

const TABS: { key: Key | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended / off' },
  { key: 'all', label: 'All' },
];

function describe(s: Sch) {
  const u = s.unit === 'pcs' ? 'pcs' : 'ctn';
  if (s.type === 'bonus') return `Buy ${s.min_cartons} ${u}, get ${s.bonus_cartons} ${u} free`;
  if (s.type === 'percent') return `${Number(s.percent)}% off from ${s.min_cartons} ${u}`;
  return `Rs ${Number(s.flat_per_carton)} off per ${u === 'pcs' ? 'pc' : 'carton'} from ${s.min_cartons} ${u}`;
}

const TYPE_STYLE = {
  bonus: { icon: Gift, box: 'bg-emerald-50 text-emerald-600' },
  percent: { icon: Percent, box: 'bg-indigo-50 text-indigo-600' },
  flat: { icon: Tag, box: 'bg-amber-50 text-amber-600' },
} as const;

export default async function SchemesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; f?: string }>;
}) {
  const sp = await searchParams;
  const { err, ok } = sp;
  const f = TABS.some((t) => t.key === sp.f) ? (sp.f as string) : 'active';

  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const today = pkToday();
  const [{ data: schemes }, { data: products }, { data: companies }] = await Promise.all([
    supabase
      .from('schemes')
      .select(
        'id, name, scope, type, unit, min_cartons, bonus_cartons, percent, flat_per_carton, valid_from, valid_to, is_active, products(name), companies(name)'
      )
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('products').select('id, name').is('deleted_at', null).eq('is_active', true).order('name'),
    supabase.from('companies').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const all = (schemes ?? []) as unknown as Sch[];

  function state(s: Sch): { key: Key; label: string; chip: string } {
    if (!s.is_active) return { key: 'ended', label: 'Off', chip: 'bg-slate-100 text-slate-600' };
    if (s.valid_to < today) return { key: 'ended', label: 'Expired', chip: 'bg-slate-100 text-slate-600' };
    if (s.valid_from > today) return { key: 'upcoming', label: 'Upcoming', chip: 'bg-sky-50 text-sky-700' };
    return { key: 'active', label: 'Active', chip: 'bg-emerald-50 text-emerald-700' };
  }

  const counts = { active: 0, upcoming: 0, ended: 0 };
  for (const s of all) counts[state(s).key]++;

  const list = all
    .filter((s) => f === 'all' || state(s).key === f)
    .sort((a, b) => {
      // active: ending soonest first; others: newest first
      if (f === 'active') return a.valid_to.localeCompare(b.valid_to);
      return 0;
    });

  const tabCount = (k: string) => (k === 'all' ? all.length : counts[k as Key]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schemes"
        subtitle="Bonus and discounts applied when an order is approved"
        action={
          <AddSheet label="New" title="New scheme">
            <SchemeForm
              action={addSchemeAction}
              products={products ?? []}
              companies={companies ?? []}
              today={today}
              defaultEnd={addDays(today, 30)}
            />
          </AddSheet>
        }
      />

      {err && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{err}</p>
        </div>
      )}
      {ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{ok === 'deleted' ? 'Scheme deleted.' : 'Scheme saved.'}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="card p-3 md:p-4">
          <p className="text-xl font-extrabold text-emerald-600 md:text-2xl">{counts.active}</p>
          <p className="text-[11px] font-semibold text-slate-500">Running now</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="text-xl font-extrabold text-sky-600 md:text-2xl">{counts.upcoming}</p>
          <p className="text-[11px] font-semibold text-slate-500">Upcoming</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="text-xl font-extrabold text-slate-500 md:text-2xl">{counts.ended}</p>
          <p className="text-[11px] font-semibold text-slate-500">Ended or off</p>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/schemes?f=${t.key}`}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              f === t.key
                ? 'hero text-white shadow-md shadow-indigo-500/25'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {t.label} ({tabCount(t.key)})
          </Link>
        ))}
      </div>

      {!list.length ? (
        <EmptyState
          icon={Gift}
          title="No schemes here"
          hint={all.length ? 'Try another tab.' : 'Tap New to create your first scheme.'}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s) => {
            const st = state(s);
            const T = TYPE_STYLE[s.type];
            const target =
              s.scope === 'product'
                ? one(s.products)?.name ?? 'Product'
                : `All ${one(s.companies)?.name ?? 'company'} products`;
            const left = daysBetween(today, s.valid_to);
            const starts = daysBetween(today, s.valid_from);
            const note =
              st.key === 'active'
                ? left === 0
                  ? 'Ends today'
                  : `${left} day${left === 1 ? '' : 's'} left`
                : st.key === 'upcoming'
                  ? `Starts in ${starts} day${starts === 1 ? '' : 's'}`
                  : '';

            return (
              <div key={s.id} className={`card space-y-3 p-4 ${st.key === 'ended' ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${T.box}`}>
                    <T.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">{s.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{target}</p>
                  </div>
                  <DeleteScheme action={deleteSchemeAction} id={s.id} name={s.name} />
                </div>

                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{describe(s)}</p>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-400">
                      {dateLabel(s.valid_from)} to {dateLabel(s.valid_to)}
                    </p>
                    {note && (
                      <p
                        className={`text-[11px] font-semibold ${
                          st.key === 'active' && left <= 3 ? 'text-amber-600' : 'text-slate-500'
                        }`}
                      >
                        {note}
                      </p>
                    )}
                  </div>
                  <form action={toggleSchemeAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={s.is_active ? '0' : '1'} />
                    <button className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100">
                      {s.is_active ? 'Switch off' : 'Switch on'}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}