import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Banknote, Scale, Smartphone } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dayRange, docNo, one, rs, timeLabel, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import HandoverForm from './HandoverForm';

type Named = { full_name?: string; name?: string };
type Collector = { id: string; name: string; expected: number; count: number };
type Entry = {
  key: string;
  at: string;
  title: string;
  sub: string;
  amount: number;
  diff: number | null;
  online?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayPK();
  const { supabase, profile } = await requireProfile();

  if (!['owner', 'manager', 'cashier'].includes(profile.role)) redirect('/recovery');

  async function receive(payload: string): Promise<{ ok?: boolean; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }

    const { error } = await supabase.rpc('receive_handover', { p: body });
    if (error) return { error: error.message };

    revalidatePath('/cash');
    revalidatePath('/recovery');
    return { ok: true };
  }

  const { from, to } = dayRange(date);

  const [{ data: pend }, { data: trips }, { data: hands }, { data: online }] = await Promise.all([
    supabase
      .from('collections')
      .select('amount, collected_by, collector:profiles!collections_collected_by_fkey(full_name)')
      .eq('method', 'cash')
      .is('handover_id', null),
    supabase
      .from('delivery_trips')
      .select('id, trip_no, cash_received, cash_difference, settled_at, routes(name)')
      .eq('status', 'settled')
      .gte('settled_at', from)
      .lt('settled_at', to),
    supabase
      .from('cash_handovers')
      .select(
        'id, handover_no, received, difference, created_at, collector:profiles!cash_handovers_collector_id_fkey(full_name)'
      )
      .gte('created_at', from)
      .lt('created_at', to),
    supabase
      .from('collections')
      .select('id, receipt_no, amount, created_at, shops(name)')
      .eq('method', 'online')
      .gte('created_at', from)
      .lt('created_at', to),
  ]);

  const map = new Map<string, Collector>();
  for (const r of pend ?? []) {
    const cur = map.get(r.collected_by) ?? {
      id: r.collected_by as string,
      name: one(r.collector as unknown as Named | Named[] | null)?.full_name ?? 'Staff',
      expected: 0,
      count: 0,
    };
    cur.expected += Number(r.amount);
    cur.count += 1;
    map.set(r.collected_by, cur);
  }
  const collectors = [...map.values()].map((c) => ({ ...c, expected: r2(c.expected) }));

  const entries: Entry[] = [
    ...(trips ?? []).map((t) => ({
      key: 't' + t.id,
      at: t.settled_at as string,
      title: `Trip #${t.trip_no} settled`,
      sub: one(t.routes as unknown as Named | Named[] | null)?.name ?? 'All routes',
      amount: Number(t.cash_received ?? 0),
      diff: Number(t.cash_difference ?? 0),
    })),
    ...(hands ?? []).map((h) => ({
      key: 'h' + h.id,
      at: h.created_at as string,
      title: `Handover from ${one(h.collector as unknown as Named | Named[] | null)?.full_name ?? 'staff'}`,
      sub: docNo('HO-', h.handover_no),
      amount: Number(h.received),
      diff: Number(h.difference),
    })),
    ...(online ?? []).map((o) => ({
      key: 'o' + o.id,
      at: o.created_at as string,
      title: 'Online payment',
      sub: `${one(o.shops as unknown as Named | Named[] | null)?.name ?? 'Shop'} · ${docNo('RC-', o.receipt_no)}`,
      amount: Number(o.amount),
      diff: null,
      online: true,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const cashIn = r2(entries.filter((e) => !e.online).reduce((s, e) => s + e.amount, 0));
  const onlineIn = r2(entries.filter((e) => e.online).reduce((s, e) => s + e.amount, 0));
  const netDiff = r2(entries.reduce((s, e) => s + (e.diff ?? 0), 0));
  const waiting = r2(collectors.reduce((s, c) => s + c.expected, 0));

  const boxes = [
    { l: 'Cash received', v: rs(cashIn), icon: Banknote, tint: 'bg-emerald-50 text-emerald-600', c: 'text-slate-900' },
    { l: 'Online', v: rs(onlineIn), icon: Smartphone, tint: 'bg-sky-50 text-sky-600', c: 'text-slate-900' },
    {
      l: netDiff < 0 ? 'Cash short' : netDiff > 0 ? 'Cash extra' : 'Differences',
      v: rs(Math.abs(netDiff)),
      icon: Scale,
      tint: netDiff < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
      c: netDiff < 0 ? 'text-red-600' : netDiff > 0 ? 'text-amber-600' : 'text-slate-900',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Cash" subtitle="Receive cash and review the day book" />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Cash waiting to be received</h2>
          <span className="chip">{rs(waiting)}</span>
        </div>
        {collectors.length ? (
          <HandoverForm
            key={collectors.map((c) => `${c.id}:${c.expected}`).join('|')}
            collectors={collectors}
            submit={receive}
          />
        ) : (
          <div className="card p-6 text-center text-sm text-slate-400">
            Nobody is holding recovery cash right now.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Day book</h2>
          <form className="flex gap-2">
            <input type="date" name="date" defaultValue={date} className="field w-auto py-2" />
            <button className="btn-primary px-4 py-2">Go</button>
          </form>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {boxes.map((b) => (
            <div key={b.l} className="card p-4">
              <div className={`mb-3 grid size-10 place-items-center rounded-xl ${b.tint}`}>
                <b.icon size={20} />
              </div>
              <p className={`text-base font-bold md:text-xl ${b.c}`}>{b.v}</p>
              <p className="text-xs text-slate-500">{b.l}</p>
            </div>
          ))}
        </div>

        <div className="card divide-y divide-slate-100">
          {entries.length ? (
            entries.map((e) => (
              <div key={e.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{e.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {e.sub} · {timeLabel(e.at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">+ {rs(e.amount)}</p>
                  {e.diff !== null && e.diff !== 0 && (
                    <p className={`text-[11px] font-semibold ${e.diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {e.diff < 0 ? 'Short' : 'Extra'} {rs(Math.abs(e.diff))}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-slate-400">No cash entries on this date.</p>
          )}
        </div>
      </section>
    </div>
  );
}