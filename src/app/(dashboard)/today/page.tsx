import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Banknote, CalendarCheck, Eye, Phone, ShieldAlert, ShoppingCart } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { dateLabel, dayRange, rs, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';

const REASONS = [
  'Shop closed',
  'Stock available',
  'No cash / payment pending',
  'Owner not available',
  'Other',
];

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ salesman?: string; all?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const manager = canManage(profile.role);

  async function noOrder(fd: FormData) {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('record_visit', {
      p: {
        id: crypto.randomUUID(),
        shop_id: String(fd.get('shop_id')),
        reason: String(fd.get('reason') ?? ''),
      },
    });
    revalidatePath('/today');
    if (error) redirect('/today?error=' + encodeURIComponent(error.message.replace(/^[A-Z_]+:\s*/, '')));
    redirect('/today');
  }

  const { data: men } = manager
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'salesman')
        .eq('is_active', true)
        .order('full_name')
    : { data: [] as { id: string; full_name: string }[] };

  const target = manager
    ? ((men ?? []).some((m) => m.id === sp.salesman) ? (sp.salesman as string) : null)
    : profile.id;
  const readOnly = target !== profile.id;

  const date = todayPK();
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const { from, to } = dayRange(date);

  const picker = manager && (
    <form className="card flex gap-2 p-3">
      <select name="salesman" defaultValue={target ?? ''} className="field py-2.5">
        <option value="" disabled>Choose a salesman to preview</option>
        {men?.map((m) => (
          <option key={m.id} value={m.id}>{m.full_name}</option>
        ))}
      </select>
      <button className="btn-primary shrink-0 px-4 py-2.5">
        <Eye size={16} />
        View
      </button>
    </form>
  );

  if (!target) {
    return (
      <div className="space-y-4">
        <PageHeader title="Today" subtitle={dateLabel(date)} />
        {picker}
        <div className="card p-10 text-center text-sm text-slate-400">
          Pick a salesman to see his plan for today.
        </div>
      </div>
    );
  }

  const { data: allRoutes } = await supabase
    .from('routes')
    .select('id, name, visit_days')
    .eq('salesman_id', target)
    .is('deleted_at', null)
    .order('name');

  const scheduled = (allRoutes ?? []).filter(
    (r) => !(r.visit_days as number[] | null)?.length || (r.visit_days as number[]).includes(dow)
  );
  const showAll = sp.all === '1';
  const routes = showAll ? (allRoutes ?? []) : scheduled;
  const routeIds = routes.map((r) => r.id);

  const [shopsRes, ordersRes, visitsRes] = await Promise.all([
    routeIds.length
      ? supabase
          .from('shops')
          .select('id, name, owner_name, phone, address, route_id')
          .in('route_id', routeIds)
          .is('deleted_at', null)
          .order('visit_seq', { ascending: true, nullsFirst: false })
          .order('name')
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('orders')
      .select('shop_id, total')
      .eq('salesman_id', target)
      .gte('booked_at', from)
      .lt('booked_at', to)
      .is('deleted_at', null),
    supabase
      .from('visits')
      .select('shop_id, no_order_reason')
      .eq('salesman_id', target)
      .gte('visited_at', from)
      .lt('visited_at', to),
  ]);

  const shops = (shopsRes.data ?? []) as {
    id: string;
    name: string;
    owner_name: string | null;
    phone: string | null;
    address: string | null;
    route_id: string;
  }[];

  const { data: bals } = shops.length
    ? await supabase.from('shop_balances').select('shop_id, ledger_balance').in('shop_id', shops.map((s) => s.id))
    : { data: [] as { shop_id: string; ledger_balance: number }[] };

  const balMap = new Map((bals ?? []).map((b) => [b.shop_id, Number(b.ledger_balance)]));
  const orderMap = new Map<string, number>();
  for (const o of ordersRes.data ?? []) {
    orderMap.set(o.shop_id, (orderMap.get(o.shop_id) ?? 0) + Number(o.total));
  }
  const visitMap = new Map((visitsRes.data ?? []).map((v) => [v.shop_id, v.no_order_reason as string | null]));

  const done = shops.filter((s) => orderMap.has(s.id) || visitMap.has(s.id)).length;
  const orderCount = shops.filter((s) => orderMap.has(s.id)).length;
  const orderValue = shops.reduce((sum, s) => sum + (orderMap.get(s.id) ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Today" subtitle={dateLabel(date)} />
      {picker}

      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{sp.error}</p>
        </div>
      )}

      <div className="hero relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold">{done}/{shops.length}</p>
            <p className="text-xs text-indigo-100">Shops done</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{orderCount}</p>
            <p className="text-xs text-indigo-100">Orders</p>
          </div>
          <div>
            <p className="text-lg font-bold md:text-2xl">{rs(orderValue)}</p>
            <p className="text-xs text-indigo-100">Booked</p>
          </div>
        </div>
      </div>

      {!allRoutes?.length ? (
        <div className="card p-10 text-center text-sm text-slate-400">
          {readOnly ? 'This salesman has no routes yet.' : 'No route is assigned to you yet. Ask your manager.'}
        </div>
      ) : (
        <>
          {!showAll && !scheduled.length && (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              No route is scheduled for today.{' '}
              <Link
                href={`/today?all=1${readOnly ? `&salesman=${target}` : ''}`}
                className="font-semibold underline"
              >
                Show all routes
              </Link>
            </div>
          )}

          {routes.map((r) => {
            const list = shops.filter((s) => s.route_id === r.id);
            return (
              <section key={r.id} className="space-y-3">
                <h2 className="flex items-center gap-2 pt-1 font-bold text-slate-900">
                  <CalendarCheck size={18} className="text-indigo-600" />
                  {r.name}
                  <span className="chip">{list.length} shops</span>
                </h2>

                {list.map((s, i) => {
                  const ordered = orderMap.has(s.id);
                  const skipped = visitMap.has(s.id);
                  const balance = balMap.get(s.id) ?? 0;
                  return (
                    <div key={s.id} className="card space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{s.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {s.owner_name ?? 'No owner name'}
                            {s.address ? ` · ${s.address}` : ''}
                          </p>
                        </div>
                        {s.phone && (
                          <a
                            href={`tel:${s.phone}`}
                            aria-label={`Call ${s.name}`}
                            className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                          >
                            <Phone size={16} />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {ordered ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Ordered {rs(orderMap.get(s.id))}
                          </span>
                        ) : skipped ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            No order: {visitMap.get(s.id)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            Pending
                          </span>
                        )}
                        <span className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {balance < 0 ? `Advance ${rs(-balance)}` : `Due ${rs(balance)}`}
                        </span>
                      </div>

                      {!readOnly && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Link href={`/orders/new?shop=${s.id}`} className="btn-primary py-2.5">
                              <ShoppingCart size={16} />
                              {ordered ? 'Another order' : 'Book order'}
                            </Link>
                            {balance > 0 ? (
                              <Link
                                href={`/recovery?q=${encodeURIComponent(s.name)}`}
                                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700"
                              >
                                <Banknote size={16} />
                                Collect
                              </Link>
                            ) : (
                              <span className="flex items-center justify-center rounded-xl bg-slate-50 py-2.5 text-sm text-slate-400">
                                Nothing due
                              </span>
                            )}
                          </div>

                          {!ordered && !skipped && (
                            <details>
                              <summary className="cursor-pointer list-none text-center text-xs font-semibold text-slate-500 [&::-webkit-details-marker]:hidden">
                                No order from this shop
                              </summary>
                              <form action={noOrder} className="mt-2 flex gap-2">
                                <input type="hidden" name="shop_id" value={s.id} />
                                <select name="reason" required defaultValue="" className="field py-2">
                                  <option value="" disabled>Reason</option>
                                  {REASONS.map((x) => (
                                    <option key={x} value={x}>{x}</option>
                                  ))}
                                </select>
                                <button className="shrink-0 rounded-xl bg-amber-50 px-4 text-sm font-semibold text-amber-700">
                                  Save
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!list.length && (
                  <div className="card p-6 text-center text-sm text-slate-400">No shops on this route.</div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}