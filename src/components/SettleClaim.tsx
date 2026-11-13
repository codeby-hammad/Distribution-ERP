'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Plus, Trash2, Wallet } from 'lucide-react';
import { rs } from '@/lib/format';

type Item = { productId: string; name: string; qty: number; pcs: number; unitCost: number };
type Prod = { id: string; name: string; pcs: number };
type Line = {
  key: number;
  kind: 'stock' | 'credit';
  productId: string;
  cartons: string;
  costCtn: string;
  batch: string;
  expiry: string;
  amount: string;
};

export default function SettleClaim({
  claimId,
  sentValue,
  items,
  products,
  submit,
}: {
  claimId: string;
  sentValue: number;
  items: Item[];
  products: Prod[];
  submit: (payload: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  let seq = lines.reduce((m, l) => Math.max(m, l.key), 0);
  const blank = (): Line => ({ key: ++seq, kind: 'stock', productId: products[0]?.id ?? '', cartons: '', costCtn: '', batch: '', expiry: '', amount: '' });

  function sameProducts() {
    setLines(
      items.map((i) => ({
        key: ++seq,
        kind: 'stock',
        productId: i.productId,
        cartons: String(Math.round((i.qty / (i.pcs || 1)) * 100) / 100),
        costCtn: String(Math.round(i.unitCost * i.pcs * 100) / 100),
        batch: '',
        expiry: '',
        amount: '',
      }))
    );
  }

  const upd = (k: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  const recovered = lines.reduce((s, l) => {
    if (l.kind === 'credit') return s + (Number(l.amount) || 0);
    return s + (Number(l.cartons) || 0) * (Number(l.costCtn) || 0);
  }, 0);
  const loss = Math.max(sentValue - recovered, 0);

  function save() {
    setError('');
    const out = lines.map((l) => {
      if (l.kind === 'credit') return { kind: 'credit', amount: Number(l.amount) || 0 };
      const pcs = pmap.get(l.productId)?.pcs ?? 1;
      const qty = Math.round((Number(l.cartons) || 0) * pcs);
      return {
        kind: 'stock',
        product_id: l.productId,
        qty_pcs: qty,
        cost_per_pcs: Math.round(((Number(l.costCtn) || 0) / pcs) * 10000) / 10000,
        batch_no: l.batch || null,
        expiry_date: l.expiry || null,
      };
    });
    start(async () => {
      const res = await submit(JSON.stringify({ claim_id: claimId, note, lines: out }));
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full">
        Company replied: record result
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={sameProducts} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
          Same products received
        </button>
        <button type="button" onClick={() => setLines((l) => [...l, blank()])} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          <Plus size={14} /> Other product
        </button>
        <button type="button" onClick={() => setLines((l) => [...l, { ...blank(), kind: 'credit' }])} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          <Wallet size={14} /> Credit amount
        </button>
      </div>

      {lines.map((l) => (
        <div key={l.key} className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          {l.kind === 'credit' ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Credit / adjustment (Rs)</label>
                <input type="number" inputMode="decimal" min={0} value={l.amount} onChange={(e) => upd(l.key, { amount: e.target.value })} className="field" />
              </div>
              <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove" className="pb-3 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="label flex items-center gap-1"><Gift size={12} /> Product received</label>
                  <select value={l.productId} onChange={(e) => upd(l.key, { productId: e.target.value })} className="field">
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove" className="pb-3 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Cartons</label>
                  <input type="number" inputMode="decimal" min={0} step="any" value={l.cartons} onChange={(e) => upd(l.key, { cartons: e.target.value })} className="field" />
                </div>
                <div>
                  <label className="label">Value per carton (Rs)</label>
                  <input type="number" inputMode="decimal" min={0} step="any" value={l.costCtn} onChange={(e) => upd(l.key, { costCtn: e.target.value })} className="field" />
                </div>
                <div>
                  <label className="label">Batch (optional)</label>
                  <input value={l.batch} onChange={(e) => upd(l.key, { batch: e.target.value })} className="field" />
                </div>
                <div>
                  <label className="label">Expiry date</label>
                  <input type="date" value={l.expiry} onChange={(e) => upd(l.key, { expiry: e.target.value })} className="field" />
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. company bill no.)" className="field text-sm" />

      <div className="space-y-1 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
        <div className="flex justify-between"><span className="text-slate-500">Sent to company</span><b>{rs(sentValue)}</b></div>
        <div className="flex justify-between"><span className="text-slate-500">Received back (stock + credit)</span><b className="text-emerald-700">{rs(recovered)}</b></div>
        <div className="flex justify-between border-t pt-1"><span className="text-slate-500">Loss</span><b className={loss > 0 ? 'text-red-600' : 'text-emerald-700'}>{rs(loss)}</b></div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" onClick={save} disabled={pending} className="btn-primary flex-1 disabled:opacity-60">
          {pending ? 'Saving...' : lines.length ? 'Settle claim' : 'Settle: nothing returned (full loss)'}
        </button>
      </div>
    </div>
  );
}