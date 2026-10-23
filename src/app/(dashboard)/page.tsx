import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Route as RouteIcon,
  Store,
  TrendingUp,
  Truck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { navFor } from '@/components/nav-items';
import { one, rs, when } from '@/lib/format';
import type { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Pakistan is UTC+5, no DST
const pkKey = (iso: string | number | Date) => new Date(new Date(iso).getTime() + 5 * HOUR).toISOString().slice(0, 10);
function pkDayStartIso(offsetDays = 0) {
  const local = Date.now() + 5 * HOUR;
  const start = local - (local % DAY) + offsetDays * DAY;
  return new Date(start - 5 * HOUR).toISOString();
}
const num = (v: unknown) => Number(v) || 0;
const sum = <T,>(rows: T[] | null | undefined, f: (r: T) => number) => (rows ?? []).reduce((a, r) => a + f(r), 0);

async function count(supabase: Db, table: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).is('deleted_at', null);
  return count ?? 0;
}

function Hero({ name, role }: { name: string; role: string }) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
  return (
    <>
      <p className="relative text-sm text-indigo-100">{today}</p>
      <h1 className="relative mt-1 text-2xl font-bold md:text-3xl">Welcome back, {name.split(' ')[0]}</h1>
      <p className="relative mt-1 text-sm capitalize text-indigo-100">{role} account</p>
    </>
  );
}

function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="hero relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 md:p-8">
      <div className="absolute -right-10 -top-12 size-48 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -bottom-16 left-1/3 size-40 rounded-full bg-fuchsia-300/20 blur-2xl" />
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const manager = canManage(profile.role);

  if (!manager) {
    const links = navFor(profile.role).filter((n) => n.href !== '/');
    return (
      <div className="space-y-5">
        <HeroShell>
          <Hero name={profile.full_name} role={profile.role} />
        </HeroShell>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="card flex flex-col gap-3 p-4 transition active:scale-[0.98]">
              <div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon size={22} />
              </div>
              <p className="font-semibold text-slate-900">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const dayStart = pkDayStartIso(0);
  const weekStart = pkDayStartIso(-6);

  const [
    products,
    routes,
    shops,
    { data: weekOrders },
    { data: pendingOrders },
    { data: invToday },
    { data: payToday },
    { data: balances },
    { data: openTrips },
    { data: reqs },
    { data: newShops },
    { data: stock },
    { data: recent },
  ] = await Promise.all([
    count(supabase, 'products'),
    count(supabase, 'routes'),
    count(supabase, 'shops'),
    supabase
      .from('orders')
      .select('total, status, booked_at')
      .is('deleted_at', null)
      .gte('booked_at', weekStart)
      .limit(5000),
    supabase.from('orders').select('total').eq('status', 'booked').is('deleted_at', null),
    supabase.from('invoices').select('total').gte('created_at', dayStart),
    supabase.from('shop_ledger').select('credit').eq('entry_type', 'payment').gte('created_at', dayStart).limit(5000),
    supabase.from('shop_balances').select('shop_id, ledger_balance').gt('ledger_balance', 0).order('ledger_balance', { ascending: false }).limit(2000),
    supabase.from('delivery_trips').select('id').in('status', ['loaded', 'out']),
    supabase.from('return_requests').select('id').eq('status', 'pending'),
    supabase.from('shops').select('id').eq('status', 'pending').is('deleted_at', null),
    supabase.from('product_stats').select('product_id, stock_pcs, expiring_pcs'),
    supabase
      .from('orders')
      .select('id, order_no, status, total, booked_at, shops(name)')
      .is('deleted_at', null)
      .order('booked_at', { ascending: false })
      .limit(6),
  ]);

  // low stock: products below their minimum
  const { data: mins } = await supabase.from('products').select('id, min_stock_pcs').is('deleted_at', null).gt('min_stock_pcs', 0);
  const stockMap = new Map((stock ?? []).map((s) => [s.product_id as string, num(s.stock_pcs)]));
  const lowStock = (mins ?? []).filter((p) => (stockMap.get(p.id as string) ?? 0) < num(p.min_stock_pcs)).length;
  const expiring = sum(stock, (s) => num(s.expiring_pcs));

  // today numbers
  const todayKey = pkKey(Date.now());
  const live = (weekOrders ?? []).filter((o) => o.status !== 'rejected');
  const todayOrders = live.filter((o) => pkKey(o.booked_at) === todayKey);
  const outstanding = sum(balances, (b) => num(b.ledger_balance));

  // 7 day chart
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = pkKey(Date.now() - (6 - i) * DAY);
    const amount = sum(
      live.filter((o) => pkKey(o.booked_at) === key),
      (o) => num(o.total)
    );
    const label = new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    return { key, label, amount };
  });
  const maxDay = Math.max(...days.map((d) => d.amount), 1);
  const weekTotal = sum(days, (d) => d.amount);

  // top owing shops
  const topBal = (balances ?? []).slice(0, 5);
  const { data: topShops } = topBal.length
    ? await supabase.from('shops').select('id, name').in('id', topBal.map((b) => b.shop_id as string))
    : { data: [] as { id: string; name: string }[] };
  const shopName = new Map((topShops ?? []).map((s) => [s.id as string, s.name as string]));

  const stats = [
    {
      label: 'Orders today',
      value: String(todayOrders.length),
      sub: rs(sum(todayOrders, (o) => num(o.total))),
      icon: ClipboardList,
      tint: 'bg-indigo-50 text-indigo-600',
      href: '/orders?status=all',
    },
    {
      label: 'Invoiced today',
      value: rs(sum(invToday, (i) => num(i.total))),
      sub: `${invToday?.length ?? 0} invoice${(invToday?.length ?? 0) === 1 ? '' : 's'}`,
      icon: FileText,
      tint: 'bg-sky-50 text-sky-600',
      href: '/trips?status=loaded',
    },
    {
      label: 'Cash received today',
      value: rs(sum(payToday, (p) => num(p.credit))),
      sub: 'posted to shop accounts',
      icon: Banknote,
      tint: 'bg-emerald-50 text-emerald-600',
      href: '/cash',
    },
    {
      label: 'Total outstanding',
      value: rs(outstanding),
      sub: `${balances?.length ?? 0} shops owing`,
      icon: Wallet,
      tint: 'bg-amber-50 text-amber-600',
      href: '/reports?tab=aging',
    },
  ];

  const attention = [
    {
      label: 'Orders to approve',
      n: pendingOrders?.length ?? 0,
      note: rs(sum(pendingOrders, (o) => num(o.total))),
      href: '/orders?status=booked',
      icon: Clock,
    },
    { label: 'Trips to settle', n: openTrips?.length ?? 0, note: 'loaded, not settled', href: '/trips?status=loaded', icon: Truck },
    { label: 'Return requests', n: reqs?.length ?? 0, note: 'waiting for approval', href: '/returns?tab=requests', icon: RotateCcw },
    { label: 'New shops', n: newShops?.length ?? 0, note: 'waiting for approval', href: '/new-shops', icon: UserPlus },
    { label: 'Low stock', n: lowStock, note: 'below minimum', href: '/products', icon: Package },
    { label: 'Expiring soon', n: expiring, note: 'pcs within 30 days', href: '/reports/stock?tab=expiry', icon: AlertTriangle },
  ];
  const allClear = attention.every((a) => a.n === 0);

  const steps = [
    { label: 'Add your products', done: products > 0, href: '/products' },
    { label: 'Create delivery routes', done: routes > 0, href: '/routes' },
    { label: 'Add shops to routes', done: shops > 0, href: '/shops' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const quick = [
    { label: 'New order', href: '/orders/new', icon: Plus },
    { label: 'New trip', href: '/trips/new', icon: Truck },
    { label: 'Receive stock', href: '/stock/receive', icon: Package },
    { label: 'Add expense', href: '/expenses', icon: Receipt },
  ];

  return (
    <div className="space-y-5">
      <HeroShell>
        <Hero name={profile.full_name} role={profile.role} />
        <div className="relative mt-5 flex flex-wrap gap-2">
          {quick.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 active:scale-[0.98]"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </HeroShell>

      {/* Today */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition active:scale-[0.98] md:p-5">
            <div className={`mb-3 grid size-10 place-items-center rounded-xl ${s.tint}`}>
              <s.icon size={20} />
            </div>
            <p className="truncate text-xl font-extrabold text-slate-900 md:text-2xl">{s.value}</p>
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{s.sub}</p>
          </Link>
        ))}
      </section>

      {/* Needs attention */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Needs your attention</h2>
          {allClear && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={14} />
              All clear
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {attention.map(({ label, n, note, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-2xl p-3 transition active:scale-[0.98] ${
                n > 0 ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50'
              }`}
            >
              <div
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  n > 0 ? 'bg-white text-amber-600' : 'bg-white text-slate-400'
                }`}
              >
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className={`text-lg font-extrabold leading-tight ${n > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{n}</p>
                <p className="truncate text-[11px] font-semibold text-slate-600">{label}</p>
                <p className="truncate text-[10px] text-slate-400">{note}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Chart */}
        <section className="card p-5 lg:col-span-3">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Sales, last 7 days</h2>
              <p className="text-xs text-slate-500">Orders booked, rejected excluded</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-lg font-extrabold text-indigo-700">
                <TrendingUp size={16} />
                {rs(weekTotal)}
              </p>
              <p className="text-[11px] text-slate-400">this week</p>
            </div>
          </div>
          <div className="flex h-44 items-end gap-2">
            {days.map((d) => {
              const h = Math.max((d.amount / maxDay) * 100, d.amount > 0 ? 6 : 2);
              const isToday = d.key === todayKey;
              return (
                <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {d.amount > 0 ? (d.amount >= 1000 ? `${Math.round(d.amount / 1000)}k` : Math.round(d.amount)) : ''}
                  </span>
                  <div
                    className={`w-full rounded-t-lg ${isToday ? 'hero' : 'bg-indigo-100'}`}
                    style={{ height: `${h}%` }}
                    title={rs(d.amount)}
                  />
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-indigo-700' : 'text-slate-400'}`}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top owing */}
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Top shops owing</h2>
            <Link href="/reports?tab=aging" className="text-xs font-semibold text-indigo-600">
              Aging →
            </Link>
          </div>
          {topBal.length === 0 ? (
            <p className="text-sm text-slate-500">No shop owes anything right now.</p>
          ) : (
            <div className="space-y-2.5">
              {topBal.map((b, i) => {
                const pct = (num(b.ledger_balance) / Math.max(num(topBal[0].ledger_balance), 1)) * 100;
                return (
                  <Link key={b.shop_id as string} href={`/shops/${b.shop_id}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-800">
                        <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                        {shopName.get(b.shop_id as string) ?? 'Shop'}
                      </span>
                      <span className="ml-2 shrink-0 font-bold text-slate-900">{rs(b.ledger_balance)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Recent orders */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="font-bold text-slate-900">Recent orders</h2>
          <Link href="/orders?status=all" className="text-xs font-semibold text-indigo-600">
            View all →
          </Link>
        </div>
        {!recent?.length ? (
          <p className="p-5 pt-1 text-sm text-slate-500">No orders yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((o) => {
              const shop = one(o.shops as unknown as { name: string } | { name: string }[] | null);
              const tone =
                o.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700'
                  : o.status === 'rejected'
                    ? 'bg-red-50 text-red-700'
                    : o.status === 'booked'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-sky-50 text-sky-700';
              return (
                <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">
                    #{o.order_no}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{shop?.name ?? 'Shop'}</p>
                    <p className="text-xs text-slate-500">{when(o.booked_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{rs(o.total)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tone}`}>
                      {String(o.status).replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Setup progress, only while incomplete */}
      {doneCount < 3 && (
        <section className="card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Setup progress</h2>
            <span className="chip">{doneCount}/3 done</span>
          </div>
          <div className="mb-4 mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="hero h-full rounded-full transition-all" style={{ width: `${(doneCount / 3) * 100}%` }} />
          </div>
          <div className="space-y-2">
            {steps.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-700 transition hover:bg-indigo-50"
              >
                {s.done ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-slate-300" />}
                <span className={s.done ? 'text-slate-400 line-through' : ''}>{s.label}</span>
                <ArrowRight size={16} className="ml-auto text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* quick counts */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Products', value: products, href: '/products', icon: Package, tint: 'bg-indigo-50 text-indigo-600' },
          { label: 'Routes', value: routes, href: '/routes', icon: RouteIcon, tint: 'bg-violet-50 text-violet-600' },
          { label: 'Shops', value: shops, href: '/shops', icon: Store, tint: 'bg-emerald-50 text-emerald-600' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card flex items-center gap-3 p-4 transition active:scale-[0.98]">
            <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.tint}`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}