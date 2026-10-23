'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Plus, Trash2 } from 'lucide-react';
import { rs } from '@/lib/format';

type Opt = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  pcsPerCarton: number;
  lastCostCarton: number | null;
  lastOn: string | null;
  lastSupplier: string | null;
};
type Line = {
  key: number;
  productId: string;
  cartons: string;
  pcs: string;
  free: string;
  costCarton: string;
  batch: string;
  expiry: string;
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const blank = (key: number): Line => ({
  key,
  productId: '',
  cartons: '',
  pcs: '',
  free: '',
  costCarton: '',
  batch: '',
  expiry: '',
});

export default function ReceiveForm({
  warehouses,
  suppliers,
  products,
  today,
  submit,
}: {
  warehouses: Opt[];
  suppliers: Opt[];
  products: Product[];
  today: string;
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
}) {
  const router = useRouter();
  const [grnId] = useState(uid);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [receivedOn, setReceivedOn] = useState(today);
  const [lines, setLines] = useState<Line[]>([blank(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const computed = lines.map((l) => {
    const p = prodMap.get(l.productId);
    const ppc = p?.pcsPerCarton || 1;
    const paidQty = p ? (Number(l.cartons) || 0) * ppc + (Number(l.pcs) || 0) : 0;
    const freeQty = p ? (Number(l.free) || 0) * ppc : 0;
    const qty = paidQty + freeQty;
    const paidAmount = p ? paidQty * ((Number(l.costCarton) || 0) / ppc) : 0;
    // effective cost: what you paid, spread over everything that arrived
    const costPcs = qty > 0 ? paidAmount / qty : 0;
    return { ...l, p, ppc, paidQty, freeQty, qty, paidAmount, costPcs };
  });

  const total = computed.reduce((s, c) => s + c.paidAmount, 0);

  const patch = (key: number, data: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...data } : l)));

  const addLine = () => {
    setLines((ls) => [...ls, blank(nextKey)]);
    setNextKey((k) => k + 1);
  };

  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  function onSubmit() {
    setError('');
    if (!warehouseId) return setError('No warehouse found. Run the warehouse SQL first.');

    const used = computed.filter((c) => c.p && c.qty > 0);
    if (!used.length) return setError('Add at least one product with a quantity');
    if (used.some((c) => c.freeQty > 0 && c.paidQty === 0)) {
      return setError('Free cartons need paid cartons on the same line. Enter the paid quantity and cost too.');
    }
    if (used.some((c) => c.freeQty > 0 && !(Number(c.costCarton) > 0))) {
      return setError('Enter the cost per carton for lines that have free cartons');
    }
    if (used.some((c) => c.expiry && c.expiry < receivedOn)) {
      return setError('An expiry date is before the received date');
    }

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: grnId,
          warehouse_id: warehouseId,
          supplier_id: supplierId,
          invoice_ref: invoiceRef,
          received_on: receivedOn,
          items: used.map((c) => ({
            product_id: c.p!.id,
            qty_pcs: c.qty,
            cost_per_pcs: Number(c.costPcs.toFixed(4)),
            batch_no: c.batch,
            expiry_date: c.expiry || null,
          })),
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else router.push('/products');
    });
  }

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 gap-3 p-4">
        {warehouses.length > 1 && (
          <div className="col-span-2">
            <label className="label">Warehouse</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Supplier / company</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="field">
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Supplier bill no.</label>
          <input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} className="field" placeholder="Optional" />
        </div>
        <div>
          <label className="label">Received on</label>
          <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className="field" />
        </div>
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

          <select value={c.productId} onChange={(e) => patch(c.key, { productId: e.target.value })} className="field">
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {c.p && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {c.p.lastCostCarton ? (
                <>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    Last cost {rs(c.p.lastCostCarton)} / carton
                    {c.p.lastOn ? ` · ${c.p.lastOn}` : ''}
                    {c.p.lastSupplier ? ` · ${c.p.lastSupplier}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => patch(c.key, { costCarton: String(c.p!.lastCostCarton) })}
                    className="rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700"
                  >
                    Use this cost
                  </button>
                  {Number(c.costCarton) > 0 && Math.abs(Number(c.costCarton) - c.p.lastCostCarton) >= 0.01 && (
                    <span
                      className={`font-semibold ${
                        Number(c.costCarton) > c.p.lastCostCarton ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {Number(c.costCarton) > c.p.lastCostCarton ? 'Up ' : 'Down '}
                      {rs(Math.abs(Number(c.costCarton) - c.p.lastCostCarton))} per carton
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  No purchase cost yet for this product
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Paid cartons</label>
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
            <div>
              <label className="label">Cost / carton</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={c.costCarton}
                onChange={(e) => patch(c.key, { costCarton: e.target.value })}
                className="field"
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <label className="label flex items-center gap-1.5 text-emerald-800">
              <Gift size={14} />
              Free cartons from supplier scheme
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={c.free}
              onChange={(e) => patch(c.key, { free: e.target.value })}
              className="field"
              placeholder="0 (e.g. 1 for a 10+1 scheme)"
            />
            <p className="mt-1.5 text-[11px] text-emerald-700">
              Goes into stock, but you do not pay for it. The cost per carton drops to match.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Batch no.</label>
              <input
                value={c.batch}
                onChange={(e) => patch(c.key, { batch: e.target.value })}
                className="field"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Expiry date</label>
              <input
                type="date"
                value={c.expiry}
                onChange={(e) => patch(c.key, { expiry: e.target.value })}
                className="field"
              />
            </div>
          </div>

          {c.p && c.qty > 0 && (
            <div className="space-y-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-indigo-700">
                  {c.paidQty} paid{c.freeQty > 0 ? ` + ${c.freeQty} free` : ''} = {c.qty} pcs into stock
                </span>
                <span className="font-bold text-indigo-900">{rs(c.paidAmount)}</span>
              </div>
              {c.freeQty > 0 && (
                <p className="text-xs text-indigo-700">
                  Real cost {rs(c.costPcs * c.ppc)} per carton (listed {rs(Number(c.costCarton) || 0)})
                </p>
              )}
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
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Total to pay (free cartons excluded)</span>
          <span className="text-2xl font-bold text-slate-900">{rs(total)}</span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>
        )}

        <button onClick={onSubmit} disabled={pending} className="btn-primary w-full disabled:opacity-60">
          {pending ? 'Saving...' : 'Receive stock'}
        </button>
      </div>
    </div>
  );
}