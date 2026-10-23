import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { ctn, dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import CsvButton from '@/components/CsvButton';

type Comp = { name: string; pcs: number; products: number; cost_value: number; retail_value: number };
type Prod = {
  product_id: string;
  name: string;
  company: string;
  pcs_per_carton: number;
  qty: number;
  cost: number;
  cost_value: number;
  retail_value: number;
  no_cost: boolean;
};
type StockRes = {
  summary: { pcs: number; products: number; cost_value: number; retail_value: number; expired_value: number; products_without_cost: number };
  companies: Comp[];
  products: Prod[];
};
type ExpRow = {
  name: string;
  company: string;
  pcs_per_carton: number;
  batch_no: string | null;
  expiry_date: string;
  qty_pcs: number;
  days_left: number;
  cost_value: number;
};
type ExpRes = {
  summary: Record<'expired_qty' | 'expired_value' | 'd30_qty' | 'd30_value' | 'd60_qty' | 'd60_value' | 'd90_qty' | 'd90_value', number>;
  rows: ExpRow[];
};

const num = (v: unknown) => Number(v) || 0;
const th = 'px-2 py-2 text-right';
const td = 'px-2 py-2 text-right';

function Box({ label, value, sub, tone = 'text-slate-900' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`truncate text-base font-extrabold md:text-lg ${tone}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default async function StockReportPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const tab = sp.tab === 'expiry' ? 'expiry' : 'value';
  const { data, error } = await supabase.rpc(tab === 'value' ? 'report_stock_value' : 'report_expiry');

  const tabs = [
    { key: 'value', label: 'Stock value' },
    { key: 'expiry', label: 'Expiry' },
  ];

  return (
    <div className="space-y-4">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Reports
      </Link>
      <PageHeader title="Stock value and expiry" subtitle="What your stock is worth and what is about to expire" />

      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/reports/stock?tab=${t.key}`}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'hero text-white shadow-md shadow-indigo-500/25' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{error.message}</div>}

      {/* ---------- Stock value ---------- */}
      {!error && tab === 'value' && data && (() => {
        const r = data as StockRes;
        const margin = num(r.summary.retail_value) - num(r.summary.cost_value);
        return (
          <div className="space-y-4">
            {num(r.summary.products_without_cost) > 0 && (
              <div className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <p>
                  {num(r.summary.products_without_cost)} product(s) in stock have no purchase cost, so they count as Rs 0.
                  Receive stock with a cost for them. They are marked in the table.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Box label="Stock at cost" value={rs(num(r.summary.cost_value))} sub={`${num(r.summary.products)} products`} tone="text-indigo-700" />
              <Box label="Stock at selling price" value={rs(num(r.summary.retail_value))} />
              <Box label="Potential margin" value={rs(margin)} tone="text-emerald-700" />
              <Box
                label="Already expired (at cost)"
                value={rs(num(r.summary.expired_value))}
                tone={num(r.summary.expired_value) > 0 ? 'text-red-600' : 'text-slate-900'}
              />
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">By company</h2>
                <CsvButton
                  filename="stock-value-companies.csv"
                  headers={['Company', 'Products', 'Pcs', 'Cost value', 'Selling value']}
                  rows={r.companies.map((x) => [x.name, num(x.products), num(x.pcs), num(x.cost_value), num(x.retail_value)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Company</th>
                      <th className={th}>Products</th>
                      <th className={th}>At cost</th>
                      <th className={th}>At selling price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.companies.map((x) => (
                      <tr key={x.name}>
                        <td className="px-2 py-2 font-medium text-slate-900">{x.name}</td>
                        <td className={td}>{num(x.products)}</td>
                        <td className={`${td} font-semibold`}>{rs(num(x.cost_value))}</td>
                        <td className={td}>{rs(num(x.retail_value))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">By product</h2>
                <CsvButton
                  filename="stock-value-products.csv"
                  headers={['Product', 'Company', 'Pcs', 'Cost per pc', 'Cost value', 'Selling value']}
                  rows={r.products.map((x) => [x.name, x.company, num(x.qty), num(x.cost), num(x.cost_value), num(x.retail_value)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Product</th>
                      <th className={th}>In stock</th>
                      <th className={th}>Cost / pc</th>
                      <th className={th}>At cost</th>
                      <th className={th}>At selling price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.products.map((x) => (
                      <tr key={x.product_id}>
                        <td className="px-2 py-2">
                          <p className="font-medium text-slate-900">
                            {x.name}
                            {x.no_cost && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">no cost</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400">{x.company}</p>
                        </td>
                        <td className={td}>{ctn(num(x.qty), num(x.pcs_per_carton))}</td>
                        <td className={td}>{rs(num(x.cost))}</td>
                        <td className={`${td} font-semibold`}>{rs(num(x.cost_value))}</td>
                        <td className={td}>{rs(num(x.retail_value))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 pt-2 text-xs text-slate-500">
                Cost uses each product&apos;s last purchase cost, summed over all warehouses and batches.
                {r.products.length >= 500 ? ' Showing the top 500 products by value.' : ''}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ---------- Expiry ---------- */}
      {!error && tab === 'expiry' && data && (() => {
        const r = data as ExpRes;
        const s = r.summary;
        const tone = (d: number) =>
          d < 0 ? 'text-red-700' : d <= 30 ? 'text-red-600' : d <= 60 ? 'text-orange-600' : 'text-amber-600';
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Box label="Expired" value={rs(num(s.expired_value))} sub={`${num(s.expired_qty)} pcs at cost`} tone="text-red-700" />
              <Box label="Within 30 days" value={rs(num(s.d30_value))} sub={`${num(s.d30_qty)} pcs`} tone="text-red-600" />
              <Box label="31 to 60 days" value={rs(num(s.d60_value))} sub={`${num(s.d60_qty)} pcs`} tone="text-orange-600" />
              <Box label="61 to 90 days" value={rs(num(s.d90_value))} sub={`${num(s.d90_qty)} pcs`} tone="text-amber-600" />
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">Batches ({r.rows.length})</h2>
                <CsvButton
                  filename="expiry-report.csv"
                  headers={['Product', 'Company', 'Batch', 'Expiry', 'Days left', 'Pcs', 'Cost value']}
                  rows={r.rows.map((x) => [x.name, x.company, x.batch_no ?? '', x.expiry_date, num(x.days_left), num(x.qty_pcs), num(x.cost_value)])}
                />
              </div>
              {r.rows.length === 0 && <p className="p-4 pt-0 text-sm text-slate-500">Nothing is expired or expiring in the next 90 days.</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Product</th>
                      <th className="px-2 py-2">Batch</th>
                      <th className="px-2 py-2">Expiry</th>
                      <th className={th}>Days left</th>
                      <th className={th}>Quantity</th>
                      <th className={th}>At cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.rows.map((x, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2">
                          <p className="font-medium text-slate-900">{x.name}</p>
                          <p className="text-[11px] text-slate-400">{x.company}</p>
                        </td>
                        <td className="px-2 py-2">{x.batch_no ?? '-'}</td>
                        <td className="px-2 py-2">{dateLabel(x.expiry_date)}</td>
                        <td className={`${td} font-semibold ${tone(num(x.days_left))}`}>
                          {num(x.days_left) < 0 ? `Expired ${-num(x.days_left)}d ago` : `${num(x.days_left)} days`}
                        </td>
                        <td className={td}>{ctn(num(x.qty_pcs), num(x.pcs_per_carton))}</td>
                        <td className={td}>{rs(num(x.cost_value))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 pt-2 text-xs text-slate-500">
                Loading skips expired batches and uses the earliest expiry first. Expired stock stays in your stock count until
                you write it off.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}