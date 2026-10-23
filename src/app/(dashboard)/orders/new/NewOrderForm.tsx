'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { rs } from '@/lib/format';

type Shop = { id: string; name: string; creditLimit: number; outstanding: number };
type Product = { id: string; name: string; pcsPerCarton: number; price: number };
type Line = { key: number; productId: string; cartons: string; pcs: string };

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });


export default function NewOrderForm({
  shops,
  products,
  submit,
  initialShopId,
}: {
  shops: Shop[];
  products: Product[];
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
  initialShopId?: string;
}) {
  const router = useRouter();
  const [orderId] = useState(uid);
    const [shopId, setShopId] = useState(initialShopId ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [nextKey, setNextKey] = useState(1);
  const [lines, setLines] = useState<Line[]>([{ key: 0, productId: '', cartons: '', pcs: '' }]);
  const [pending, start] = useTransition();

  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const computed = lines.map((l) => {
    const p = prodMap.get(l.productId);
    const qty = p ? (Number(l.cartons) || 0) * p.pcsPerCarton + (Number(l.pcs) || 0) : 0;
    return { ...l, p, qty, amount: p ? qty * p.price : 0 };
  });

  const total = computed.reduce((s, c) => s + c.amount, 0);
  const shop = shops.find((s) => s.id === shopId);
  const overLimit = !!shop && shop.creditLimit > 0 && shop.outstanding + total > shop.creditLimit;

  const patch = (key: number, data: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...data } : l)));

  const addLine = () => {
    setLines((ls) => [...ls, { key: nextKey, productId: '', cartons: '', pcs: '' }]);
    setNextKey((k) => k + 1);
  };

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  function onSubmit() {
    setError('');
    if (!shopId) return setError('Select a shop first');

    const items = computed
      .filter((c) => c.p && c.qty > 0)
      .map((c) => ({ product_id: c.p!.id, qty_pcs: c.qty, rate: c.p!.price, is_bonus: false }));
    if (!items.length) return setError('Add at least one product with a quantity');

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: orderId,
          shop_id: shopId,
          notes: notes.trim(),
          booked_at: new Date().toISOString(),
          items,
        })
      );
      if (res.error) setError(res.error);
      else router.push(`/orders/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div>
          <label className="label">Shop</label>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="field">
            <option value="">Select a shop</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {shop && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Outstanding</p>
              <p className="text-sm font-semibold text-slate-900">{rs(shop.outstanding)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Credit limit</p>
              <p className="text-sm font-semibold text-slate-900">
                {shop.creditLimit > 0 ? rs(shop.creditLimit) : 'No limit set'}
              </p>
            </div>
          </div>
        )}
      </div>

      {computed.map((c, i) => (
        <div key={c.key} className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">ITEM {i + 1}</p>
            {lines.length > 1 && (
              <button
                onClick={() => removeLine(c.key)}
                aria-label="Remove item"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <select
            value={c.productId}
            onChange={(e) => patch(c.key, { productId: e.target.value })}
            className="field"
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cartons</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={c.cartons}
                onChange={(e) => patch(c.key, { cartons: e.target.value })}
                className="field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Loose pcs</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={c.pcs}
                onChange={(e) => patch(c.key, { pcs: e.target.value })}
                className="field"
                placeholder="0"
              />
            </div>
          </div>

          {c.p && (
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm">
              <span className="text-indigo-700">
                {c.qty} pcs @ {rs(c.p.price)}
              </span>
              <span className="font-bold text-indigo-900">{rs(c.amount)}</span>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addLine}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
      >
        <Plus size={18} />
        Add another product
      </button>

      <div className="card space-y-3 p-4">
        <div>
          <label className="label">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field"
            placeholder="e.g. Deliver before Friday"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Order total</span>
          <span className="text-2xl font-bold text-slate-900">{rs(total)}</span>
        </div>

        {overLimit && shop && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              This order takes the shop to {rs(shop.outstanding + total)}, above its limit of{' '}
              {rs(shop.creditLimit)}. A manager must approve it.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        <button onClick={onSubmit} disabled={pending} className="btn-primary w-full disabled:opacity-60">
          {pending ? 'Submitting...' : 'Submit order'}
        </button>
      </div>
    </div>
  );
}