'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { rs } from '@/lib/format';

type Opt = { id: string; name: string };
type InvLine = { itemId: string; productId: string; name: string; perCarton: number; remaining: number; rate: number };
type Prod = { id: string; name: string; perCarton: number; rate: number };
type Row = {
  key: number;
  itemId: string;
  productId: string;
  ctn: string;
  pcs: string;
  condition: 'resaleable' | 'damaged' | 'expired';
  mode: 'credit' | 'replace';
  batch: string;
  expiry: string;
};

const REASONS = ['Expired', 'Damaged', 'Wrong item', 'Shop refused', 'Other'];

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function ReturnForm({
  shopId,
  invoiceId,
  warehouses,
  lines,
  products,
  submit,
}: {
  shopId: string;
  invoiceId: string | null;
  warehouses: Opt[];
  lines: InvLine[];
  products: Prod[];
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
}) {
  const router = useRouter();
  const [returnId] = useState(uid);
  const invoiceMode = !!invoiceId;
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [reason, setReason] = useState('Expired');
  const [note, setNote] = useState('');
  const [nextKey, setNextKey] = useState(lines.length || 1);
  const blank = (key: number, l?: InvLine): Row => ({
    key,
    itemId: l?.itemId ?? '',
    productId: l?.productId ?? '',
    ctn: '',
    pcs: '',
    condition: 'resaleable',
    mode: 'credit',
    batch: '',
    expiry: '',
  });
  const [rows, setRows] = useState<Row[]>(() => (invoiceMode ? lines.map((l, i) => blank(i, l)) : [blank(0)]));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const lineMap = useMemo(() => new Map(lines.map((l) => [l.itemId, l])), [lines]);
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const calc = rows.map((r) => {
    const l = invoiceMode ? lineMap.get(r.itemId) : undefined;
    const p = invoiceMode ? undefined : prodMap.get(r.productId);
    const ppc = (l?.perCarton ?? p?.perCarton) || 1;
    const rate = l?.rate ?? p?.rate ?? 0;
    const qty = (Number(r.ctn) || 0) * ppc + (Number(r.pcs) || 0);
    const over = l ? qty > l.remaining : false;
    const mode: Row['mode'] = r.condition === 'resaleable' ? 'credit' : r.mode;
    return { ...r, mode, l, p, ppc, rate, qty, over, amount: Math.round(qty * rate * 100) / 100 };
  });

  const total = calc.reduce((s, c) => s + (c.mode === 'replace' ? 0 : c.amount), 0);
  const replaceTotal = calc.reduce((s, c) => s + (c.mode === 'replace' ? c.amount : 0), 0);
  const patch = (key: number, d: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...d } : r)));

  function onSubmit() {
    setError('');
    const used = calc.filter((c) => c.qty > 0 && (invoiceMode ? c.l : c.p));
    if (!used.length) return setError('Enter a quantity for at least one item');
    if (used.some((c) => c.over)) return setError('A quantity is more than can be returned. Fix the lines in red');
    if (used.some((c) => (c.condition === 'resaleable' || c.mode === 'replace') && !warehouseId)) {
      return setError('Choose a warehouse');
    }

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: returnId,
          shop_id: shopId,
          invoice_id: invoiceId,
          warehouse_id: warehouseId || null,
          reason,
          note: note.trim(),
          items: used.map((c) => ({
            invoice_item_id: invoiceMode ? c.itemId : null,
            product_id: invoiceMode ? c.l!.productId : c.p!.id,
            qty_pcs: c.qty,
            condition: c.condition,
            mode: c.mode,
            batch_no: c.batch,
            expiry_date: c.expiry || null,
          })),
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else router.push(`/returns/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {invoiceMode && lines.length === 0 && (
        <p className="card p-4 text-sm text-slate-500">Everything on this invoice has already been returned or was not delivered.</p>
      )}

      {calc.map((c) => (
        <div key={c.key} className={`card space-y-3 p-4 ${c.over ? 'ring-2 ring-red-300' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {invoiceMode ? (
                <>
                  <p className="font-semibold text-slate-900">{c.l?.name}</p>
                  <p className={`text-xs ${c.over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                    Can return up to {c.l?.remaining} pcs · credit {rs(c.rate)} per pc
                  </p>
                </>
              ) : (
                <select value={c.productId} onChange={(e) => patch(c.key, { productId: e.target.value })} className="field">
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!invoiceMode && rows.length > 1 && (
              <button
                onClick={() => setRows((l) => l.filter((r) => r.key !== c.key))}
                aria-label="Remove item"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Cartons</label>
              <input type="number" inputMode="numeric" min={0} value={c.ctn} onChange={(e) => patch(c.key, { ctn: e.target.value })} className="field" placeholder="0" />
            </div>
            <div>
              <label className="label">Loose pcs</label>
              <input type="number" inputMode="numeric" min={0} value={c.pcs} onChange={(e) => patch(c.key, { pcs: e.target.value })} className="field" placeholder="0" />
            </div>
            <div>
              <label className="label">Condition</label>
              <select value={c.condition} onChange={(e) => patch(c.key, { condition: e.target.value as Row['condition'] })} className="field">
                <option value="resaleable">Resaleable</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="label">Outcome</label>
              <select
                value={c.mode}
                disabled={c.condition === 'resaleable'}
                onChange={(e) => patch(c.key, { mode: e.target.value as Row['mode'] })}
                className="field"
              >
                <option value="credit">Credit</option>
                <option value="replace">Replace (same item)</option>
              </select>
            </div>
          </div>

          {c.condition === 'resaleable' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Batch no.</label>
                <input value={c.batch} onChange={(e) => patch(c.key, { batch: e.target.value })} className="field" placeholder="Optional" />
              </div>
              <div>
                <label className="label">Expiry date</label>
                <input type="date" value={c.expiry} onChange={(e) => patch(c.key, { expiry: e.target.value })} className="field" />
              </div>
            </div>
          )}

          {c.qty > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm">
              <span className="text-indigo-700">
                {c.qty} pcs ·{' '}
                {c.condition === 'resaleable'
                  ? 'back into stock'
                  : c.mode === 'replace'
                    ? 'replaced with fresh stock, bad goods held for claim'
                    : 'not restocked, held for claim'}
              </span>
              <span className="font-bold text-indigo-900">{c.mode === 'replace' ? `Swap ${rs(c.amount)}` : `- ${rs(c.amount)}`}</span>
            </div>
          )}
        </div>
      ))}

      {!invoiceMode && (
        <button
          onClick={() => {
            setRows((l) => [...l, blank(nextKey)]);
            setNextKey((k) => k + 1);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Plus size={18} />
          Add another product
        </button>
      )}

      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="field">
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Warehouse (restock or replacement)</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="e.g. Picked up by delivery van" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Credit to the shop</span>
          <span className="text-2xl font-bold text-red-600">- {rs(total)}</span>
        </div>
        {replaceTotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Replaced with fresh stock (balance unchanged)</span>
            <span className="font-semibold text-indigo-700">{rs(replaceTotal)}</span>
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

        <button
          onClick={() => {
            if (window.confirm(`Create this note? Credit ${rs(total)}${replaceTotal > 0 ? `, replacement ${rs(replaceTotal)}` : ''}. It cannot be edited afterwards.`)) onSubmit();
          }}
          disabled={pending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Create note'}
        </button>
      </div>
    </div>
  );
}