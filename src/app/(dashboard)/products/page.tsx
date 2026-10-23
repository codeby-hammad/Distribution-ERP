import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Coins,
  History,
  Package,
  PackageX,
  PackagePlus,
  Search,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Building2,
} from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, dateLabel, rs, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';
import EmptyState from '@/components/EmptyState';
import ProductForm from '@/components/ProductForm';
import ExpiryChip from '@/components/ExpiryChip';
import RestockSheet from '@/components/RestockSheet';

type Stat = {
  product_id: string;
  stock_pcs: number;
  expiring_pcs: number;
  last_cost?: number | null;
  prev_cost?: number | null;
  last_purchase_on?: string | null;
  last_supplier?: string | null;
};

type Batch = { batch: string | null; expiry: string | null; qty: number };

type Row = {
  id: string;
  name: string;
  brand: string | null;
  companyId: string | null;
  sku: string | null;
  barcode: string | null;
  pcs: number;
  unit: number;
  carton: number;
  minPcs: number;
  stock: number;
  expiring: number;
  lastCost: number | null;
  prevCost: number | null;
  lastOn: string | null;
  supplier: string | null;
  invest: number;
  saleValue: number;
  margin: number | null;
  status: 'out' | 'low' | 'ok' | null;
  suggestCtn: number;
  batches: Batch[];
};

const DUP = 'Another product already uses this SKU or barcode';

function fail(msg: string): never {
  redirect('/products?error=' + encodeURIComponent(msg));
}

function parseProduct(fd: FormData) {
  const name = String(fd.get('name') ?? '').trim();
  if (!name) return { error: 'Enter a product name' };

  const pcs = Math.floor(Number(fd.get('pcs_per_carton')));
  if (!(pcs >= 1)) return { error: 'Pieces per carton must be at least 1' };

  const price = Number(fd.get('price_per_pcs'));
  if (!(price >= 0)) return { error: 'Enter a valid sale price' };

  const minCtn = Number(fd.get('min_stock_ctn') || 0);
  if (!(minCtn >= 0)) return { error: 'Low stock level cannot be negative' };

  return {
    value: {
      name,
      company_id: String(fd.get('company_id') ?? '') || null,
      sku: String(fd.get('sku') ?? '').trim() || null,
      barcode: String(fd.get('barcode') ?? '').trim() || null,
      pcs_per_carton: pcs,
      price_per_pcs: Math.round(price * 10000) / 10000,
      min_stock_pcs: Math.round(minCtn * pcs),
    },
  };
}

function Trend({ last, prev }: { last: number | null; prev: number | null }) {
  if (last == null || prev == null || prev === 0 || last === prev) return null;
  const up = last > prev;
  const pct = Math.abs(((last - prev) / prev) * 100).toFixed(1);
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-0.5 font-semibold ${
        up ? 'text-red-600' : 'text-emerald-600'
      }`}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pct}%
    </span>
  );
}

function StockBadge({ status }: { status: Row['status'] }) {
  if (!status) return null;
  const styles = {
    out: 'bg-red-50 text-red-700',
    low: 'bg-amber-50 text-amber-700',
    ok: 'bg-emerald-50 text-emerald-700',
  } as const;
  const labels = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' } as const;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function Batches({ r }: { r: Row }) {
  if (!r.batches.length) return null;
  return (
    <details className="group rounded-xl ring-1 ring-slate-100">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
        <span>
          {r.batches.length} {r.batches.length === 1 ? 'batch' : 'batches'} (earliest expiry first)
        </span>
        <ChevronDown size={14} className="transition group-open:rotate-180" />
      </summary>
      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {r.batches.map((b, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-700">{b.batch ? `Batch ${b.batch}` : 'No batch'}</p>
              <p className="text-slate-400">{ctn(b.qty, r.pcs)}</p>
            </div>
            <ExpiryChip date={b.expiry} />
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; s?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const f = ['restock', 'expiring'].includes(sp.f ?? '') ? (sp.f as string) : '';
  const s = ['invest', 'stock'].includes(sp.s ?? '') ? (sp.s as string) : '';

  const { supabase, profile } = await requireProfile();
  const manage = canManage(profile.role);
  const seeStock = manage || profile.role === 'warehouse';
  const seeCost = manage;
  const canReceive = seeStock;

  async function addProduct(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

    const p = parseProduct(fd);
    if ('error' in p) fail(p.error);

    const { error } = await supabase
      .from('products')
      .insert({ tenant_id: profile.tenant_id, ...p.value });
    if (error) fail(error.code === '23505' ? DUP : error.message);

    revalidatePath('/products');
    redirect('/products?ok=' + encodeURIComponent('Product added'));
  }

  async function updateProduct(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

    const id = String(fd.get('id') ?? '');
    const p = parseProduct(fd);
    if ('error' in p) fail(p.error);

    const { error } = await supabase
      .from('products')
      .update(p.value)
      .eq('id', id)
      .is('deleted_at', null);
    if (error) fail(error.code === '23505' ? DUP : error.message);

    revalidatePath('/products');
    redirect('/products?ok=' + encodeURIComponent('Product updated'));
  }

  async function removeProduct(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', String(fd.get('id')));
    if (error) fail(error.message);

    revalidatePath('/products');
    redirect('/products?ok=' + encodeURIComponent('Product deleted'));
  }

  async function restock(payload: string): Promise<{ ok?: boolean; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: { items?: Record<string, unknown>[] };
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }
    if (!body.items?.length) return { error: 'Enter a quantity' };

    const withIds = {
      ...body,
      items: body.items.map((i) => ({ ...i, id: crypto.randomUUID() })),
    };

    const { error } = await supabase.rpc('post_grn', { p: withIds });
    if (error) return { error: error.message };

    revalidatePath('/products');
    return { ok: true };
  }

    const [{ data: products }, statsRes, batchRes, whRes, supRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, brand, sku, barcode, pcs_per_carton, price_per_pcs, min_stock_pcs')
      .is('deleted_at', null)
      .order('name'),
    seeStock
      ? supabase
          .from('product_stats')
          .select(
            seeCost
              ? 'product_id, stock_pcs, expiring_pcs, last_cost, prev_cost, last_purchase_on, last_supplier'
              : 'product_id, stock_pcs, expiring_pcs'
          )
      : Promise.resolve({ data: [] as Stat[] }),
    seeStock
      ? supabase
          .from('stock_on_hand')
          .select('product_id, batch_no, expiry_date, qty_pcs')
          .gt('qty_pcs', 0)
          .order('expiry_date', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as { product_id: string; batch_no: string | null; expiry_date: string | null; qty_pcs: number }[] }),
        canReceive
      ? supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    canReceive
      ? supabase.from('companies').select('id, name').is('deleted_at', null).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

    const warehouses = whRes.data ?? [];
  const suppliers = supRes.data ?? [];
  const statMap = new Map(((statsRes.data ?? []) as unknown as Stat[]).map((x) => [x.product_id, x]));

  const batchMap = new Map<string, Batch[]>();
  for (const b of batchRes.data ?? []) {
    const arr = batchMap.get(b.product_id) ?? [];
    arr.push({ batch: b.batch_no, expiry: b.expiry_date, qty: Number(b.qty_pcs) });
    batchMap.set(b.product_id, arr);
  }

  const rows: Row[] = (products ?? []).map((p) => {
    const st = statMap.get(p.id);
    const pcs = p.pcs_per_carton as number;
    const unit = Number(p.price_per_pcs);
    const stock = Number(st?.stock_pcs ?? 0);
    const lastCost = st?.last_cost != null ? Number(st.last_cost) : null;
    const minPcs = Number(p.min_stock_pcs ?? 0);
    const status: Row['status'] = !seeStock
      ? null
      : stock <= 0
        ? 'out'
        : minPcs > 0 && stock <= minPcs
          ? 'low'
          : 'ok';

    const needsStock = status === 'low' || status === 'out';
    const suggestCtn =
      seeStock && needsStock && minPcs > 0
        ? Math.ceil(Math.max(minPcs * 2 - Math.max(stock, 0), 0) / pcs)
        : 0;

    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      companyId: p.company_id ?? null,
      sku: p.sku,
      barcode: p.barcode,
      pcs,
      unit,
      carton: unit * pcs,
      minPcs,
      stock,
      expiring: Number(st?.expiring_pcs ?? 0),
      lastCost,
      prevCost: st?.prev_cost != null ? Number(st.prev_cost) : null,
      lastOn: st?.last_purchase_on ?? null,
      supplier: st?.last_supplier ?? null,
      invest: lastCost != null ? Math.max(stock, 0) * lastCost : 0,
      saleValue: Math.max(stock, 0) * unit,
      margin: lastCost != null && unit > 0 ? ((unit - lastCost) / unit) * 100 : null,
      status,
      suggestCtn,
      batches: batchMap.get(p.id) ?? [],
    };
  });

  const needle = q.toLowerCase();
  const list = rows
    .filter((r) => {
      const hay = `${r.name} ${r.sku ?? ''} ${r.barcode ?? ''} ${r.brand ?? ''}`.toLowerCase();
      if (needle && !hay.includes(needle)) return false;
      if (f === 'restock') return r.status === 'low' || r.status === 'out';
      if (f === 'expiring') return r.expiring > 0;
      return true;
    })
    .sort((a, b) => {
      if (s === 'invest') return b.invest - a.invest;
      if (s === 'stock') return a.stock - a.minPcs - (b.stock - b.minPcs);
      return 0;
    });

  const lowCount = rows.filter((r) => r.status === 'low').length;
  const outCount = rows.filter((r) => r.status === 'out').length;
  const expCount = rows.filter((r) => r.expiring > 0).length;
  const inStockCount = rows.filter((r) => r.stock > 0).length;
  const investment = rows.reduce((sum, r) => sum + r.invest, 0);
  const saleValue = rows.reduce((sum, r) => sum + r.saleValue, 0);
  const restockCost = rows.reduce(
    (sum, r) => (r.suggestCtn > 0 && r.lastCost != null ? sum + r.suggestCtn * r.pcs * r.lastCost : sum),
    0
  );

  const href = (nf: string, ns: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (nf) p.set('f', nf);
    if (ns) p.set('s', ns);
    const str = p.toString();
    return str ? `/products?${str}` : '/products';
  };

  const tabs = [
    { key: '', label: `All (${rows.length})` },
    { key: 'restock', label: `Restock needed (${lowCount + outCount})` },
    { key: 'expiring', label: `Expiring (${expCount})` },
  ];

  const sorts = [
    { key: '', label: 'Name' },
    { key: 'invest', label: 'Highest investment' },
    { key: 'stock', label: 'Lowest stock' },
  ];

  const formProduct = (r: Row) => ({
    id: r.id,
    name: r.name,
     brand: r.brand ?? '',
    companyId: r.companyId ?? '',
    sku: r.sku ?? '',
    barcode: r.barcode ?? '',
    pcs: r.pcs,
    unit: r.unit,
    minCtn: r.pcs > 0 ? Math.round((r.minPcs / r.pcs) * 100) / 100 : 0,
  });

  const today = todayPK();

    const Restock = ({ r, compact = false }: { r: Row; compact?: boolean }) =>
    canReceive ? (
      <RestockSheet
        submit={restock}
        today={today}
        warehouses={warehouses}
        suppliers={suppliers}
        compact={compact}
        highlight={r.status === 'low' || r.status === 'out'}
        product={{
          id: r.id,
          name: r.name,
          pcs: r.pcs,
          costCtn: seeCost && r.lastCost != null ? Math.round(r.lastCost * r.pcs * 100) / 100 : null,
          suggestCtn: r.suggestCtn,
          companyId: r.companyId,
        }}
      />
    ) : null;

  const Actions = ({ r }: { r: Row }) => (
    <div className="flex items-center">
      <AddSheet variant="edit" title={`Edit ${r.name}`}>
      <ProductForm action={updateProduct} product={formProduct(r)} suppliers={suppliers} />
      </AddSheet>
      <form action={removeProduct}>
        <input type="hidden" name="id" value={r.id} />
        <button
          aria-label="Delete product"
          className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={17} />
        </button>
      </form>
    </div>
  );

  const boxes = (r: Row) => {
    const out: { l: string; v: string; s?: React.ReactNode; tone?: string }[] = [
      { l: 'Sale price', v: `${rs(r.carton)} / ctn`, s: `${rs(r.unit)} / pc` },
    ];

    if (seeStock) {
      out.push({
        l: 'In stock',
        v: r.stock > 0 ? ctn(r.stock, r.pcs) : 'None',
        s: r.minPcs > 0 ? `Alert at ${ctn(r.minPcs, r.pcs)}` : `${r.stock} pcs`,
        tone: r.status === 'low' ? 'text-amber-600' : r.status === 'out' ? 'text-red-600' : undefined,
      });
    } else {
      out.push({ l: 'Pack', v: `${r.pcs} pcs / ctn` });
    }

    if (seeCost) {
      out.push({
        l: 'Last purchase cost',
        v: r.lastCost != null ? `${rs(r.lastCost * r.pcs)} / ctn` : 'No purchase yet',
        s:
          r.lastCost != null ? (
            <>
              {rs(r.lastCost)} / pc
              <Trend last={r.lastCost} prev={r.prevCost} />
            </>
          ) : undefined,
      });
      out.push({
        l: 'Investment',
        v: r.lastCost != null ? rs(r.invest) : '-',
        s: r.margin != null ? `Margin ${r.margin.toFixed(1)}%` : undefined,
        tone: r.margin != null && r.margin <= 0 ? 'text-red-600' : 'text-emerald-600',
      });
    }
    return out;
  };

  const stats = seeCost
    ? [
        { l: 'Stock investment', v: rs(investment), icon: Wallet, tint: 'bg-indigo-50 text-indigo-600' },
        {
          l: `Sale value (profit ${rs(Math.max(saleValue - investment, 0))})`,
          v: rs(saleValue),
          icon: Coins,
          tint: 'bg-emerald-50 text-emerald-600',
        },
        { l: 'Low stock', v: String(lowCount), icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' },
        { l: 'Out of stock', v: String(outCount), icon: PackageX, tint: 'bg-red-50 text-red-600' },
      ]
    : seeStock
      ? [
          { l: 'In stock', v: String(inStockCount), icon: Package, tint: 'bg-indigo-50 text-indigo-600' },
          { l: 'Low stock', v: String(lowCount), icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' },
          { l: 'Out of stock', v: String(outCount), icon: PackageX, tint: 'bg-red-50 text-red-600' },
        ]
      : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products & Stock"
        subtitle={`${rows.length} items in catalogue`}
        action={
          manage && (
            <AddSheet label="Add" title="New product">
            <ProductForm action={addProduct} suppliers={suppliers} />
            </AddSheet>
          )
        }
      />

      {sp.ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{sp.ok}</p>
        </div>
      )}
      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{sp.error}</p>
        </div>
      )}

      {!!stats.length && (
        <div className={`grid gap-3 ${stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
          {stats.map((x) => (
            <div key={x.l} className="card p-4">
              <div className={`mb-3 grid size-10 place-items-center rounded-xl ${x.tint}`}>
                <x.icon size={20} />
              </div>
              <p className="text-lg font-bold text-slate-900 md:text-2xl">{x.v}</p>
              <p className="text-xs text-slate-500">{x.l}</p>
            </div>
          ))}
        </div>
      )}
      {seeCost && (
        <p className="-mt-2 text-xs text-slate-400">
          Investment = stock on hand × last purchase cost per piece.
        </p>
      )}

           {canReceive && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link
            href="/stock/receive"
            className="card flex items-center justify-center gap-2 p-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            <PackagePlus size={17} />
            Receive many items
          </Link>
          <Link
            href="/stock/movements"
            className="card flex items-center justify-center gap-2 p-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <History size={17} />
            Stock movements
          </Link>
          {manage && (
            <Link
              href="/suppliers"
              className="card col-span-2 flex items-center justify-center gap-2 p-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:col-span-1"
            >
              <Building2 size={17} />
              Suppliers
            </Link>
          )}
        </div>
      )}

      <form className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, SKU, barcode or brand"
          className="field pl-10"
        />
        {f && <input type="hidden" name="f" value={f} />}
        {s && <input type="hidden" name="s" value={s} />}
      </form>

      {seeStock && (
        <div className="space-y-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {tabs.map((t) => (
              <Link
                key={t.key || 'all'}
                href={href(t.key, s)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  f === t.key
                    ? 'hero text-white shadow-md shadow-indigo-500/25'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
            <span className="shrink-0 text-xs font-semibold text-slate-400">Sort</span>
            {sorts.map((o) => (
              <Link
                key={o.key || 'name'}
                href={href(f, o.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  s === o.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {seeCost && f === 'restock' && restockCost > 0 && (
        <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900 ring-1 ring-indigo-100">
          Estimated cost to buy all suggested quantities (at last purchase cost):{' '}
          <span className="font-bold">{rs(restockCost)}</span>
        </div>
      )}

      {!rows.length ? (
        <EmptyState icon={Package} title="No products yet" hint="Tap Add to create your first product." />
      ) : !list.length ? (
        <div className="card p-10 text-center text-sm text-slate-400">No products match your search.</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {list.map((r) => (
              <div key={r.id} className="card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Package size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[r.brand, r.sku, r.barcode].filter(Boolean).join(' · ') || 'No brand, SKU or barcode'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{r.pcs} pcs per carton</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StockBadge status={r.status} />
                    {manage && <Actions r={r} />}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {boxes(r).map((b) => (
                    <div key={b.l} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{b.l}</p>
                      <p className="text-sm font-bold text-slate-900">{b.v}</p>
                      {b.s && <p className={`text-[11px] ${b.tone ?? 'text-slate-500'}`}>{b.s}</p>}
                    </div>
                  ))}
                </div>

                {r.suggestCtn > 0 && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Suggested reorder: {r.suggestCtn} cartons
                    {seeCost && r.lastCost != null && ` (about ${rs(r.suggestCtn * r.pcs * r.lastCost)})`}
                  </p>
                )}

                {r.expiring > 0 && (
                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                    {ctn(r.expiring, r.pcs)} expiring within 30 days
                  </span>
                )}

                {seeStock && <Batches r={r} />}

                {seeCost && r.lastOn && (
                  <p className="text-[11px] text-slate-400">
                    Last purchase {dateLabel(r.lastOn)}
                    {r.supplier ? ` · ${r.supplier}` : ''}
                  </p>
                )}

                <Restock r={r} />
              </div>
            ))}
          </div>

          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Product</th>
                  <th className="px-4 py-3.5 font-semibold">Pack</th>
                  <th className="px-4 py-3.5 font-semibold">Sale price</th>
                  {seeCost && <th className="px-4 py-3.5 font-semibold">Last cost</th>}
                  {seeCost && <th className="px-4 py-3.5 font-semibold">Margin</th>}
                  {seeStock && <th className="px-4 py-3.5 font-semibold">Stock</th>}
                  {seeCost && <th className="px-4 py-3.5 font-semibold">Investment</th>}
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {[r.brand, r.sku, r.barcode].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">{r.pcs} pcs/ctn</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{rs(r.carton)} / ctn</p>
                      <p className="text-xs text-slate-500">{rs(r.unit)} / pc</p>
                    </td>
                    {seeCost && (
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {r.lastCost != null ? (
                          <>
                            <p className="font-semibold text-slate-900">{rs(r.lastCost * r.pcs)} / ctn</p>
                            <p className="text-xs text-slate-500">
                              {rs(r.lastCost)} / pc
                              <Trend last={r.lastCost} prev={r.prevCost} />
                            </p>
                            {r.lastOn && <p className="text-[11px] text-slate-400">{dateLabel(r.lastOn)}</p>}
                          </>
                        ) : (
                          <span className="text-slate-400">No purchase yet</span>
                        )}
                      </td>
                    )}
                    {seeCost && (
                      <td
                        className={`whitespace-nowrap px-4 py-3.5 font-semibold ${
                          r.margin != null && r.margin <= 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {r.margin != null ? `${r.margin.toFixed(1)}%` : '-'}
                      </td>
                    )}
                    {seeStock && (
                      <td className="min-w-52 px-4 py-3.5">
                        <p className="mb-1 font-semibold text-slate-900">
                          {r.stock > 0 ? ctn(r.stock, r.pcs) : 'None'}
                        </p>
                        <StockBadge status={r.status} />
                        {r.suggestCtn > 0 && (
                          <p className="mt-1 text-[11px] font-semibold text-amber-700">
                            Suggested: {r.suggestCtn} ctn
                          </p>
                        )}
                        {r.expiring > 0 && (
                          <p className="mt-1 text-[11px] font-semibold text-amber-600">
                            {ctn(r.expiring, r.pcs)} expiring
                          </p>
                        )}
                        <div className="mt-2">
                          <Batches r={r} />
                        </div>
                      </td>
                    )}
                    {seeCost && (
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-900">
                        {r.lastCost != null ? rs(r.invest) : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Restock r={r} compact />
                        {manage && <Actions r={r} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}