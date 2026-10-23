import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Plus, ShieldAlert, X } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

function back(id: string, kind: 'ok' | 'error', msg: string): never {
  redirect(`/routes/${id}?${kind}=${encodeURIComponent(msg)}`);
}

export default async function RouteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/');

  async function saveRoute(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) back(id, 'error', 'Not allowed');

    const name = String(fd.get('name') ?? '').trim();
    if (!name) back(id, 'error', 'Enter a route name');

    const salesmanId = String(fd.get('salesman_id') ?? '') || null;
    if (salesmanId) {
      const { data: found } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', salesmanId)
        .eq('role', 'salesman')
        .eq('is_active', true)
        .maybeSingle();
      if (!found) back(id, 'error', 'Choose an active salesman');
    }

    const days = [...new Set(fd.getAll('day').map(Number))].filter(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6
    );

    const { error } = await supabase
      .from('routes')
      .update({ name, salesman_id: salesmanId, visit_days: days })
      .eq('id', id);
    if (error) back(id, 'error', error.message);

    revalidatePath('/routes');
    revalidatePath(`/routes/${id}`);
    back(id, 'ok', 'Route saved');
  }

  async function moveShop(fd: FormData) {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('move_shop', {
      p_shop: String(fd.get('shop_id')),
      p_dir: Number(fd.get('dir')) < 0 ? -1 : 1,
    });
    revalidatePath(`/routes/${id}`);
    if (error) back(id, 'error', error.message.replace(/^[A-Z_]+:\s*/, ''));
    redirect(`/routes/${id}`);
  }

  async function assignShop(fd: FormData) {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('assign_shop', {
      p_shop: String(fd.get('shop_id')),
      p_route: String(fd.get('route_id') ?? '') || null,
    });
    revalidatePath('/routes');
    revalidatePath(`/routes/${id}`);
    if (error) back(id, 'error', error.message.replace(/^[A-Z_]+:\s*/, ''));
    redirect(`/routes/${id}`);
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id, name, salesman_id, visit_days')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!route) notFound();

  const [{ data: shops }, { data: free }, { data: men }] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, owner_name, address')
      .eq('route_id', id)
      .is('deleted_at', null)
      .order('visit_seq', { ascending: true, nullsFirst: false })
      .order('name'),
    supabase
      .from('shops')
      .select('id, name, address')
      .is('route_id', null)
      .is('deleted_at', null)
      .order('name')
      .limit(100),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'salesman')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  const days = (route.visit_days ?? []) as number[];

  return (
    <div className="space-y-4">
      <Link href="/routes" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Routes
      </Link>

      {ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{ok}</p>
        </div>
      )}
      {error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form action={saveRoute} className="card space-y-4 p-5">
        <h1 className="text-xl font-bold text-slate-900">Route settings</h1>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Route name</label>
            <input name="name" required defaultValue={route.name} className="field" />
          </div>
          <div>
            <label className="label">Salesman</label>
            <select name="salesman_id" defaultValue={route.salesman_id ?? ''} className="field">
              <option value="">Not assigned</option>
              {men?.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Visit days (leave all unticked for every day)</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <label key={d.v} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="day"
                  value={d.v}
                  defaultChecked={days.includes(d.v)}
                  className="peer sr-only"
                />
                <span className="inline-flex rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-600 transition peer-checked:bg-indigo-600 peer-checked:text-white">
                  {d.l}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary w-full sm:w-auto">Save route</button>
      </form>

      <div className="card">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold text-slate-900">Shops in visit order</h2>
          <span className="chip">{shops?.length ?? 0}</span>
        </div>
        {!shops?.length ? (
          <p className="p-8 text-center text-sm text-slate-400">No shops on this route yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {shops.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {s.owner_name ?? 'No owner name'}
                    {s.address ? ` · ${s.address}` : ''}
                  </p>
                </div>
                <form action={moveShop}>
                  <input type="hidden" name="shop_id" value={s.id} />
                  <input type="hidden" name="dir" value="-1" />
                  <button
                    disabled={i === 0}
                    aria-label="Move up"
                    className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                </form>
                <form action={moveShop}>
                  <input type="hidden" name="shop_id" value={s.id} />
                  <input type="hidden" name="dir" value="1" />
                  <button
                    disabled={i === shops.length - 1}
                    aria-label="Move down"
                    className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                </form>
                <form action={assignShop}>
                  <input type="hidden" name="shop_id" value={s.id} />
                  <input type="hidden" name="route_id" value="" />
                  <button
                    aria-label="Remove from route"
                    className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold text-slate-900">Shops without a route</h2>
          <span className="chip">{free?.length ?? 0}</span>
        </div>
        {!free?.length ? (
          <p className="p-8 text-center text-sm text-slate-400">Every shop is assigned to a route.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {free.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.address ?? 'No address'}</p>
                </div>
                <form action={assignShop}>
                  <input type="hidden" name="shop_id" value={s.id} />
                  <input type="hidden" name="route_id" value={id} />
                  <button className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                    <Plus size={15} />
                    Add
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}