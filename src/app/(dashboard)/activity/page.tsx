import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  MapPin,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { dayRange, docNo, one, rs, timeLabel, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

type Gps = {
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  gps_mocked: boolean | null;
  distance_m: number | null;
};
type ShopRef = { name: string; lat: number | null };
type Named = { full_name: string };

type Entry = {
  key: string;
  at: string;
  kind: 'order' | 'payment' | 'noorder';
  who: string;
  shopId: string;
  shop: string;
  shopHasLoc: boolean;
  title: string;
  amount: number | null;
  lat: number | null;
  lng: number | null;
  acc: number | null;
  mocked: boolean;
  dist: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function goBack(date: string, salesman: string, kind: 'ok' | 'error', msg: string): never {
  const d = DATE_RE.test(date) ? date : todayPK();
  const s = UUID_RE.test(salesman) ? `&salesman=${salesman}` : '';
  redirect(`/activity?date=${d}${s}&${kind}=${encodeURIComponent(msg)}`);
}

async function setLocation(fd: FormData) {
  'use server';
  const date = String(fd.get('date') ?? '');
  const salesman = String(fd.get('salesman') ?? '');

  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) goBack(date, salesman, 'error', 'Not allowed');

  const { error } = await supabase.rpc('set_shop_location', {
    p_shop: String(fd.get('shop_id') ?? ''),
    p_lat: Number(fd.get('lat')),
    p_lng: Number(fd.get('lng')),
  });

  revalidatePath('/activity');
  if (error) goBack(date, salesman, 'error', error.message.replace(/^[A-Z_]+:\s*/, ''));
  goBack(date, salesman, 'ok', 'Shop location saved');
}

const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

function DistChip({ e }: { e: Entry }) {
  const base = 'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold';
  if (e.lat == null) return <span className={`${base} bg-slate-100 text-slate-600`}>No GPS</span>;
  if (e.dist == null) {
    return <span className={`${base} bg-slate-100 text-slate-600`}>Shop location not set</span>;
  }
  if (e.dist <= 100) {
    return <span className={`${base} bg-emerald-50 text-emerald-700`}>At shop · {fmtDist(e.dist)}</span>;
  }
  if (e.dist <= 300) {
    return <span className={`${base} bg-amber-50 text-amber-700`}>Near · {fmtDist(e.dist)}</span>;
  }
  return <span className={`${base} bg-red-50 text-red-700`}>Far · {fmtDist(e.dist)}</span>;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; salesman?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : todayPK();
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/');

  const { data: men } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'salesman')
    .order('full_name');

  const sid = (men ?? []).some((m) => m.id === sp.salesman) ? (sp.salesman as string) : '';

  const { from, to } = dayRange(date);

  let oq = supabase
    .from('orders')
    .select(
      'id, order_no, total, status, booked_at, salesman_id, shop_id, gps_lat, gps_lng, gps_accuracy, gps_mocked, distance_m, shops(name, lat), salesman:profiles!orders_salesman_id_fkey(full_name)'
    )
    .is('deleted_at', null)
    .gte('booked_at', from)
    .lt('booked_at', to)
    .order('booked_at', { ascending: false })
    .limit(500);

  let cq = supabase
    .from('collections')
    .select(
      'id, receipt_no, amount, method, created_at, collected_by, shop_id, gps_lat, gps_lng, gps_accuracy, gps_mocked, distance_m, shops(name, lat), collector:profiles!collections_collected_by_fkey(full_name)'
    )
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false })
    .limit(500);

  let vq = supabase
    .from('visits')
    .select(
      'id, no_order_reason, visited_at, salesman_id, shop_id, gps_lat, gps_lng, gps_accuracy, gps_mocked, distance_m, shops(name, lat), salesman:profiles!visits_salesman_id_fkey(full_name)'
    )
    .eq('outcome', 'no_order')
    .gte('visited_at', from)
    .lt('visited_at', to)
    .order('visited_at', { ascending: false })
    .limit(500);

  if (sid) {
    oq = oq.eq('salesman_id', sid);
    cq = cq.eq('collected_by', sid);
    vq = vq.eq('salesman_id', sid);
  }

  const [{ data: orders }, { data: cols }, { data: visits }] = await Promise.all([oq, cq, vq]);

  const entries: Entry[] = [];

  for (const o of orders ?? []) {
    const g = o as unknown as Gps;
    const shop = one(o.shops as unknown as ShopRef | ShopRef[] | null);
    entries.push({
      key: 'o' + o.id,
      at: o.booked_at as string,
      kind: 'order',
      who: one(o.salesman as unknown as Named | Named[] | null)?.full_name ?? 'Staff',
      shopId: o.shop_id as string,
      shop: shop?.name ?? 'Shop',
      shopHasLoc: shop?.lat != null,
      title: `Order #${o.order_no}`,
      amount: Number(o.total),
      lat: g.gps_lat,
      lng: g.gps_lng,
      acc: g.gps_accuracy,
      mocked: !!g.gps_mocked,
      dist: g.distance_m,
    });
  }

  for (const c of cols ?? []) {
    const g = c as unknown as Gps;
    const shop = one(c.shops as unknown as ShopRef | ShopRef[] | null);
    entries.push({
      key: 'c' + c.id,
      at: c.created_at as string,
      kind: 'payment',
      who: one(c.collector as unknown as Named | Named[] | null)?.full_name ?? 'Staff',
      shopId: c.shop_id as string,
      shop: shop?.name ?? 'Shop',
      shopHasLoc: shop?.lat != null,
      title: `Payment ${docNo('RC-', c.receipt_no)} (${c.method})`,
      amount: Number(c.amount),
      lat: g.gps_lat,
      lng: g.gps_lng,
      acc: g.gps_accuracy,
      mocked: !!g.gps_mocked,
      dist: g.distance_m,
    });
  }

  for (const v of visits ?? []) {
    const g = v as unknown as Gps;
    const shop = one(v.shops as unknown as ShopRef | ShopRef[] | null);
    entries.push({
      key: 'v' + v.id,
      at: v.visited_at as string,
      kind: 'noorder',
      who: one(v.salesman as unknown as Named | Named[] | null)?.full_name ?? 'Staff',
      shopId: v.shop_id as string,
      shop: shop?.name ?? 'Shop',
      shopHasLoc: shop?.lat != null,
      title: `No order: ${v.no_order_reason ?? ''}`,
      amount: null,
      lat: g.gps_lat,
      lng: g.gps_lng,
      acc: g.gps_accuracy,
      mocked: !!g.gps_mocked,
      dist: g.distance_m,
    });
  }

  entries.sort((a, b) => b.at.localeCompare(a.at));

  const orderCount = entries.filter((e) => e.kind === 'order').length;
  const collected = entries.filter((e) => e.kind === 'payment').reduce((s, e) => s + (e.amount ?? 0), 0);
  const noOrder = entries.filter((e) => e.kind === 'noorder').length;
  const far = entries.filter((e) => e.dist != null && e.dist > 300).length;
  const noGps = entries.filter((e) => e.lat == null).length;
  const mocked = entries.filter((e) => e.mocked).length;

  const perMan = new Map<string, { count: number; first: string; last: string; far: number }>();
  for (const e of entries) {
    const cur = perMan.get(e.who) ?? { count: 0, first: e.at, last: e.at, far: 0 };
    cur.count += 1;
    if (e.at < cur.first) cur.first = e.at;
    if (e.at > cur.last) cur.last = e.at;
    if (e.dist != null && e.dist > 300) cur.far += 1;
    perMan.set(e.who, cur);
  }

  const stats = [
    { l: 'Orders', v: String(orderCount), icon: ClipboardList, tint: 'bg-indigo-50 text-indigo-600' },
    { l: 'Collected', v: rs(collected), icon: Banknote, tint: 'bg-emerald-50 text-emerald-600' },
    { l: 'No-order visits', v: String(noOrder), icon: XCircle, tint: 'bg-amber-50 text-amber-600' },
    { l: 'Far from shop', v: String(far), icon: MapPin, tint: 'bg-red-50 text-red-600' },
  ];

  const icons = { order: ClipboardList, payment: Banknote, noorder: XCircle } as const;
  const tints = {
    order: 'bg-indigo-50 text-indigo-600',
    payment: 'bg-emerald-50 text-emerald-600',
    noorder: 'bg-amber-50 text-amber-600',
  } as const;

  return (
    <div className="space-y-4">
      <PageHeader title="Field activity" subtitle="What each salesman did, where, and when" />

      {sp.ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{sp.ok}</p>
        </div>
      )}
      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{sp.error}</p>
        </div>
      )}

      <form className="card flex flex-wrap gap-2 p-3">
        <input type="date" name="date" defaultValue={date} className="field w-auto py-2.5" />
        <select name="salesman" defaultValue={sid} className="field w-auto min-w-44 flex-1 py-2.5">
          <option value="">All salesmen</option>
          {men?.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
        <button className="btn-primary px-5 py-2.5">Show</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((x) => (
          <div key={x.l} className="card p-4">
            <div className={`mb-3 grid size-10 place-items-center rounded-xl ${x.tint}`}>
              <x.icon size={20} />
            </div>
            <p className="text-lg font-bold text-slate-900 md:text-2xl">{x.v}</p>
            <p className="text-xs text-slate-500">{x.l}</p>
          </div>
        ))}
      </div>

      {(noGps > 0 || mocked > 0) && (
        <div className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            {noGps > 0 && `${noGps} ${noGps === 1 ? 'entry has' : 'entries have'} no GPS (location off or permission denied). `}
            {mocked > 0 && `${mocked} ${mocked === 1 ? 'entry was' : 'entries were'} made with a mock location app.`}
          </p>
        </div>
      )}

      {perMan.size > 1 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...perMan.entries()].map(([name, s]) => (
            <div key={name} className="card p-4">
              <p className="font-semibold text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">
                {s.count} {s.count === 1 ? 'activity' : 'activities'} · {timeLabel(s.first)} to {timeLabel(s.last)}
              </p>
              {s.far > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{s.far} far from shop</p>}
            </div>
          ))}
        </div>
      )}

      {!entries.length ? (
        <EmptyState icon={MapPin} title="No activity on this day" hint="Orders, payments and no-order visits appear here." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {entries.map((e) => {
            const Icon = icons[e.kind];
            const canFix = e.lat != null && e.lng != null && (!e.shopHasLoc || (e.dist != null && e.dist > 300));
            return (
              <div key={e.key} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${tints[e.kind]}`}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{e.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {e.who} · {e.shop} · {timeLabel(e.at)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <DistChip e={e} />
                    {e.acc != null && (
                      <span className="text-[11px] text-slate-400">accuracy {Math.round(e.acc)} m</span>
                    )}
                    {e.mocked && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                        <AlertTriangle size={12} />
                        Mock location
                      </span>
                    )}
                    {e.lat != null && e.lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600"
                      >
                        <ExternalLink size={12} />
                        Map
                      </a>
                    )}
                    {canFix && (
                      <form action={setLocation}>
                        <input type="hidden" name="shop_id" value={e.shopId} />
                        <input type="hidden" name="lat" value={e.lat ?? ''} />
                        <input type="hidden" name="lng" value={e.lng ?? ''} />
                        <input type="hidden" name="date" value={date} />
                        <input type="hidden" name="salesman" value={sid} />
                        <button className="text-[11px] font-semibold text-slate-500 underline">
                          Use as shop location
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {e.amount != null && (
                  <p className={`text-sm font-bold ${e.kind === 'payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {rs(e.amount)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}