import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AlertTriangle, ArrowLeft, Banknote, FileText, Printer, Truck, XCircle } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { loadTripData } from '@/lib/trips';
import { ctn, dateLabel, docNo, one, rs } from '@/lib/format';
import StatusChip from '@/components/StatusChip';
import SettlementCard from '@/components/SettlementCard';

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, profile } = await requireProfile();

  async function load() {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('load_trip', { p_trip_id: id });
    revalidatePath('/trips');
    revalidatePath(`/trips/${id}`);
    revalidatePath('/stock');
    if (error) redirect(`/trips/${id}?error=${encodeURIComponent(error.message)}`);
    redirect(`/trips/${id}`);
  }

  async function cancel() {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('cancel_trip', { p_trip_id: id });
    revalidatePath('/trips');
    revalidatePath('/orders');
    if (error) redirect(`/trips/${id}?error=${encodeURIComponent(error.message)}`);
    redirect('/trips');
  }

  const trip = await loadTripData(supabase, id);
  if (!trip) notFound();

  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_no, total, shops(name)')
    .eq('trip_id', id)
    .order('invoice_no');

  const draft = trip.status === 'draft';
  const canLoad = ['owner', 'manager', 'warehouse'].includes(profile.role);
  const short = trip.lines.some((l) => l.have !== null && l.have < l.qty);
  const total = trip.orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Trips
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Trip #{trip.no}</h1>
              <p className="text-xs text-slate-500">
                {dateLabel(trip.date)} · {trip.route ?? 'All routes'}
              </p>
            </div>
          </div>
          <StatusChip status={trip.status} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { l: 'Vehicle', v: trip.vehicle ?? '-' },
            { l: 'Delivery man', v: trip.driver ?? '-' },
            { l: 'Warehouse', v: trip.warehouse ?? '-' },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">{x.l}</p>
              <p className="truncate text-sm font-semibold text-slate-900">{x.v}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>{error.replace(/^[A-Z_]+:\s*/, '')}</p>
        </div>
      )}
             <SettlementCard tripId={id} status={trip.status} role={profile.role} />
      <div className="card">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold text-slate-900">Load sheet</h2>
          <span className="text-xs text-slate-500">{trip.lines.length} products</span>
        </div>
        <div className="divide-y divide-slate-100">
          {trip.lines.map((l) => {
            const bad = l.have !== null && l.have < l.qty;
            return (
              <div key={l.productId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{l.name}</p>
                  {l.have !== null && (
                    <p className={`text-xs ${bad ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                      In stock: {ctn(l.have, l.perCarton)}
                      {bad && ` (short by ${l.qty - l.have} pcs)`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{ctn(l.qty, l.perCarton)}</p>
                  <p className="text-[11px] text-slate-400">{l.qty} pcs</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {trip.picks.length > 0 && (
        <div className="card">
          <h2 className="p-4 pb-2 font-bold text-slate-900">Picked from batches</h2>
          <div className="divide-y divide-slate-100">
            {trip.picks.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.batch ? `Batch ${p.batch}` : 'No batch'}
                    {p.expiry ? ` · Exp ${dateLabel(p.expiry)}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-slate-900">{ctn(p.qty, p.perCarton)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold text-slate-900">Orders</h2>
          <span className="text-sm font-bold text-slate-900">{rs(total)}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {trip.orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{o.shop}</p>
                <p className="truncate text-xs text-slate-500">
                  Order #{o.no}
                  {o.address ? ` · ${o.address}` : ''}
                </p>
              </div>
              <p className="font-semibold text-slate-900">{rs(o.total)}</p>
            </Link>
          ))}
        </div>
      </div>

      {draft && (
        <div className="space-y-3">
          {short && (
            <div className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                Stock is short for at least one product. Loading will be blocked until you receive more
                stock, or cancel this trip and remove those orders.
              </p>
            </div>
          )}

          {canLoad && (
            <form action={load}>
              <button className="btn-primary w-full">
                <Truck size={18} />
                Load trip and generate invoices
              </button>
            </form>
          )}

          {canManage(profile.role) && (
            <form action={cancel}>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100">
                <XCircle size={18} />
                Cancel trip
              </button>
            </form>
          )}
        </div>
      )}

      {!draft && (
        <>
                    <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href={`/trips/${id}/loadsheet`}
              className="card flex items-center gap-3 p-4 font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <Printer size={20} className="text-indigo-600" />
              Print load sheet
            </Link>
            <Link
              href={`/trips/${id}/invoices`}
              className="card flex items-center gap-3 p-4 font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <FileText size={20} className="text-indigo-600" />
              Print all invoices
            </Link>
                        {['owner', 'manager', 'cashier'].includes(profile.role) && (
              <Link
                href={`/trips/${id}/payments`}
                className="card flex items-center gap-3 p-4 font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <Banknote size={20} className="text-indigo-600" />
                Payments sheet
              </Link>
            )}
          </div>

          {!!invs?.length && (
            <div className="card">
              <h2 className="p-4 pb-2 font-bold text-slate-900">Invoices</h2>
              <div className="divide-y divide-slate-100">
                {invs.map((i) => (
                  <Link
                    key={i.id}
                    href={`/invoices/${i.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {one(i.shops as unknown as { name: string } | { name: string }[] | null)?.name}
                      </p>
                      <p className="text-xs text-slate-500">{docNo('INV-', i.invoice_no)}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{rs(i.total)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}