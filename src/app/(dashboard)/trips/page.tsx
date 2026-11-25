import Link from 'next/link';
import { CheckCheck, FileText, Plus, Truck, Banknote } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { dateLabel, one, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';

const TABS = [
  { key: 'draft', label: 'Draft' },
  { key: 'loaded', label: 'Loaded' },
  { key: 'settled', label: 'Settled' },
  { key: 'all', label: 'All' },
];

type Named = { name: string };
type TO = { orders: { total: number } | { total: number }[] | null };

// Start of today in Pakistan (UTC+5, no DST), as a UTC ISO string
function pkDayStartIso() {
  const h = 5 * 3600 * 1000;
  const local = Date.now() + h;
  const startLocal = local - (local % (24 * 3600 * 1000));
  return new Date(startLocal - h).toISOString();
}

const sum = (rows: { total: number | string | null }[] | null | undefined) =>
  (rows ?? []).reduce((a, r) => a + (Number(r.total) || 0), 0);

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'draft' } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const dayStart = pkDayStartIso();

  let query = supabase
    .from('delivery_trips')
    .select('id, trip_no, trip_date, status, vehicle_no, routes(name), trip_orders(orders(total))')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') query = query.eq('status', status);

  const [{ data: trips }, { data: approved }, { data: loadedToday }, { data: openTrips }, { data: invToday }] =
    await Promise.all([
      query,
      supabase.from('orders').select('total').eq('status', 'approved').is('deleted_at', null),
      supabase
        .from('delivery_trips')
        .select('id')
        .gte('loaded_at', dayStart)
        .neq('status', 'cancelled'),
      supabase.from('delivery_trips').select('id').in('status', ['loaded', 'out']),
      supabase.from('invoices').select('total').gte('created_at', dayStart),
    ]);

  const approvedCount = approved?.length ?? 0;
  const approvedAmount = sum(approved);
  const loadedCount = loadedToday?.length ?? 0;
  const openCount = openTrips?.length ?? 0;
  const invCount = invToday?.length ?? 0;
  const invAmount = sum(invToday);
  const manage = canManage(profile.role);

  const approvedBox = (
    <>
      <div className="mb-2 grid size-8 place-items-center rounded-xl bg-amber-50 text-amber-600">
        <CheckCheck size={16} />
      </div>
      <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{approvedCount}</p>
      <p className="text-[11px] font-semibold text-slate-500">Approved orders waiting</p>
      <p className="mt-1 truncate text-xs font-bold text-amber-600">{rs(approvedAmount)}</p>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Delivery trips"
        subtitle="Group approved orders, load the van, print invoices"
        action={
          manage && (
            <Link href="/trips/new" className="btn-primary shrink-0">
              <Plus size={18} />
              New
              
            </Link>
            
          )
        }
      />
      
<Link
  href="/trips/cash"
  className="card mb-4 flex items-center gap-3 p-3 transition hover:bg-indigo-50 active:scale-[0.99]"
>
  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
    <Banknote size={20} />
  </div>
  <div className="min-w-0 flex-1">
    <p className="text-sm font-semibold text-slate-900">Delivery cash</p>
    <p className="truncate text-xs text-slate-500">By date and delivery man</p>
  </div>
  <span className="text-sm font-semibold text-indigo-600">Open &rarr;</span>
</Link>


      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
        {manage ? (
          
          <Link
            href="/trips/new"
            className={`card p-3 transition active:scale-[0.99] md:p-4 ${approvedCount > 0 ? 'ring-1 ring-amber-300' : ''}`}
          >
            {approvedBox}
          </Link>
        ) : (
          <div className="card p-3 md:p-4">{approvedBox}</div>
        )}

        <Link href="/trips?status=loaded" className="card p-3 transition active:scale-[0.99] md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-sky-50 text-sky-600">
            <Truck size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{loadedCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Trips loaded today</p>
          <p className="mt-1 truncate text-xs font-bold text-sky-600">{openCount} still open</p>
        </Link>

        <div className="card p-3 md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileText size={16} />
          </div>
          <p className="truncate text-xl font-extrabold text-slate-900 md:text-2xl">{rs(invAmount)}</p>
          <p className="text-[11px] font-semibold text-slate-500">Invoiced today</p>
          <p className="mt-1 truncate text-xs font-bold text-emerald-600">
            {invCount} invoice{invCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/trips?status=${t.key}`}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === t.key
                ? 'hero text-white shadow-md shadow-indigo-500/25'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!trips?.length ? (
        <EmptyState icon={Truck} title="No trips here" hint="Create a trip from approved orders." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {trips.map((t) => {
            const route = one(t.routes as unknown as Named | Named[] | null);
            const tos = (t.trip_orders ?? []) as unknown as TO[];
            const total = tos.reduce((s, x) => s + Number(one(x.orders)?.total ?? 0), 0);
            return (
              <Link
                key={t.id}
                href={`/trips/${t.id}`}
                className="card flex items-center gap-3 p-4 transition active:scale-[0.99]"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <Truck size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    Trip #{t.trip_no} · {route?.name ?? 'All routes'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {dateLabel(t.trip_date)}
                    {t.vehicle_no ? ` · ${t.vehicle_no}` : ''} · {tos.length}{' '}
                    {tos.length === 1 ? 'order' : 'orders'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{rs(total)}</p>
                  <StatusChip status={t.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}