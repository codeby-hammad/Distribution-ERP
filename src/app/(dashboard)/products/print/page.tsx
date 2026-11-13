import Link from 'next/link';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, rs, todayPK } from '@/lib/format';
import PrintButton from '@/components/PrintButton';


type Stat = { product_id: string; stock_pcs: number; last_cost?: number | null };

const NO_BRAND = 'No brand';
const EXACT = '[print-color-adjust:exact] [-webkit-print-color-adjust:exact]';

function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/company-logo/${path}` : null;
}

export default async function ProductsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const onlyBrand = (sp.brand ?? '').trim();
  const grouped = sp.sort !== 'flat';

  const { supabase, profile } = await requireProfile();
  const manage = canManage(profile.role);
  const seeStock = manage || profile.role === 'warehouse';
  const seeCost = manage;

  const [{ data: products }, statsRes, tenantRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, brand, sku, pcs_per_carton, price_per_pcs')
      .is('deleted_at', null)
      .order('name'),
    seeStock
      ? supabase
          .from('product_stats')
          .select(seeCost ? 'product_id, stock_pcs, last_cost' : 'product_id, stock_pcs')
      : Promise.resolve({ data: [] as Stat[] }),
    supabase.from('tenants').select('name, address, phone, ntn, strn, logo_path').maybeSingle(),
  ]);

  const tenant = tenantRes.data;
  const logo = logoUrl(tenant?.logo_path);
  const stats = new Map(((statsRes.data ?? []) as unknown as Stat[]).map((s) => [s.product_id, s]));

  const all = (products ?? []).map((p) => {
    const pcs = p.pcs_per_carton as number;
    const unit = Number(p.price_per_pcs);
    const st = stats.get(p.id);
    const stock = Math.max(Number(st?.stock_pcs ?? 0), 0);
    const lastCost = st?.last_cost != null ? Number(st.last_cost) : null;
    return {
      id: p.id as string,
      name: p.name as string,
      brand: ((p.brand as string | null) ?? '').trim() || NO_BRAND,
      sku: p.sku as string | null,
      pcs,
      unit,
      carton: Math.round(unit * pcs * 100) / 100,
      stock,
      costCtn: lastCost != null ? Math.round(lastCost * pcs * 100) / 100 : null,
      margin: lastCost != null && unit > 0 ? ((unit - lastCost) / unit) * 100 : null,
      invest: lastCost != null ? stock * lastCost : 0,
      profit: lastCost != null ? stock * (unit - lastCost) : 0,
      saleValue: stock * unit,
      noCost: lastCost == null,
    };
  });

  const brandNames = Array.from(new Set(all.map((r) => r.brand))).sort((a, b) => {
    if (a === NO_BRAND) return 1;
    if (b === NO_BRAND) return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const rows = onlyBrand ? all.filter((r) => r.brand === onlyBrand) : all;

  const groups = grouped
    ? brandNames
        .map((b) => ({
          brand: b,
          items: rows
            .filter((r) => r.brand === b)
            .sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' })),
        }))
        .filter((g) => g.items.length > 0)
    : [{ brand: '', items: rows }];

  const sum = (list: typeof rows, f: (r: (typeof rows)[number]) => number) =>
    list.reduce((a, r) => a + f(r), 0);

  const totalInvest = sum(rows, (r) => r.invest);
  const totalSale = sum(rows.filter((r) => !r.noCost), (r) => r.saleValue);
  const totalProfit = sum(rows, (r) => r.profit);
  const inStock = rows.filter((r) => r.stock > 0).length;
  const noCostWithStock = rows.filter((r) => r.noCost && r.stock > 0).length;

  const cols = 5 + (seeStock ? 1 : 0) + (seeCost ? 3 : 0) + (!grouped ? 1 : 0);
  const qs = (b: string, s: string) => {
    const p = new URLSearchParams();
    if (b) p.set('brand', b);
    if (s) p.set('sort', s);
    const str = p.toString();
    return str ? `/products/print?${str}` : '/products/print';
  };

  const boxes: { l: string; v: string; big?: boolean }[] = seeCost
    ? [
        { l: 'Total investment', v: rs(totalInvest), big: true },
        { l: 'Sale value of that stock', v: rs(totalSale) },
        { l: 'Potential profit', v: rs(totalProfit) },
        { l: 'Items in stock', v: `${inStock} of ${rows.length}` },
      ]
    : seeStock
      ? [
          { l: 'Items listed', v: String(rows.length) },
          { l: 'Items in stock', v: String(inStock) },
        ]
      : [{ l: 'Items listed', v: String(rows.length) }];

  return (
    <div id="print-area" className="space-y-4">
      {/* Screen-only controls */}
      <div className="space-y-3 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/products" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            &larr; Back to products
          </Link>
          <PrintButton />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Brand</span>
          <Link
            href={qs('', sp.sort ?? '')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              !onlyBrand ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All brands
          </Link>
          {brandNames.map((b) => (
            <Link
              key={b}
              href={qs(b, sp.sort ?? '')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                onlyBrand === b ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {b}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Layout</span>
          <Link
            href={qs(onlyBrand, '')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              grouped ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Grouped by brand
          </Link>
          <Link
            href={qs(onlyBrand, 'flat')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              !grouped ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            One list (A to Z)
          </Link>
        </div>
      </div>

           {/* Branded header (readable even when background graphics are off) */}
<div className="print-brand overflow-hidden rounded-2xl border-2 border-indigo-700 bg-white">        <div className="flex items-center justify-between gap-4 border-b-4 border-indigo-700 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-16 shrink-0 rounded-xl object-contain" />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight text-indigo-800">
                {tenant?.name ?? 'Company'}
              </h1>
              {tenant?.address && <p className="text-xs text-slate-600">{tenant.address}</p>}
              <p className="text-xs text-slate-600">
                {[tenant?.phone, tenant?.ntn && `NTN ${tenant.ntn}`, tenant?.strn && `STRN ${tenant.strn}`]
                  .filter(Boolean)
                  .join('  ·  ')}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">
              {seeCost ? 'Price & stock report' : 'Product price list'}
            </p>
            <p className="text-xs text-slate-600">{todayPK()}</p>
            {onlyBrand && <p className="text-xs font-semibold text-slate-800">Brand: {onlyBrand}</p>}
          </div>
        </div>

        <div
          className="grid divide-x divide-slate-300"
          style={{ gridTemplateColumns: `repeat(${boxes.length}, minmax(0, 1fr))` }}
        >
          {boxes.map((b) => (
            <div key={b.l} className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{b.l}</p>
              <p className={`font-extrabold ${b.big ? 'text-xl text-indigo-700' : 'text-base text-slate-900'}`}>
                {b.v}
              </p>
            </div>
          ))}
        </div>

        {seeCost && (
          <p className="border-t border-slate-200 px-4 py-1.5 text-[10px] text-slate-500">
            Investment = stock on hand × last purchase cost per piece.
            {noCostWithStock > 0 &&
              ` ${noCostWithStock} product${noCostWithStock === 1 ? '' : 's'} in stock ${
                noCostWithStock === 1 ? 'has' : 'have'
              } no purchase cost yet and ${noCostWithStock === 1 ? 'is' : 'are'} not counted.`}
          </p>
        )}
      </div>

      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b-2 border-slate-300 text-[11px] uppercase tracking-wide text-slate-600">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Product</th>
            <th className="py-2 pr-2 text-right">Pcs/ctn</th>
            <th className="py-2 pr-2 text-right">Sale / ctn</th>
            <th className="py-2 pr-2 text-right">Sale / pc</th>
            {seeStock && <th className="py-2 pr-2 text-right">Stock</th>}
            {seeCost && <th className="py-2 pr-2 text-right">Cost / ctn</th>}
            {seeCost && <th className="py-2 pr-2 text-right">Margin</th>}
            {seeCost && <th className="py-2 text-right">Investment</th>}
            {!grouped && <th className="py-2 pl-2">Brand</th>}
          </tr>
        </thead>
        {groups.map((g) => {
          const gInvest = sum(g.items, (r) => r.invest);
          return (
            <tbody key={g.brand || 'all'}>
              {grouped && (
                <tr className="break-after-avoid">
                  <td
                    colSpan={cols}
                    className={`bg-slate-100 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 ${EXACT}`}
                  >
                    <span className="flex items-center justify-between">
                      <span>
                        {g.brand}{' '}
                        <span className="font-normal normal-case text-slate-500">({g.items.length} items)</span>
                      </span>
                      {seeCost && (
                        <span className="normal-case">
                          Investment: <b>{rs(gInvest)}</b>
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              )}
              {g.items.map((r, i) => (
                <tr key={r.id} className="break-inside-avoid border-b border-slate-200">
                  <td className="py-1.5 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-semibold text-slate-900">
                    {r.name}
                    {r.sku && <span className="ml-1 font-normal text-slate-400">({r.sku})</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{r.pcs}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{rs(r.carton)}</td>
                  <td className="py-1.5 pr-2 text-right">{rs(r.unit)}</td>
                  {seeStock && (
                    <td className="py-1.5 pr-2 text-right">{r.stock > 0 ? ctn(r.stock, r.pcs) : 'None'}</td>
                  )}
                  {seeCost && (
                    <td className="py-1.5 pr-2 text-right">{r.costCtn != null ? rs(r.costCtn) : '-'}</td>
                  )}
                  {seeCost && (
                    <td className="py-1.5 pr-2 text-right">
                      {r.margin != null ? `${r.margin.toFixed(1)}%` : '-'}
                    </td>
                  )}
                  {seeCost && (
                    <td className="py-1.5 text-right font-semibold">{r.noCost ? '-' : rs(r.invest)}</td>
                  )}
                  {!grouped && <td className="py-1.5 pl-2 text-slate-600">{r.brand}</td>}
                </tr>
              ))}
            </tbody>
          );
        })}
        {seeCost && (
          <tfoot>
            <tr className="border-t-2 border-slate-400">
              <td colSpan={cols - 1} className="py-2 pr-2 text-right text-xs font-bold uppercase">
                Total investment
              </td>
              <td className="py-2 text-right text-sm font-extrabold text-indigo-700">{rs(totalInvest)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      <p className="pt-2 text-center text-[10px] text-slate-400">
        {tenant?.name} &middot; Generated {todayPK()}
      </p>
    </div>
  );
}