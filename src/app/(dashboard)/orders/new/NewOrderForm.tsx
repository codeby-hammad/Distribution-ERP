'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Gift,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

export type Scheme = {
  id: string;
  name: string;
  scope: 'product' | 'company';
  productId: string | null;
  companyId: string | null;
  type: 'bonus' | 'percent' | 'flat';
  unit: 'ctn' | 'pcs';
  minQty: number;
  bonusQty: number;
  percent: number;
  flatPerCarton: number;
  validFrom: string;
  validTo: string;
};

type Shop = { id: string; name: string; creditLimit: number; outstanding: number };
type Product = { id: string; name: string; pcsPerCarton: number; price: number; companyId: string | null };
type Line = { productId: string; pcs: number };

type Props = {
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
  initialShopId: string | undefined;
  shops: Shop[];
  products: Product[];
  schemes: Scheme[];
  schemesFailed: boolean;
};

type LineCalc = {
  gross: number;
  discount: number;
  bonusPcs: number;
  schemeName: string | null;
  manualNote: string | null;
  hint: string | null;
};

const rs = (n: number) => 'Rs ' + Math.round(n || 0).toLocaleString('en-US');
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const num = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

function describe(s: Scheme): string {
  if (s.type === 'bonus') return `${fmt(s.bonusQty)} ${s.unit} free per ${fmt(s.minQty)} ${s.unit}`;
  if (s.type === 'percent') return `${fmt(s.percent)}% off`;
  return `${rs(s.flatPerCarton)} off per carton`;
}

export default function NewOrderForm({ submit, initialShopId, shops, products, schemes, schemesFailed }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // One id per order screen: a double click or retry cannot create two orders
  const orderId = useRef<string>(crypto.randomUUID());

  const [shopId, setShopId] = useState(initialShopId ?? '');
  const [shopQuery, setShopQuery] = useState('');
  const [shopOpen, setShopOpen] = useState(false);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);

  const shop = shops.find((s) => s.id === shopId) ?? null;
  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Pakistan date (UTC+5), same manual handling as the rest of the system
  const today = useMemo(() => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10), []);
  const activeSchemes = useMemo(
    () => schemes.filter((s) => s.validFrom.slice(0, 10) <= today && s.validTo.slice(0, 10) >= today),
    [schemes, today]
  );

  const productsWithScheme = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const has = activeSchemes.some((s) =>
        s.scope === 'product' ? s.productId === p.id : !!p.companyId && s.companyId === p.companyId
      );
      if (has) set.add(p.id);
    }
    return set;
  }, [products, activeSchemes]);

  const shopMatches = useMemo(() => {
    const t = shopQuery.trim().toLowerCase();
    return shops.filter((s) => !t || s.name.toLowerCase().includes(t)).slice(0, 30);
  }, [shops, shopQuery]);

  const productMatches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => !t || p.name.toLowerCase().includes(t)).slice(0, 60);
  }, [products, q]);

  const valid = lines.filter((l) => l.pcs > 0 && pmap.has(l.productId));

  /* ---------------- Scheme calculation ---------------- */
  const calc = useMemo(() => {
    const companyPcs = new Map<string, number>();
    const companyCtn = new Map<string, number>();
    for (const l of valid) {
      const p = pmap.get(l.productId)!;
      if (!p.companyId) continue;
      const ppc = p.pcsPerCarton || 1;
      companyPcs.set(p.companyId, (companyPcs.get(p.companyId) ?? 0) + l.pcs);
      companyCtn.set(p.companyId, (companyCtn.get(p.companyId) ?? 0) + l.pcs / ppc);
    }

    const out = new Map<string, LineCalc>();
    for (const l of valid) {
      const p = pmap.get(l.productId)!;
      const ppc = p.pcsPerCarton || 1;
      const gross = l.pcs * p.price;

      let best: { value: number; discount: number; bonusPcs: number; name: string } | null = null;
      let manualNote: string | null = null;
      let hint: { ratio: number; text: string } | null = null;

      for (const s of activeSchemes) {
        const applies =
          s.scope === 'product' ? s.productId === p.id : !!p.companyId && s.companyId === p.companyId;
        if (!applies) continue;

        const qtyPcs = s.scope === 'product' ? l.pcs : companyPcs.get(p.companyId!) ?? 0;
        const qtyCtn = s.scope === 'product' ? l.pcs / ppc : companyCtn.get(p.companyId!) ?? 0;
        const qty = s.unit === 'pcs' ? qtyPcs : qtyCtn;

        if (qty >= s.minQty) {
          let discount = 0;
          let bonusPcs = 0;
          if (s.type === 'percent') discount = (gross * s.percent) / 100;
          else if (s.type === 'flat') discount = Math.min(gross, (l.pcs / ppc) * s.flatPerCarton);
          else if (s.type === 'bonus') {
            if (s.scope === 'product' && s.minQty > 0 && s.bonusQty > 0) {
              const times = Math.floor(qty / s.minQty);
              bonusPcs = times * s.bonusQty * (s.unit === 'pcs' ? 1 : ppc);
            } else if (s.scope === 'company') {
              manualNote = `${s.name}: ${describe(s)}. Add the free item manually.`;
            }
          }
          const value = discount + bonusPcs * p.price;
          if (value > 0 && (!best || value > best.value)) {
            best = { value, discount, bonusPcs, name: s.name };
          }
        } else if (s.minQty > 0) {
          const short = s.minQty - qty;
          const ratio = short / s.minQty;
          if (!hint || ratio < hint.ratio) {
            hint = { ratio, text: `Add ${fmt(short)} more ${s.unit} to get ${describe(s)}` };
          }
        }
      }

      out.set(l.productId, {
        gross,
        discount: best?.discount ?? 0,
        bonusPcs: best?.bonusPcs ?? 0,
        schemeName: best?.name ?? null,
        manualNote,
        hint: hint?.text ?? null,
      });
    }
    return out;
  }, [valid, pmap, activeSchemes]);

  const gross = valid.reduce((s, l) => s + (calc.get(l.productId)?.gross ?? 0), 0);
  const discount = valid.reduce((s, l) => s + (calc.get(l.productId)?.discount ?? 0), 0);
  const total = gross - discount;
  const totalCartons = valid.reduce((s, l) => s + l.pcs / (pmap.get(l.productId)?.pcsPerCarton || 1), 0);
  const overLimit = !!shop && shop.creditLimit > 0 && shop.outstanding + total > shop.creditLimit;

  function addProduct(p: Product) {
    setError('');
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i === -1) return [...prev, { productId: p.id, pcs: p.pcsPerCarton || 1 }];
      return prev.map((l, k) => (k === i ? { ...l, pcs: l.pcs + (p.pcsPerCarton || 1) } : l));
    });
  }

  function setPcs(productId: string, pcs: number) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, pcs: Math.max(0, pcs) } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  // If your submit_order expects schemes in a different shape, change only this function.
  function buildPayload() {
    const items: Record<string, unknown>[] = [];
    for (const l of valid) {
      const p = pmap.get(l.productId)!;
      const c = calc.get(l.productId);
      const effRate = Math.round((p.price - (c?.discount ?? 0) / l.pcs) * 100) / 100;
      items.push({ product_id: p.id, qty_pcs: l.pcs, rate: effRate, is_bonus: false });
      if (c && c.bonusPcs > 0) {
        items.push({ product_id: p.id, qty_pcs: c.bonusPcs, rate: 0, is_bonus: true });
      }
    }
    return { id: orderId.current, shop_id: shopId, notes: notes.trim() || null, items };
  }

  function place() {
    setError('');
    if (!shop) return setError('Choose a shop first');
    if (!valid.length) return setError('Add at least one product');
    start(async () => {
      const res = await submit(JSON.stringify(buildPayload()));
      if (res.error) {
        setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
        return;
      }
      router.push('/orders');
      router.refresh();
    });
  }

  /* ---------------- Cart panel (desktop and mobile sheet) ---------------- */
  const cart = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ShoppingCart size={18} className="text-indigo-600" /> Order ({valid.length})
        </h2>
        {lines.length > 0 && (
          <button type="button" onClick={() => setLines([])} className="text-xs font-semibold text-slate-400 hover:text-red-600">
            Clear all
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-2">
        {lines.length === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            Tap a product to add it
          </div>
        )}

        {lines.map((l) => {
          const p = pmap.get(l.productId);
          if (!p) return null;
          const c = calc.get(l.productId);
          const ppc = p.pcsPerCarton || 1;
          const ctn = Math.floor(l.pcs / ppc);
          const loose = l.pcs % ppc;
          const lineTotal = l.pcs * p.price - (c?.discount ?? 0);
          return (
            <div key={l.productId} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight text-slate-900">{p.name}</p>
                <button type="button" onClick={() => removeLine(p.id)} aria-label="Remove" className="text-slate-300 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {rs(p.price)} / pc · {ppc} pcs per carton
              </p>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setPcs(p.id, l.pcs - ppc)}
                    className="grid size-9 place-items-center text-slate-500 active:bg-slate-100"
                    aria-label="Less cartons"
                  >
                    <Minus size={15} />
                  </button>
                  <input
                    inputMode="numeric"
                    value={ctn}
                    onChange={(e) => setPcs(p.id, num(e.target.value) * ppc + loose)}
                    className="w-10 bg-transparent text-center text-sm font-bold text-slate-900 outline-none"
                    aria-label="Cartons"
                  />
                  <button
                    type="button"
                    onClick={() => setPcs(p.id, l.pcs + ppc)}
                    className="grid size-9 place-items-center text-indigo-600 active:bg-indigo-50"
                    aria-label="More cartons"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <span className="text-xs font-semibold text-slate-400">ctn</span>

                <input
                  inputMode="numeric"
                  value={loose}
                  onChange={(e) => setPcs(p.id, ctn * ppc + num(e.target.value))}
                  className="h-9 w-12 rounded-xl bg-white text-center text-sm font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-indigo-400"
                  aria-label="Loose pieces"
                />
                <span className="text-xs font-semibold text-slate-400">pcs</span>

                <span className="ml-auto text-sm font-bold text-slate-900">{rs(lineTotal)}</span>
              </div>

              {c && c.discount > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                  <Tag size={13} /> {c.schemeName}: −{rs(c.discount)}
                </p>
              )}
              {c && c.bonusPcs > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                  <Gift size={13} /> {c.schemeName}: +{Math.floor(c.bonusPcs / ppc) > 0 ? `${Math.floor(c.bonusPcs / ppc)} ctn ` : ''}
                  {c.bonusPcs % ppc > 0 ? `${c.bonusPcs % ppc} pcs ` : ''}FREE
                </p>
              )}
              {c?.manualNote && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">{c.manualNote}</p>
              )}
              {c?.hint && <p className="mt-2 text-[11px] font-semibold text-indigo-600">💡 {c.hint}</p>}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-slate-100 p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Note (optional)"
          className="field resize-none text-sm"
        />

        {overLimit && shop && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              This order takes {shop.name} over its credit limit ({rs(shop.outstanding + total)} of {rs(shop.creditLimit)}).
            </span>
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

        <div className="space-y-1">
          {discount > 0 && (
            <>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal</span>
                <span>{rs(gross)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Scheme discount</span>
                <span>−{rs(discount)}</span>
              </div>
            </>
          )}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-400">{fmt(totalCartons)} cartons</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</p>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{rs(total)}</p>
          </div>
        </div>

        <button type="button" onClick={place} disabled={pending || !valid.length || !shop} className="btn-primary w-full disabled:opacity-50">
          {pending ? 'Placing order…' : 'Place order'}
        </button>
      </div>
    </div>
  );

  /* ---------------- Page ---------------- */
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
        {schemesFailed && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-100">
            Schemes could not be loaded, so no discounts or free items are applied on this screen.
          </p>
        )}

        {/* Shop picker */}
        <div className="card relative p-4">
          <p className="label mb-2">Shop</p>
          {shop && !shopOpen ? (
            <div className="flex items-center gap-3">
              <div className="hero grid size-11 shrink-0 place-items-center rounded-xl text-white">
                <Store size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{shop.name}</p>
                <p className="text-xs text-slate-500">
                  Outstanding <b className="text-slate-800">{rs(shop.outstanding)}</b>
                  {shop.creditLimit > 0 && <> · Limit {rs(shop.creditLimit)}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShopOpen(true);
                  setShopQuery('');
                }}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus={!shop}
                  value={shopQuery}
                  onChange={(e) => setShopQuery(e.target.value)}
                  placeholder="Search shop…"
                  className="field pl-10"
                />
                {shop && (
                  <button
                    type="button"
                    onClick={() => setShopOpen(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="Cancel"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {shopMatches.length === 0 && <p className="px-2 py-3 text-sm text-slate-400">No shop found</p>}
                {shopMatches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setShopId(s.id);
                      setShopOpen(false);
                      setError('');
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-indigo-50"
                  >
                    <span className="truncate text-sm font-semibold text-slate-800">{s.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-slate-400">{rs(s.outstanding)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product search + grid */}
        <div className="card p-4">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && productMatches[0]) {
                  e.preventDefault();
                  addProduct(productMatches[0]);
                  setQ('');
                }
              }}
              placeholder="Search product, press Enter to add"
              className="field pl-10"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {productMatches.map((p) => {
              const inCart = lines.find((l) => l.productId === p.id);
              const ctns = inCart ? inCart.pcs / (p.pcsPerCarton || 1) : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className={`relative rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] ${
                    inCart ? 'bg-indigo-50 ring-indigo-200' : 'bg-white ring-slate-200 hover:ring-indigo-300'
                  }`}
                >
                  {inCart && (
                    <span className="absolute right-2 top-2 grid min-w-6 place-items-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                      {fmt(ctns)}
                    </span>
                  )}
                  <p className="line-clamp-2 pr-6 text-sm font-semibold leading-tight text-slate-900">{p.name}</p>
                  <p className="mt-1 text-xs font-bold text-indigo-600">{rs(p.price)}</p>
                  <p className="text-[11px] text-slate-400">
                    {p.pcsPerCarton} pcs · {rs(p.price * p.pcsPerCarton)} / ctn
                  </p>
                  {productsWithScheme.has(p.id) && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Gift size={10} /> Scheme
                    </span>
                  )}
                </button>
              );
            })}
            {productMatches.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-400">No product found</p>}
          </div>
          {products.length > 60 && !q && <p className="mt-3 text-center text-xs text-slate-400">Showing first 60 products. Search to find others.</p>}
        </div>
      </div>

      {/* Cart (desktop) */}
      <aside className="card sticky top-4 hidden h-[calc(100dvh-2rem)] min-h-0 p-0 lg:block">{cart}</aside>

      {/* Mobile bar + sheet */}
      <div className="fixed inset-x-0 bottom-[4.5rem] z-40 px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="hero flex w-full items-center justify-between rounded-2xl px-4 py-3 text-white shadow-xl shadow-indigo-500/30"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart size={18} /> {valid.length} item{valid.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-2 text-sm font-bold">
            {rs(total)} <Check size={16} className="opacity-80" /> View
          </span>
        </button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 lg:hidden" onClick={() => setSheet(false)}>
          <div className="relative flex h-[85dvh] w-full flex-col rounded-t-3xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="min-h-0 flex-1">{cart}</div>
          </div>
        </div>
      )}
    </div>
  );
}