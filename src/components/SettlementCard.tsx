import Link from 'next/link';
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { rs, when } from '@/lib/format';

export default async function SettlementCard({
  tripId,
  status,
  role,
}: {
  tripId: string;
  status: string;
  role: string;
}) {
  const canSettle = ['owner', 'manager', 'cashier'].includes(role);

  if (status === 'loaded' || status === 'out') {
    if (!canSettle) return null;

    const supabase = await createClient();
    const [entriesRes, checkRes] = await Promise.all([
      supabase.from('trip_cash_entries').select('amount').eq('trip_id', tripId),
      supabase
        .from('trip_load_checks')
        .select('checked_at, checked_by')
        .eq('trip_id', tripId)
        .maybeSingle(),
    ]);

    const recorded = (entriesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const check = checkRes.data;
    const checkFailed = !!checkRes.error;

    // name is looked up separately, so a missing name can never hide the confirmation
    let whoName: string | null = null;
    if (check?.checked_by) {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', check.checked_by)
        .maybeSingle();
      whoName = p?.full_name ?? null;
    }

    const tone = checkFailed
      ? 'bg-slate-50 text-slate-700 ring-slate-200'
      : check
        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
        : 'bg-amber-50 text-amber-800 ring-amber-200';

    return (
      <div className="space-y-3">
        <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold ring-1 ${tone}`}>
          {checkFailed ? <AlertTriangle size={18} /> : check ? <CheckCircle2 size={18} /> : <Clock size={18} />}
          {checkFailed
            ? 'Could not check the warehouse confirmation'
            : check
              ? `Warehouse confirmed${whoName ? ` by ${whoName}` : ''} · ${when(check.checked_at)}`
              : 'Warehouse has not confirmed the handover yet'}
        </div>

        <Link
          href={`/trips/${tripId}/settle`}
          className="hero flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20 transition active:scale-[0.99]"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-white/20">
            <Banknote size={22} />
          </div>
          <div className="flex-1">
            <p className="font-bold">Settle this trip</p>
            <p className="text-xs text-indigo-100">Record deliveries, returns and cash collected</p>
            <p className="mt-1 text-xs font-semibold text-white">Delivery man recorded: {rs(recorded)}</p>
          </div>
          <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  if (status !== 'settled') return null;

  const supabase = await createClient();
  const [{ data: trip }, { data: invs }] = await Promise.all([
    supabase
      .from('delivery_trips')
      .select('cash_expected, cash_received, cash_difference, settled_at, settle_note')
      .eq('id', tripId)
      .maybeSingle(),
    supabase.from('invoices').select('total, returned_value, collected').eq('trip_id', tripId),
  ]);

  const invoiced = (invs ?? []).reduce((s, i) => s + Number(i.total), 0);
  const returns = (invs ?? []).reduce((s, i) => s + Number(i.returned_value), 0);
  const collected = (invs ?? []).reduce((s, i) => s + Number(i.collected), 0);
  const diff = Number(trip?.cash_difference ?? 0);

  const boxes = [
    { l: 'Invoiced', v: rs(invoiced), c: 'text-slate-900' },
    { l: 'Returns', v: rs(returns), c: 'text-slate-900' },
    { l: 'Collected', v: rs(collected), c: 'text-slate-900' },
    {
      l: diff < 0 ? 'Cash short' : diff > 0 ? 'Cash extra' : 'Cash difference',
      v: rs(Math.abs(diff)),
      c: diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
  ];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Settlement</h2>
        {trip?.settled_at && <span className="text-xs text-slate-500">{when(trip.settled_at)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {boxes.map((b) => (
          <div key={b.l} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{b.l}</p>
            <p className={`text-sm font-bold ${b.c}`}>{b.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Cash handed in: {rs(trip?.cash_received)}
        {trip?.settle_note ? ` · ${trip.settle_note}` : ''}
      </p>
    </div>
  );
}