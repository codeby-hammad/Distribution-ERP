import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Banknote, Truck } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';
import CsvButton from '@/components/CsvButton';

type Summary = {
  trips: number;
  unsettled: number;
  collected: number;
  handed_in: number;
  pending: number;
  difference: number;
};
type Man = {
  id: string | null;
  name: string;
  trips: number;
  collected: number;
  handed_in: number;
  pending: number;
  difference: number;
};
type TripRow = {
  id: string;
  trip_no: number;
  trip_date: string;
  status: string;
  settled_at: string | null;
  delivery_man_id: string | null;
  dm_name: string;
  route_name: string | null;
  shops: number;
  bills: number;
  collected: number;
  cash_received: number | null;
  cash_difference: number | null;
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
// Pakistan is UTC+5, no DST
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(new Date(d + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;

function Box({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`truncate text-base font-extrabold md:text-lg ${tone}`}>{value}</p>
    </div>
  );
}

export default async function DeliveryCashPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; dm?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager', 'cashier'].includes(profile.role)) redirect('/');

  const today = pkToday();
  const to = isDate(sp.to) ? (sp.to as string) : today;
  const from = isDate(sp.from) ? (sp.from as string) : addDays(to, -6);
  const dm = isUuid(sp.dm) ? (sp.dm as string) : '';

  // week starts on Monday
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const weekStart = addDays(today, -((dow + 6) % 7));
  const monthStart = today.slice(0, 8) + '01';
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = lastMonthEnd.slice(0, 8) + '01';

  const presets = [
    { l: 'Today', f: today, t: today },
    { l: 'This week', f: weekStart, t: today },
    { l: 'This month', f: monthStart, t: today },
    { l: 'Last month', f: lastMonthStart, t: lastMonthEnd },
  ];

  const q = (f: string, t: string, d: string) => {
    const p = new URLSearchParams({ from: f, to: t });
    if (d) p.set('dm', d);
    return `/trips/cash?${p.toString()}`;
  };

  const [res, menRes] = await Promise.all([
    supabase.rpc('report_delivery_cash', { p_from: from, p_to: to, p_dm: dm || null }),
    supabase.from('profiles').select('id, full_name').eq('role', 'delivery').eq('is_active', true).order('full_name'),
  ]);

  const data = res.data as { summary: Summary; men: Man[]; trips: TripRow[] } | null;
  const s = data?.summary;
  const men = data?.men ?? [];
  const trips = data?.trips ?? [];
  const staff = menRes.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Delivery cash" subtitle="What each delivery man collected and handed in" />

      <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Trips
      </Link>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.l}
              href={q(p.f, p.t, dm)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                from === p.f && to === p.t ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {p.l}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-32 flex-1">
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={from} max={today} className="field" />
          </div>
          <div className="min-w-32 flex-1">
            <label className="label">To</label>
            <input type="date" name="to" defaultValue={to} max={today} className="field" />
          </div>
          <div className="min-w-40 flex-1">
            <label className="label">Delivery man</label>
            <select name="dm" defaultValue={dm} className="field">
              <option value="">All delivery men</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary shrink-0">Apply</button>
        </form>

        <p className="text-xs text-slate-500">
          {dateLabel(from)} to {dateLabel(to)}
        </p>
      </div>

      {res.error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          {res.error.message.replace(/^[A-Z_]+:\s*/, '')}
        </div>
      )}

      {!res.error && s && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Box label="Collected by delivery" value={rs(num(s.collected))} tone="text-indigo-700" />
          <Box label="Received by office" value={rs(num(s.handed_in))} tone="text-emerald-700" />
          <Box
            label={`Still with delivery (${num(s.unsettled)} open trips)`}
            value={rs(num(s.pending))}
            tone={num(s.pending) > 0 ? 'text-amber-600' : 'text-slate-900'}
          />
          <Box
            label="Difference at settlement"
            value={rs(num(s.difference))}
            tone={num(s.difference) < 0 ? 'text-red-600' : 'text-slate-900'}
          />
        </div>
      )}

      {!res.error && !dm && men.length > 1 && (
        <div className="card overflow-hidden">
          <h2 className="p-4 pb-2 font-bold text-slate-900">By delivery man</h2>
          <div className="divide-y divide-slate-100">
            {men.map((m) => (
              <Link
                key={m.id ?? 'none'}
                href={q(from, to, m.id ?? '')}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.trips} trip{m.trips === 1 ? '' : 's'} · collected {rs(num(m.collected))}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${num(m.pending) > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {num(m.pending) > 0 ? `${rs(num(m.pending))} with him` : 'All received'}
                  </p>
                  {num(m.difference) !== 0 && (
                    <p className={`text-[11px] font-semibold ${num(m.difference) < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      Difference {rs(num(m.difference))}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!res.error && !trips.length ? (
        <EmptyState icon={Truck} title="No trips in this period" hint="Try a wider date range or another delivery man." />
      ) : (
        !res.error && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-900">Trips ({trips.length})</h2>
              <CsvButton
                filename={`delivery-cash-${from}-to-${to}.csv`}
                headers={['Trip', 'Date', 'Delivery man', 'Route', 'Status', 'Bills', 'Collected', 'Handed in', 'Difference']}
                rows={trips.map((x) => [
                  x.trip_no,
                  x.trip_date,
                  x.dm_name,
                  x.route_name ?? '',
                  x.status,
                  num(x.bills),
                  num(x.collected),
                  x.settled_at ? num(x.cash_received) : '',
                  x.settled_at ? num(x.cash_difference) : '',
                ])}
              />
            </div>
            <div className="divide-y divide-slate-100">
              {trips.map((x) => {
                const open = !x.settled_at;
                return (
                  <Link
                    key={x.id}
                    href={`/trips/${x.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-xs font-bold text-sky-600">
                      #{x.trip_no}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {x.dm_name} · {dateLabel(x.trip_date)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {x.route_name ?? 'All routes'} · {x.shops} shops · bills {rs(num(x.bills))}
                      </p>
                      <p className="text-xs text-slate-500">
                        Collected <b className="text-slate-800">{rs(num(x.collected))}</b>
                        {!open && (
                          <>
                            {' '}· handed in <b className="text-emerald-700">{rs(num(x.cash_received))}</b>
                            {num(x.cash_difference) !== 0 && (
                              <b className={num(x.cash_difference) < 0 ? 'text-red-600' : 'text-slate-600'}>
                                {' '}· diff {rs(num(x.cash_difference))}
                              </b>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusChip status={x.status} />
                      {open && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <Banknote size={11} /> Settle
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}