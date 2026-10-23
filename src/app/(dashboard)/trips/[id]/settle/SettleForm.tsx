'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw, Smartphone } from 'lucide-react';
import { ctn, rs } from '@/lib/format';

type Item = {
  id: string;
  name: string;
  qty: number;
  perCarton: number;
  amount: number;
  bonus: boolean;
};
type Inv = {
  id: string;
  no: number;
  shop: string;
  subtotal: number;
  total: number;
  balance: number;
  items: Item[];
};
type Qty = { c: string; p: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const fullQty = (it: Item): Qty => ({
  c: String(Math.floor(it.qty / it.perCarton)),
  p: String(it.qty % it.perCarton),
});

export default function SettleForm({
  tripId,
  invoices,
  recorded = {},
  submit,
}: {
  tripId: string;
  invoices: Inv[];
  recorded?: Record<string, number>;
  submit: (payload: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();

  const recordedStart = () =>
    Object.fromEntries(
      invoices.filter((inv) => (recorded[inv.id] ?? 0) > 0).map((inv) => [inv.id, String(recorded[inv.id])])
    ) as Record<string, string>;

  const [qtys, setQtys] = useState<Record<string, Qty>>(() =>
    Object.fromEntries(invoices.flatMap((inv) => inv.items.map((it) => [it.id, fullQty(it)])))
  );
  const [paid, setPaid] = useState<Record<string, string>>(recordedStart);
  const [handed, setHanded] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const delivered = (it: Item) =>
    (Number(qtys[it.id]?.c) || 0) * it.perCarton + (Number(qtys[it.id]?.p) || 0);

  const calc = (inv: Inv) => {
    let returnedSub = 0;
    let invalid = false;
    for (const it of inv.items) {
      const d = delivered(it);
      if (d < 0 || d > it.qty) invalid = true;
      const dd = Math.min(Math.max(d, 0), it.qty);
      if (!it.bonus) returnedSub += r2((it.amount * (it.qty - dd)) / it.qty);
    }
    const returned =
      inv.subtotal > 0 ? Math.min(inv.total, r2((returnedSub * inv.total) / inv.subtotal)) : 0;
    const dueNow = r2(inv.total - returned);
    const p = Number(paid[inv.id]) || 0;
    if (p < 0) invalid = true;
    return { invalid, returned, dueNow, paid: p, after: r2(inv.balance + dueNow - p) };
  };

  const rows = invoices.map((inv) => ({ inv, ...calc(inv) }));
  const expected = r2(rows.reduce((s, r) => s + r.paid, 0));
  const recordedTotal = r2(invoices.reduce((s, inv) => s + (recorded[inv.id] ?? 0), 0));
  const handedValue = handed ?? String(expected);
  const diff = r2((Number(handedValue) || 0) - expected);
  const anyInvalid = rows.some((r) => r.invalid);
  const hasRecorded = recordedTotal > 0;

  const setQty = (id: string, k: 'c' | 'p', v: string) =>
    setQtys((q) => ({ ...q, [id]: { ...q[id], [k]: v } }));

  const setAll = (inv: Inv, mode: 'full' | 'none') =>
    setQtys((q) => {
      const n = { ...q };
      for (const it of inv.items) n[it.id] = mode === 'full' ? fullQty(it) : { c: '0', p: '0' };
      return n;
    });

  function resetToRecorded() {
    setPaid(recordedStart());
    setHanded(null);
  }

  function onSubmit() {
    setError('');
    if (anyInvalid) return setError('Fix the quantities or amounts highlighted in red');
    if (!confirm('Settle this trip? Ledgers and stock will be updated. This cannot be undone.')) return;

    start(async () => {
      const res = await submit(
        JSON.stringify({
          cash_received: Number(handedValue) || 0,
          note: note.trim(),
          invoices: invoices.map((inv) => ({
            invoice_id: inv.id,
            collected: Number(paid[inv.id]) || 0,
            items: inv.items.map((it) => ({ id: it.id, delivered_qty: delivered(it) })),
          })),
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else {
        router.push(`/trips/${tripId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {hasRecorded ? (
        <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600">
            <Smartphone size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-indigo-900">
              Delivery man recorded {rs(recordedTotal)} on his phone
            </p>
            <p className="text-xs text-indigo-700">
              Amounts below are prefilled from it. Count the real cash and fix any difference.
            </p>
          </div>
          <button
            onClick={resetToRecorded}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 ring-1 ring-slate-100">
          The delivery man has not recorded any cash for this trip. Enter the amounts by hand.
        </div>
      )}

      {rows.map(({ inv, invalid, returned, dueNow, paid: p, after }) => {
        const rec = recorded[inv.id] ?? 0;
        const overReturns = rec > dueNow + 0.001;
        const edited = rec > 0 && Math.abs(p - rec) > 0.001;
        return (
          <div key={inv.id} className={`card space-y-3 p-4 ${invalid ? 'ring-2 ring-red-300' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{inv.shop}</p>
                <p className="text-xs text-slate-500">
                  INV-{String(inv.no).padStart(5, '0')} · Previous balance {rs(inv.balance)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setAll(inv, 'full')}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700"
                >
                  All delivered
                </button>
                <button
                  onClick={() => setAll(inv, 'none')}
                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700"
                >
                  Return all
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl bg-slate-50/70">
              {inv.items.map((it) => {
                const d = delivered(it);
                const bad = d < 0 || d > it.qty;
                return (
                  <div key={it.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {it.name}
                        {it.bonus && <span className="chip ml-2">Bonus</span>}
                      </p>
                      <p className={`text-xs ${bad ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                        {bad ? 'More than invoiced' : `Invoiced ${ctn(it.qty, it.perCarton)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={qtys[it.id]?.c ?? ''}
                        onChange={(e) => setQty(it.id, 'c', e.target.value)}
                        aria-label="Delivered cartons"
                        className="field w-16 px-2 py-2 text-center"
                      />
                      <span className="text-[11px] text-slate-400">ctn</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={qtys[it.id]?.p ?? ''}
                        onChange={(e) => setQty(it.id, 'p', e.target.value)}
                        aria-label="Delivered pieces"
                        className="field w-16 px-2 py-2 text-center"
                      />
                      <span className="text-[11px] text-slate-400">pcs</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[11px] text-slate-500">Invoice</p>
                <p className="text-sm font-semibold text-slate-900">{rs(inv.total)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[11px] text-slate-500">Returns</p>
                <p className={`text-sm font-semibold ${returned > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {rs(returned)}
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-2.5">
                <p className="text-[11px] text-indigo-600">Delivered</p>
                <p className="text-sm font-bold text-indigo-900">{rs(dueNow)}</p>
              </div>
            </div>

            <div>
              <label className="label">Cash collected from this shop</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={paid[inv.id] ?? ''}
                  onChange={(e) => setPaid((s) => ({ ...s, [inv.id]: e.target.value }))}
                  className="field"
                  placeholder="0"
                />
                <button
                  onClick={() => setPaid((s) => ({ ...s, [inv.id]: String(dueNow) }))}
                  className="shrink-0 rounded-xl bg-indigo-50 px-3 text-xs font-semibold text-indigo-700"
                >
                  Full
                </button>
              </div>

              {rec > 0 ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Smartphone size={13} />
                  Delivery man recorded {rs(rec)}
                  {edited && <span className="font-medium text-amber-700">· you changed it to {rs(p)}</span>}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">Delivery man recorded nothing for this bill</p>
              )}

              {overReturns && (
                <div className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                 <p>
                    He recorded {rs(rec - dueNow)} more than this bill ({rs(dueNow)} after returns). If the shop
                    paid part of its old balance, this is correct and it reduces the old balance. Otherwise check
                    the returned quantities.
                  </p>
                </div>
              )}

              <p className="mt-1.5 text-xs text-slate-500">
                Shop balance after this trip: <span className="font-semibold text-slate-900">{rs(after)}</span>
                {p > dueNow && ' (extra payment reduces the old balance)'}
              </p>
            </div>
          </div>
        );
      })}

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Cash expected</span>
          <span className="text-lg font-bold text-slate-900">{rs(expected)}</span>
        </div>

        <div>
          <label className="label">Cash handed in by delivery man</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={handedValue}
            onChange={(e) => setHanded(e.target.value)}
            className="field"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Starts equal to expected. Type the cash you actually counted.
          </p>
        </div>

        <div
          className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${
            diff === 0
              ? 'bg-emerald-50 text-emerald-700'
              : diff < 0
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          <span>{diff === 0 ? 'Cash matches' : diff < 0 ? 'Cash short' : 'Cash extra'}</span>
          <span>{diff === 0 ? rs(0) : rs(Math.abs(diff))}</span>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field"
            placeholder="e.g. Shop closed, will pay tomorrow"
          />
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button onClick={onSubmit} disabled={pending} className="btn-primary w-full disabled:opacity-60">
          {pending ? 'Settling...' : 'Settle trip'}
        </button>
      </div>
    </div>
  );
}