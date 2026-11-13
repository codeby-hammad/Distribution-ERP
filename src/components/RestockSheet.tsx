'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertTriangle, PackagePlus, Tag, X } from 'lucide-react';
import { rs } from '@/lib/format';

type Opt = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  pcs: number;
  costCtn: number | null;
  suggestCtn: number;
  companyId: string | null;
  saleCtn?: number | null;
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function RestockSheet({
  product,
  warehouses,
  suppliers,
  today,
  submit,
  highlight = false,
  compact = false,
}: {
  product: Product;
  warehouses: Opt[];
  suppliers: Opt[];
  today: string;
  submit: (payload: string) => Promise<{ ok?: boolean; error?: string }>;
  highlight?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grnId, setGrnId] = useState('');
  const [cartons, setCartons] = useState('');
  const [loose, setLoose] = useState('');
  const [cost, setCost] = useState('');
  const [batch, setBatch] = useState('');
  const [expiry, setExpiry] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [bill, setBill] = useState('');
  const [receivedOn, setReceivedOn] = useState(today);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function openSheet() {
    setGrnId(uid());
    setCartons(product.suggestCtn > 0 ? String(product.suggestCtn) : '');
    setLoose('');
    setCost(product.costCtn != null ? String(product.costCtn) : '');
    setBatch('');
    setExpiry('');
    setSupplierId(suppliers.some((s) => s.id === product.companyId) ? (product.companyId as string) : '');
    setBill('');
    setReceivedOn(today);
    setWarehouseId(warehouses[0]?.id ?? '');
    setError('');
    setOpen(true);
  }

  const qty = (Number(cartons) || 0) * product.pcs + (Number(loose) || 0);
  const costPcs = product.pcs > 0 ? (Number(cost) || 0) / product.pcs : 0;
  const total = qty * costPcs;

  // Sale price is display only. It is set on the product page and never changed here.
  const saleCtn = product.saleCtn != null && product.saleCtn > 0 ? product.saleCtn : null;
  const costCtnNum = Number(cost) || 0;
  const profitCtn = saleCtn != null && cost !== '' ? saleCtn - costCtnNum : null;
  const marginPct = profitCtn != null && saleCtn ? (profitCtn / saleCtn) * 100 : null;

  function onSubmit() {
    setError('');
    if (!warehouseId) return setError('No warehouse found');
    if (!(qty > 0)) return setError('Enter the quantity received');
    if (cost === '' || Number(cost) < 0) return setError('Enter the cost per carton');
    if (expiry && expiry < receivedOn) return setError('Expiry date is before the received date');

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: grnId,
          warehouse_id: warehouseId,
          supplier_id: supplierId,
          invoice_ref: bill,
          received_on: receivedOn,
          items: [
            {
              product_id: product.id,
              qty_pcs: qty,
              cost_per_pcs: Math.round(costPcs * 10000) / 10000,
              batch_no: batch,
              expiry_date: expiry || null,
            },
          ],
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  const trigger = compact
    ? 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition '
    : 'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ';

  return (
    <>
      <button
        onClick={openSheet}
        className={
          trigger +
          (highlight
            ? 'hero text-white shadow-md shadow-indigo-500/25'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100')
        }
      >
        <PackagePlus size={compact ? 14 : 16} />
        Restock
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div
              className="backdrop-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div
              className="sheet-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-lg md:rounded-3xl"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">Restock</h2>
                  <p className="truncate text-sm text-slate-500">
                    {product.name} · {product.pcs} pcs/carton
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              {product.suggestCtn > 0 && (
                <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Suggested: {product.suggestCtn} cartons to reach twice your low stock alert.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cartons received</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={cartons}
                    onChange={(e) => setCartons(e.target.value)}
                    className="field text-lg font-semibold"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Loose pcs</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={loose}
                    onChange={(e) => setLoose(e.target.value)}
                    className="field text-lg font-semibold"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="label">Purchase cost per carton (Rs)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Sale price per carton</label>
                  <div
                    className="field flex items-center gap-2 bg-slate-50 font-semibold text-slate-700"
                    aria-readonly="true"
                    title="Set on the product page"
                  >
                    <Tag size={15} className="shrink-0 text-slate-400" />
                    {saleCtn != null ? rs(saleCtn) : <span className="font-normal text-slate-400">Not set</span>}
                  </div>
                </div>

                {profitCtn != null && (
                  <div
                    className={`col-span-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                      profitCtn < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span>
                      {profitCtn < 0 ? 'Loss per carton at this cost' : 'Profit per carton at this cost'}
                    </span>
                    <span>
                      {rs(Math.abs(profitCtn))}
                      {marginPct != null && ` (${marginPct.toFixed(1)}%)`}
                    </span>
                  </div>
                )}

                <div>
                  <label className="label">Batch no. (optional)</label>
                  <input value={batch} onChange={(e) => setBatch(e.target.value)} className="field" />
                </div>
                <div>
                  <label className="label">Expiry date</label>
                  <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="field" />
                </div>

                <div>
                  <label className="label">Supplier</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="field">
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Supplier bill no.</label>
                  <input value={bill} onChange={(e) => setBill(e.target.value)} className="field" />
                </div>

                <div className={warehouses.length > 1 ? '' : 'col-span-2'}>
                  <label className="label">Received on</label>
                  <input
                    type="date"
                    value={receivedOn}
                    onChange={(e) => setReceivedOn(e.target.value)}
                    className="field"
                  />
                </div>
                {warehouses.length > 1 && (
                  <div>
                    <label className="label">Warehouse</label>
                    <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field">
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {qty > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm">
                  <span className="text-indigo-700">
                    {qty} pcs @ {rs(costPcs)}
                  </span>
                  <span className="font-bold text-indigo-900">{rs(total)}</span>
                </div>
              )}

              {error && (
                <div className="mt-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button onClick={onSubmit} disabled={pending} className="btn-primary mt-4 w-full disabled:opacity-60">
                {pending ? 'Saving...' : 'Receive stock'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}