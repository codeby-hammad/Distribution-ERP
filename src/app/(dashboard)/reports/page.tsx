import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import CsvButton from '@/components/CsvButton';
import { BarChart3 } from 'lucide-react';

const TABS = [
  { key: 'sales', label: 'Daily sales' },
  { key: 'salesmen', label: 'Salesmen' },
  { key: 'routes', label: 'Routes' },
  { key: 'aging', label: 'Aging' },
  { key: 'tax', label: 'Tax' },
];

type Sales = {
  day: string;
  orders: number;
  order_amount: number;
  rejected: number;
  invoiced: number;
  delivered_net: number;
  received: number;
};
type Man = {
  id: string;
  full_name: string;
  orders: number;
  order_amount: number;
  shops_ordered: number;
  no_order_visits: number;
  collected: number;
};
type Route = {
  id: string | null;
  name: string;
  invoiced: number;
  returns: number;
  collected: number;
  outstanding: number;
  shops_owing: number;
};
type Age = {
  shop_id: string;
  name: string;
  phone: string | null;
  route_name: string;
  total: number;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
};
type TaxRow = {
  invoice_id: string;
  invoice_no: number;
  invoice_date: string;
  shop_id: string;
  shop_name: string;
  tax_status: string;
  total: number;
  rate: number;
  tax: number;
  net: number;
};
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Pakistan is UTC+5, no DST
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

function Box({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`truncate text-base font-extrabold md:text-lg ${tone}`}>{value}</p>
    </div>
  );
}

const th = 'px-2 py-2 text-right';
const td = 'px-2 py-2 text-right';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : 'sales';
  const today = pkToday();
  const to = isDate(sp.to) ? (sp.to as string) : today;
  const from = isDate(sp.from) ? (sp.from as string) : addDays(to, -6);

   const fn =
    tab === 'sales'
      ? 'report_daily_sales'
      : tab === 'salesmen'
        ? 'report_salesman'
        : tab === 'routes'
          ? 'report_route_recovery'
          : tab === 'tax'
            ? 'report_tax'
            : 'report_aging';
  const { data, error } = await supabase.rpc(fn, tab === 'aging' ? {} : { p_from: from, p_to: to });
  const rows = (data ?? []) as unknown[];

  const presets = [
    { l: 'Today', f: today, t: today },
    { l: '7 days', f: addDays(today, -6), t: today },
    { l: '30 days', f: addDays(today, -29), t: today },
    { l: 'This month', f: today.slice(0, 8) + '01', t: today },
  ];
  const q = (t: string, f = from, e = to) => `/reports?tab=${t}&from=${f}&to=${e}`;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, salesmen, recovery and aging" />
              <Link href="/reports/profit" className="hero mb-4 flex items-center justify-between rounded-2xl p-4 text-white">
        <span className="font-bold">Profit and expenses report</span>
        <span className="text-sm">Open →</span>
      </Link>

            <Link href="/reports/stock" className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <span className="font-bold text-slate-900">Stock value and expiry</span>
        <span className="text-sm text-indigo-600">Open →</span>
      </Link>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={q(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'hero text-white shadow-md shadow-indigo-500/25' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab !== 'aging' && (
        <div className="card mb-4 space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Link
                key={p.l}
                href={q(tab, p.f, p.t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  from === p.f && to === p.t ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {p.l}
              </Link>
            ))}
          </div>
          <form method="get" className="flex items-end gap-2">
            <input type="hidden" name="tab" value={tab} />
            <div className="flex-1">
              <label className="label">From</label>
              <input type="date" name="from" defaultValue={from} max={today} className="field" />
            </div>
            <div className="flex-1">
              <label className="label">To</label>
              <input type="date" name="to" defaultValue={to} max={today} className="field" />
            </div>
            <button className="btn-primary shrink-0">Apply</button>
          </form>
          <p className="text-xs text-slate-500">
            {dateLabel(from)} to {dateLabel(to)}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          {error.message.replace(/^[A-Z_]+:\s*/, '')}
        </div>
      )}

      {!error && rows.length === 0 && (
        <EmptyState icon={BarChart3} title="No data for this report" hint="Try a wider date range." />
      )}

      {/* ---------- Daily sales ---------- */}
      {!error && tab === 'sales' && rows.length > 0 && (() => {
        const r = rows as Sales[];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Box label="Orders booked" value={`${sum(r, (x) => num(x.orders))} · ${rs(sum(r, (x) => num(x.order_amount)))}`} />
              <Box label="Invoiced" value={rs(sum(r, (x) => num(x.invoiced)))} />
              <Box label="Delivered (net of returns)" value={rs(sum(r, (x) => num(x.delivered_net)))} tone="text-indigo-700" />
              <Box label="Cash received" value={rs(sum(r, (x) => num(x.received)))} tone="text-emerald-700" />
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">By day</h2>
                <CsvButton
                  filename={`daily-sales-${from}-to-${to}.csv`}
                  headers={['Date', 'Orders', 'Order amount', 'Rejected', 'Invoiced', 'Delivered net', 'Cash received']}
                  rows={r.map((x) => [x.day, num(x.orders), num(x.order_amount), num(x.rejected), num(x.invoiced), num(x.delivered_net), num(x.received)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Date</th>
                      <th className={th}>Orders</th>
                      <th className={th}>Order amount</th>
                      <th className={th}>Invoiced</th>
                      <th className={th}>Delivered</th>
                      <th className={th}>Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.map((x) => (
                      <tr key={x.day}>
                        <td className="px-2 py-2 font-medium text-slate-900">{dateLabel(x.day)}</td>
                        <td className={td}>
                          {num(x.orders)}
                          {num(x.rejected) > 0 && <span className="ml-1 text-[11px] text-red-500">(-{num(x.rejected)})</span>}
                        </td>
                        <td className={td}>{rs(num(x.order_amount))}</td>
                        <td className={td}>{rs(num(x.invoiced))}</td>
                        <td className={td}>{rs(num(x.delivered_net))}</td>
                        <td className={`${td} font-semibold text-emerald-700`}>{rs(num(x.received))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- Salesmen ---------- */}
      {!error && tab === 'salesmen' && rows.length > 0 && (() => {
        const r = rows as Man[];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Box label="Orders" value={String(sum(r, (x) => num(x.orders)))} />
              <Box label="Order amount" value={rs(sum(r, (x) => num(x.order_amount)))} tone="text-indigo-700" />
              <Box label="No-order visits" value={String(sum(r, (x) => num(x.no_order_visits)))} tone="text-amber-600" />
              <Box label="Cash collected" value={rs(sum(r, (x) => num(x.collected)))} tone="text-emerald-700" />
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">Per salesman</h2>
                <CsvButton
                  filename={`salesmen-${from}-to-${to}.csv`}
                  headers={['Salesman', 'Orders', 'Order amount', 'Shops ordered', 'No-order visits', 'Cash collected']}
                  rows={r.map((x) => [x.full_name, num(x.orders), num(x.order_amount), num(x.shops_ordered), num(x.no_order_visits), num(x.collected)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Salesman</th>
                      <th className={th}>Orders</th>
                      <th className={th}>Amount</th>
                      <th className={th}>Shops</th>
                      <th className={th}>No order</th>
                      <th className={th}>Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.map((x) => (
                      <tr key={x.id}>
                        <td className="px-2 py-2 font-medium text-slate-900">{x.full_name}</td>
                        <td className={td}>{num(x.orders)}</td>
                        <td className={`${td} font-semibold`}>{rs(num(x.order_amount))}</td>
                        <td className={td}>{num(x.shops_ordered)}</td>
                        <td className={`${td} text-amber-600`}>{num(x.no_order_visits)}</td>
                        <td className={`${td} font-semibold text-emerald-700`}>{rs(num(x.collected))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- Routes ---------- */}
      {!error && tab === 'routes' && rows.length > 0 && (() => {
        const r = rows as Route[];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Box label="Invoiced" value={rs(sum(r, (x) => num(x.invoiced)))} />
              <Box label="Returns" value={rs(sum(r, (x) => num(x.returns)))} tone="text-red-600" />
              <Box label="Collected" value={rs(sum(r, (x) => num(x.collected)))} tone="text-emerald-700" />
              <Box label="Outstanding now" value={rs(sum(r, (x) => num(x.outstanding)))} tone="text-amber-600" />
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">Per route</h2>
                <CsvButton
                  filename={`routes-${from}-to-${to}.csv`}
                  headers={['Route', 'Invoiced', 'Returns', 'Collected', 'Outstanding now', 'Shops owing']}
                  rows={r.map((x) => [x.name, num(x.invoiced), num(x.returns), num(x.collected), num(x.outstanding), num(x.shops_owing)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Route</th>
                      <th className={th}>Invoiced</th>
                      <th className={th}>Returns</th>
                      <th className={th}>Collected</th>
                      <th className={th}>Outstanding</th>
                      <th className={th}>Shops owing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.map((x) => (
                      <tr key={x.id ?? 'none'}>
                        <td className="px-2 py-2 font-medium text-slate-900">{x.name}</td>
                        <td className={td}>{rs(num(x.invoiced))}</td>
                        <td className={`${td} text-red-600`}>{rs(num(x.returns))}</td>
                        <td className={`${td} font-semibold text-emerald-700`}>{rs(num(x.collected))}</td>
                        <td className={`${td} font-semibold text-amber-600`}>{rs(num(x.outstanding))}</td>
                        <td className={td}>{num(x.shops_owing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 pt-2 text-xs text-slate-500">
                Invoiced, returns and collected are for the dates chosen. Outstanding is each route&apos;s balance as of now.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ---------- Aging ---------- */}
      {!error && tab === 'aging' && rows.length > 0 && (() => {
        const r = rows as Age[];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Box label="Total outstanding" value={rs(sum(r, (x) => num(x.total)))} />
              <Box label="0-30 days" value={rs(sum(r, (x) => num(x.d0_30)))} tone="text-emerald-700" />
              <Box label="31-60 days" value={rs(sum(r, (x) => num(x.d31_60)))} tone="text-amber-600" />
              <Box label="61-90 days" value={rs(sum(r, (x) => num(x.d61_90)))} tone="text-orange-600" />
              <Box label="90+ days" value={rs(sum(r, (x) => num(x.d90_plus)))} tone="text-red-600" />
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">Shops owing ({r.length})</h2>
                <CsvButton
                  filename={`aging-${today}.csv`}
                  headers={['Shop', 'Route', 'Phone', 'Total', '0-30', '31-60', '61-90', '90+']}
                  rows={r.map((x) => [x.name, x.route_name, x.phone ?? '', num(x.total), num(x.d0_30), num(x.d31_60), num(x.d61_90), num(x.d90_plus)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Shop</th>
                      <th className={th}>Total</th>
                      <th className={th}>0-30</th>
                      <th className={th}>31-60</th>
                      <th className={th}>61-90</th>
                      <th className={th}>90+</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.map((x) => (
                      <tr key={x.shop_id}>
                        <td className="px-2 py-2">
                          <Link href={`/shops/${x.shop_id}`} className="font-medium text-slate-900">
                            {x.name}
                          </Link>
                          <p className="text-[11px] text-slate-400">
                            {x.route_name}
                            {x.phone ? ` · ${x.phone}` : ''}
                          </p>
                        </td>
                        <td className={`${td} font-bold`}>{rs(num(x.total))}</td>
                        <td className={td}>{rs(num(x.d0_30))}</td>
                        <td className={`${td} text-amber-600`}>{rs(num(x.d31_60))}</td>
                        <td className={`${td} text-orange-600`}>{rs(num(x.d61_90))}</td>
                        <td className={`${td} font-semibold text-red-600`}>{rs(num(x.d90_plus))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 pt-2 text-xs text-slate-500">
                Payments are applied to the oldest debt first. Opening balances count as 90+.
              </p>
            </div>
          </div>
        );
      })()}


            {/* ---------- Tax ---------- */}
      {!error && tab === 'tax' && rows.length > 0 && (() => {
        const r = rows as TaxRow[];
        const filer = r.filter((x) => x.tax_status !== 'non_filer');
        const non = r.filter((x) => x.tax_status === 'non_filer');
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Box label="Invoices" value={String(r.length)} />
              <Box label="Sales (incl. tax)" value={rs(sum(r, (x) => num(x.total)))} />
              <Box label="Tax collected" value={rs(sum(r, (x) => num(x.tax)))} tone="text-indigo-700" />
              <Box label="Filer tax" value={rs(sum(filer, (x) => num(x.tax)))} tone="text-emerald-700" />
              <Box label="Non-filer tax" value={rs(sum(non, (x) => num(x.tax)))} tone="text-amber-600" />
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="font-bold text-slate-900">Tax by invoice</h2>
                <CsvButton
                  filename={`tax-${from}-to-${to}.csv`}
                  headers={['Date', 'Invoice', 'Shop', 'Status', 'Total', 'Rate %', 'Tax', 'Net']}
                  rows={r.map((x) => [x.invoice_date, x.invoice_no, x.shop_name, x.tax_status, num(x.total), num(x.rate), num(x.tax), num(x.net)])}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Invoice</th>
                      <th className="px-2 py-2">Shop</th>
                      <th className={th}>Total</th>
                      <th className={th}>Rate</th>
                      <th className={th}>Tax</th>
                      <th className={th}>Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.map((x) => (
                      <tr key={x.invoice_id}>
                        <td className="px-2 py-2">
                          <span className="font-medium text-slate-900">#{x.invoice_no}</span>
                          <p className="text-[11px] text-slate-400">{dateLabel(x.invoice_date)}</p>
                        </td>
                        <td className="px-2 py-2">
                          <Link href={`/shops/${x.shop_id}`} className="font-medium text-slate-900">
                            {x.shop_name}
                          </Link>
                          <p className={`text-[11px] ${x.tax_status === 'non_filer' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {x.tax_status === 'non_filer' ? 'Non-filer' : 'Filer'}
                          </p>
                        </td>
                        <td className={td}>{rs(num(x.total))}</td>
                        <td className={td}>{num(x.rate)}%</td>
                        <td className={`${td} font-semibold text-indigo-700`}>{rs(num(x.tax))}</td>
                        <td className={td}>{rs(num(x.net))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 pt-2 text-xs text-slate-500">
                Prices include tax. Tax is split out of each invoice total using the shop&apos;s filer or non-filer rate. This is a display report, not a tax filing.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}