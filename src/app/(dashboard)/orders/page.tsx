import Link from 'next/link';
import { Check, ClipboardList, Clock, Inbox, Plus, ThumbsUp } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { one, rs, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';
import ApproveAllButton from '@/components/ApproveAllButton';
import TripSelect from '@/components/TripSelect';
import { approveAllAction, approveOneAction } from './actions';
import { createTripFromOrders } from './trip-actions';

const TABS = [
  { key: 'booked', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

type Named = { name?: string; full_name?: string; route_id?: string | null };

// Start of today in Pakistan (UTC+5, no DST), as a UTC ISO string
function pkDayStartIso() {
  const h = 5 * 3600 * 1000;
  const local = Date.now() + h;
  const startLocal = local - (local % (24 * 3600 * 1000));
  return new Date(startLocal - h).toISOString();
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; done?: string; failed?: string; err?: string }>;
}) {
  const { status = 'booked', done, failed, err } = await searchParams;
  const { supabase, profile } = await requireProfile();

  const canBook = ['owner', 'manager', 'salesman'].includes(profile.role);
  const canApprove = ['owner', 'manager'].includes(profile.role);
  const tripMode = canApprove && status === 'approved';

  let query = supabase
    .from('orders')
    .select(
      'id, order_no, status, total, booked_at, shops(name, route_id), salesman:profiles!orders_salesman_id_fkey(full_name)'
    )
    .is('deleted_at', null)
    .order('booked_at', { ascending: false })
    .limit(100);

  if (status !== 'all') query = query.eq('status', status);

  const [{ data: orders }, { data: pendingAll }, { data: todayAll }, dmRes, whRes] = await Promise.all([
    query,
    supabase.from('orders').select('total').eq('status', 'booked').is('deleted_at', null),
    supabase
      .from('orders')
      .select('total, status')
      .is('deleted_at', null)
      .gte('booked_at', pkDayStartIso()),
    tripMode
      ? supabase
          .from('profiles')
          .select('id, full_name, vehicle_no')
          .eq('role', 'delivery')
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string; vehicle_no: string | null }[] }),
    tripMode
      ? supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const sum = (rows: { total: number | string | null }[] | null | undefined) =>
    (rows ?? []).reduce((a, r) => a + (Number(r.total) || 0), 0);

  const pendingCount = pendingAll?.length ?? 0;
  const pendingAmount = sum(pendingAll);

  const todayRows = (todayAll ?? []).filter((o) => o.status !== 'rejected');
  const todayCount = todayRows.length;
  const todayAmount = sum(todayRows);

  const approvedRows = (todayAll ?? []).filter((o) => o.status === 'approved');
  const approvedCount = approvedRows.length;
  const approvedAmount = sum(approvedRows);

  const doneN = Number(done ?? 0);
  const failedN = Number(failed ?? 0);

  const tripOrders = (orders ?? []).map((o) => {
    const shop = one(o.shops as unknown as Named | Named[] | null);
    const man = one(o.salesman as unknown as Named | Named[] | null);
    return {
      id: o.id as string,
      orderNo: o.order_no as number,
      shop: shop?.name ?? 'Unknown shop',
      by: man?.full_name ?? '-',
      when: when(o.booked_at),
      total: Number(o.total),
      routeId: shop?.route_id ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Review and approve booked orders"
        action={
          canBook && (
            <Link href="/orders/new" className="btn-primary shrink-0">
              <Plus size={18} />
              New
            </Link>
          )
        }
      />

      {/* Result of an approve action */}
      {(doneN > 0 || failedN > 0 || err) && (
        <div
          className={`mb-4 rounded-2xl p-4 text-sm ring-1 ${
            failedN > 0 || (err && doneN === 0)
              ? 'bg-amber-50 text-amber-900 ring-amber-200'
              : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
          }`}
        >
          {doneN > 0 && (
            <p className="font-semibold">
              {doneN} order{doneN === 1 ? '' : 's'} approved.
            </p>
          )}
          {failedN > 0 && (
            <p className="font-semibold">
              {failedN} order{failedN === 1 ? '' : 's'} skipped. Open them one by one.
            </p>
          )}
          {err && <p className="mt-1">{err}</p>}
        </div>
      )}

      {/* Summary boxes */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
        <div className="card p-3 md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Inbox size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{todayCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Received today</p>
          <p className="mt-1 truncate text-xs font-bold text-indigo-600">{rs(todayAmount)}</p>
        </div>

        <Link
          href="/orders?status=booked"
          className={`card p-3 transition active:scale-[0.99] md:p-4 ${
            pendingCount > 0 ? 'ring-1 ring-amber-300' : ''
          }`}
        >
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <Clock size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{pendingCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Pending approval</p>
          <p className="mt-1 truncate text-xs font-bold text-amber-600">{rs(pendingAmount)}</p>
        </Link>

        <Link href="/orders?status=approved" className="card p-3 transition active:scale-[0.99] md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <ThumbsUp size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{approvedCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Approved today</p>
          <p className="mt-1 truncate text-xs font-bold text-emerald-600">{rs(approvedAmount)}</p>
        </Link>
      </div>

      {/* Approve all */}
      {canApprove && pendingCount > 0 && (
        <form action={approveAllAction} className="mb-4">
          <input type="hidden" name="back" value={status} />
          <ApproveAllButton count={Math.min(pendingCount, 100)} amount={rs(pendingAmount)} />
          {pendingCount > 100 && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Approves the oldest 100 at a time. Press again for the rest.
            </p>
          )}
        </form>
      )}

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/orders?status=${t.key}`}
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

      {!orders?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders here"
          hint="Orders booked by salesmen will appear in this list."
        />
      ) : tripMode ? (
        <TripSelect
          orders={tripOrders}
          deliveryMen={(dmRes.data ?? []).map((d) => ({
            id: d.id,
            name: d.full_name,
            vehicle: d.vehicle_no ?? '',
          }))}
          warehouses={whRes.data ?? []}
          submit={createTripFromOrders}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => {
            const shop = one(o.shops as unknown as Named | Named[] | null);
            const man = one(o.salesman as unknown as Named | Named[] | null);
            const showApprove = canApprove && o.status === 'booked';
            return (
              <div key={o.id} className="card overflow-hidden">
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-3 p-4 transition active:scale-[0.99]"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                    #{o.order_no}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{shop?.name ?? 'Unknown shop'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {man?.full_name ?? '-'} · {when(o.booked_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{rs(o.total)}</p>
                    <StatusChip status={o.status} />
                  </div>
                </Link>

                {showApprove && (
                  <form action={approveOneAction} className="border-t border-slate-100 px-4 py-3">
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="back" value={status} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200 transition active:scale-[0.99]"
                    >
                      <Check size={16} />
                      Approve
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}