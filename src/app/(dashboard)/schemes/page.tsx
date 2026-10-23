import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { dateLabel, one } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import { addSchemeAction, toggleSchemeAction } from './actions';

const HOUR = 3600 * 1000;
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(new Date(d + 'T00:00:00Z').getTime() + n * 24 * HOUR).toISOString().slice(0, 10);

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

function describe(s: Sch) {
  const u = s.unit === 'pcs' ? 'pcs' : 'ctn';
  if (s.type === 'bonus') return `Buy ${s.min_cartons} ${u}, get ${s.bonus_cartons} ${u} free`;
  if (s.type === 'percent') return `${Number(s.percent)}% off from ${s.min_cartons} ${u}`;
  return `Rs ${Number(s.flat_per_carton)} off per ${u === 'pcs' ? 'pc' : 'carton'} from ${s.min_cartons} ${u}`;
}

export default async function SchemesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { err, ok } = await searchParams;
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
      .limit(100),
    supabase.from('products').select('id, name').is('deleted_at', null).eq('is_active', true).order('name'),
    supabase.from('companies').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const list = (schemes ?? []) as unknown as Sch[];

  function status(s: Sch) {
    if (!s.is_active) return { t: 'Off', c: 'bg-slate-100 text-slate-600' };
    if (s.valid_to < today) return { t: 'Expired', c: 'bg-slate-100 text-slate-600' };
    if (s.valid_from > today) return { t: 'Upcoming', c: 'bg-sky-50 text-sky-700' };
    return { t: 'Active', c: 'bg-emerald-50 text-emerald-700' };
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Schemes" subtitle="Bonus and discounts applied when an order is approved" />

      {err && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{err}</div>}
      {ok && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          Scheme saved.
        </div>
      )}

      <form action={addSchemeAction} className="card space-y-3 p-4">
        <h2 className="font-bold text-slate-900">New scheme</h2>

        <div>
          <label className="label">Name</label>
          <input name="name" required className="field" placeholder="e.g. Oct biscuit 10+1" />
        </div>

        <div>
          <label className="label">Applies to</label>
          <select name="target" required className="field">
            <optgroup label="One product">
              {(products ?? []).map((p) => (
                <option key={p.id} value={`product:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Whole company (cartons, percent or flat only)">
              {(companies ?? []).map((c) => (
                <option key={c.id} value={`company:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select name="type" required className="field">
              <option value="bonus">Bonus (10+1)</option>
              <option value="percent">Percent off</option>
              <option value="flat">Rs off per unit</option>
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <select name="unit" required defaultValue="ctn" className="field">
              <option value="ctn">Cartons</option>
              <option value="pcs">Pieces</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Buy at least (in the chosen unit)</label>
          <input type="number" name="min_cartons" min={1} step={1} required className="field" placeholder="10" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Free qty</label>
            <input type="number" name="bonus_cartons" min={1} step={1} className="field" placeholder="1" />
            <p className="mt-1 text-[11px] text-slate-400">Bonus only</p>
          </div>
          <div>
            <label className="label">Percent %</label>
            <input type="number" name="percent" min={0.01} max={100} step="0.01" className="field" placeholder="5" />
            <p className="mt-1 text-[11px] text-slate-400">Percent only</p>
          </div>
          <div>
            <label className="label">Rs per unit</label>
            <input type="number" name="flat_per_carton" min={0.01} step="0.01" className="field" placeholder="50" />
            <p className="mt-1 text-[11px] text-slate-400">Flat only</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starts</label>
            <input type="date" name="valid_from" defaultValue={today} required className="field" />
          </div>
          <div>
            <label className="label">Ends</label>
            <input type="date" name="valid_to" defaultValue={addDays(today, 30)} required className="field" />
          </div>
        </div>

        <button className="btn-primary w-full">Save scheme</button>
        <p className="text-xs text-slate-500">
          The unit applies to the minimum, the free quantity and the Rs off. Example: Pieces, buy 60, free 6 means
          &quot;buy 60 pcs, get 6 pcs free&quot;. Only the best scheme applies per product. To change a scheme, switch it
          off and add a new one.
        </p>
      </form>

      <div className="card overflow-hidden">
        <h2 className="p-4 pb-2 font-bold text-slate-900">All schemes</h2>
        {list.length === 0 && <p className="p-4 pt-0 text-sm text-slate-500">No schemes yet.</p>}
        <div className="divide-y divide-slate-100">
          {list.map((s) => {
            const st = status(s);
            const target =
              s.scope === 'product'
                ? one(s.products)?.name ?? 'Product'
                : `All ${one(s.companies)?.name ?? 'company'} products`;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {s.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${st.c}`}>{st.t}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {target} · {describe(s)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {dateLabel(s.valid_from)} to {dateLabel(s.valid_to)}
                  </p>
                </div>
                <form action={toggleSchemeAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={s.is_active ? '0' : '1'} />
                  <button className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {s.is_active ? 'Switch off' : 'Switch on'}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}