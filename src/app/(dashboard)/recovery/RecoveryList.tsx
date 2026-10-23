'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Phone, Search, X } from 'lucide-react';
import { rs } from '@/lib/format';
import { createPortal } from 'react-dom';

type Shop = {
  id: string;
  name: string;
  owner: string | null;
  phone: string | null;
  route: string | null;
  balance: number;
};
type Result = { id?: string; receiptNo?: number; error?: string };

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function RecoveryList({
  shops,
  collect,
  initialQuery,
}: {
  shops: Shop[];
  collect: (payload: string) => Promise<Result>;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery ?? '');
  const [route, setRoute] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<Shop | null>(null);
  const [colId, setColId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'online'>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ id: string; amount: number } | null>(null);
  const [pending, start] = useTransition();

  const routes = useMemo(
    () => [...new Set(shops.map((s) => s.route).filter(Boolean) as string[])].sort(),
    [shops]
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return shops
      .filter(
        (s) =>
          (showAll || s.balance > 0) &&
          (!route || s.route === route) &&
          (!needle || `${s.name} ${s.owner ?? ''}`.toLowerCase().includes(needle))
      )
      .sort((a, b) => b.balance - a.balance);
  }, [shops, q, route, showAll]);

  const totalDue = list.reduce((s, x) => s + Math.max(x.balance, 0), 0);

  function open(s: Shop) {
    setSel(s);
    setColId(uid());
    setAmount('');
    setMethod('cash');
    setNote('');
    setError('');
    setDone(null);
  }

  function onSubmit() {
    if (!sel) return;
    setError('');
    const value = Number(amount);
    if (!(value > 0)) return setError('Enter the amount received');

    start(async () => {
      const res = await collect(
        JSON.stringify({ id: colId, shop_id: sel.id, amount: value, method, note: note.trim() })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else {
        setDone({ id: res.id!, amount: value });
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shop or owner"
            className="field pl-10"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {['', ...routes].map((r) => (
            <button
              key={r || 'all'}
              onClick={() => setRoute(r)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                route === r
                  ? 'hero text-white shadow-md shadow-indigo-500/25'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {r || 'All routes'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {list.length} shops · due <span className="font-bold text-red-600">{rs(totalDue)}</span>
          </span>
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="size-4 accent-indigo-600"
            />
            Show all shops
          </label>
        </div>

        {!list.length ? (
          <div className="card p-10 text-center text-sm text-slate-400">No shops with a balance.</div>
        ) : (
          list.map((s) => (
            <div key={s.id} className="card flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{s.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {s.owner ?? 'No owner name'}
                  {s.route ? ` · ${s.route}` : ''}
                </p>
                <p className={`mt-0.5 text-sm font-bold ${s.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {s.balance < 0 ? `Advance ${rs(-s.balance)}` : rs(s.balance)}
                </p>
              </div>
              {s.phone && (
                <a
                  href={`tel:${s.phone}`}
                  aria-label={`Call ${s.name}`}
                  className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"
                >
                  <Phone size={17} />
                </a>
              )}
              <button onClick={() => open(s)} className="btn-primary px-4 py-2.5">
                Collect
              </button>
            </div>
          ))
        )}
      </div>

      {sel && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div
            className="backdrop-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSel(null)}
          />
          <div
            className="sheet-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">{sel.name}</h2>
                <p className="text-xs text-slate-500">Balance {rs(sel.balance)}</p>
              </div>
              <button
                onClick={() => setSel(null)}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{rs(done.amount)} received</p>
                  <p className="text-sm text-slate-500">Payment recorded in the shop ledger.</p>
                </div>
                <Link href={`/recovery/receipt/${done.id}`} className="btn-primary w-full">
                  View and print receipt
                </Link>
                <button
                  onClick={() => setSel(null)}
                  className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Amount received (Rs)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="field text-lg font-semibold"
                      placeholder="0"
                      autoFocus
                    />
                    {sel.balance > 0 && (
                      <button
                        onClick={() => setAmount(String(sel.balance))}
                        className="shrink-0 rounded-xl bg-indigo-50 px-3 text-xs font-semibold text-indigo-700"
                      >
                        Full
                      </button>
                    )}
                  </div>
                  {Number(amount) > sel.balance && Number(amount) > 0 && (
                    <p className="mt-1.5 text-xs font-medium text-amber-600">
                      More than the balance owed. The extra will show as an advance.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'online'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`rounded-xl py-2.5 text-sm font-semibold capitalize transition ${
                        method === m ? 'hero text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m === 'online' ? 'Online / bank' : 'Cash'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="label">Note (optional)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="field"
                    placeholder="e.g. Part payment, rest next week"
                  />
                </div>

                {error && (
                  <div className="flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <button onClick={onSubmit} disabled={pending} className="btn-primary w-full disabled:opacity-60">
                  {pending ? 'Saving...' : 'Record payment'}
                </button>
              </div>
            )}
          </div>
      
              </div>,
        document.body
      )}
    </>
  );
}