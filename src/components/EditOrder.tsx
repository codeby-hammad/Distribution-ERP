'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { rs } from '@/lib/format';

type Line = { id: string; name: string; perCarton: number; rate: number; qty: number };
type Prod = { id: string; name: string; perCarton: number; rate: number };
type Row = { id: string; ctn: string; pcs: string; removed: boolean };
type Add = { key: number; productId: string; ctn: string; pcs: string };

export default function EditOrder({
  orderId,
  discount,
  lines,
  products,
  submit,
}: {
  orderId: string;
  discount: number;
  lines: Line[];
  products: Prod[];
  submit: (orderId: string, payload: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    lines.map((l) => ({
      id: l.id,
      ctn: String(Math.floor(l.qty / l.perCarton)),
      pcs: String(l.qty % l.perCarton),
      removed: false,
    }))
  );
  const [adds, setAdds] = useState<Add[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const prodMap = new Map(products.map((p) => [p.id, p]));

  const qtyOf = (r: Row) => {
    const l = lineMap.get(r.id)!;
    return r.removed ? 0 : (Number(r.ctn) || 0) * l.perCarton + (Number(r.pcs) || 0);
  };
  const addQty = (a: Add) => {
    const p = prodMap.get(a.productId);
    return p ? (Number(a.ctn) || 0) * p.perCarton + (Number(a.pcs) || 0) : 0;
  };

  const subtotal =
    rows.reduce((s, r) => s + qtyOf(r) * lineMap.get(r.id)!.rate, 0) +
    adds.reduce((s, a) => s + addQty(a) * (prodMap.get(a.productId)?.rate ?? 0), 0);
  const total = Math.max(subtotal - discount, 0);

  const patch = (id: string, d: Partial<Row>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...d } : r)));
  const patchAdd = (key: number, d: Partial<Add>) => setAdds((l) => l.map((a) => (a.key === key ? { ...a, ...d } : a)));

  function onSave() {
    setError('');
    setSaved(false);
    const addList = adds.filter((a) => a.productId && addQty(a) > 0);
    const kept = rows.filter((r) => qtyOf(r) > 0).length + addList.length;
    if (kept === 0) return setError('The order would be empty. Reject it instead.');

    start(async () => {
      const res = await submit(
        orderId,
        JSON.stringify({
          items: rows.map((r) => ({ id: r.id, qty_pcs: qtyOf(r) })),
          add: addList.map((a) => ({ product_id: a.productId, qty_pcs: addQty(a) })),
        })
      );
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <details className="card p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
        <Pencil size={16} className="text-indigo-600" />
        Edit this order before approving
      </summary>

      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const l = lineMap.get(r.id)!;
          const q = qtyOf(r);
          return (
            <div key={r.id} className={`rounded-xl bg-slate-50 p-3 ${r.removed ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`min-w-0 flex-1 truncate font-semibold text-slate-900 ${r.removed ? 'line-through' : ''}`}>{l.name}</p>
                <button
                  type="button"
                  onClick={() => patch(r.id, { removed: !r.removed })}
                  aria-label={r.removed ? 'Undo remove' : 'Remove line'}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
                >
                  {r.removed ? <Undo2 size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
              {!r.removed && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min={0} inputMode="numeric" value={r.ctn} onChange={(e) => patch(r.id, { ctn: e.target.value })} className="field w-20 px-2 py-2 text-center" aria-label="Cartons" />
                  <span className="text-[11px] text-slate-400">ctn</span>
                  <input type="number" min={0} inputMode="numeric" value={r.pcs} onChange={(e) => patch(r.id, { pcs: e.target.value })} className="field w-20 px-2 py-2 text-center" aria-label="Pieces" />
                  <span className="text-[11px] text-slate-400">pcs</span>
                  <span className="ml-auto text-sm font-semibold text-slate-900">{rs(q * l.rate)}</span>
                </div>
              )}
            </div>
          );
        })}

        {adds.map((a) => {
          const p = prodMap.get(a.productId);
          return (
            <div key={a.key} className="space-y-2 rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100">
              <div className="flex gap-2">
                <select value={a.productId} onChange={(e) => patchAdd(a.key, { productId: e.target.value })} className="field py-2">
                  <option value="">Select a product to add</option>
                  {products
                    .filter((x) => x.id === a.productId || !adds.some((o) => o.productId === x.id))
                    .map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                </select>
                <button type="button" onClick={() => setAdds((l) => l.filter((o) => o.key !== a.key))} aria-label="Remove added product" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              {p && (
                <div className="flex items-center gap-2">
                  <input type="number" min={0} inputMode="numeric" value={a.ctn} onChange={(e) => patchAdd(a.key, { ctn: e.target.value })} className="field w-20 px-2 py-2 text-center" aria-label="Cartons" />
                  <span className="text-[11px] text-slate-400">ctn</span>
                  <input type="number" min={0} inputMode="numeric" value={a.pcs} onChange={(e) => patchAdd(a.key, { pcs: e.target.value })} className="field w-20 px-2 py-2 text-center" aria-label="Pieces" />
                  <span className="text-[11px] text-slate-400">pcs</span>
                  <span className="ml-auto text-sm font-semibold text-slate-900">{rs(addQty(a) * p.rate)}</span>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setAdds((l) => [...l, { key: nextKey, productId: '', ctn: '', pcs: '' }]);
            setNextKey((k) => k + 1);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Plus size={16} />
          Add a product
        </button>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm text-slate-500">New total (before schemes)</span>
          <span className="text-lg font-bold text-slate-900">{rs(total)}</span>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
        {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Order updated.</p>}

        <button type="button" onClick={onSave} disabled={pending} className="btn-primary w-full disabled:opacity-60">
          {pending ? 'Saving...' : 'Save changes'}
        </button>
        <p className="text-xs text-slate-500">
          Prices are refreshed from the price list. Schemes and the credit check are applied when you approve.
        </p>
      </div>
    </details>
  );
}