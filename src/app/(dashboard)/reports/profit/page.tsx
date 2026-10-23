import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import CsvButton from '@/components/CsvButton';

type Prod = { product_id: string; name: string; sold_pcs: number; revenue: number; cost: number; profit: number; no_cost: boolean };
type Comp = { name: string; revenue: number; cost: number; profit: number };
type Cat = { category: string; amount: number; entries: number };
type Result = {
  summary: { revenue: number; cost: number; expenses: number; products_without_cost: number };
  products: Prod[];
  companies: Comp[];
  expense_categories: Cat[];
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;

function Box({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`truncate text-base font-extrabold md:text-lg ${tone}`}>{value}</p>
    </div>
  );
}

export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const today = pkToday();
  const to = isDate(sp.to) ? (sp.to as string) : today;
  const from = isDate(sp.from) ? (sp.from as string) : today.slice(0, 8) + '01';

  const { data, error } = await supabase.rpc('report_profit', { p_from: from, p_to: to });
  const r = data as Result | null;

  const revenue = num(r?.summary.revenue);
  const cost = num(r?.summary.cost);
  const expenses = num(r?.summary.expenses);
  const gross = revenue - cost;
  const net = gross - expenses;
  const margin = revenue > 0 ? (gross / revenue) * 100 : 0;

  const presets = [
    { l: 'Today', f: today, t: today },
    { l: '7 days', f: addDays(today, -6), t: today },
    { l: '30 days', f: addDays(today, -29), t: today },
    { l: 'This month', f: today.slice(0, 8) + '01', t: today },
  ];
  const q = (f: string, t: string) => `/reports/profit?from=${f}&to=${t}`;
  const th = 'px-2 py-2 text-right';
  const td = 'px-2 py-2 text-right';

  return (
    <div className="space-y-4">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Reports
      </Link>
      <PageHeader title="Profit" subtitle="Delivered sales, minus cost and expenses" />

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link key={p.l} href={q(p.f, p.t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${from === p.f && to === p.t ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>
              {p.l}
            </Link>
          ))}
        </div>
        <form method="get" className="flex items-end gap-2">
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
        <p className="text-xs text-slate-500">{dateLabel(from)} to {dateLabel(to)}</p>
      </div>

      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{error.message}</div>}

      {r && (
        <>
          {num(r.summary.products_without_cost) > 0 && (
            <div className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                {num(r.summary.products_without_cost)} product(s) have no purchase cost, so their profit is overstated.
                Receive stock with a cost for them. They are marked in the table.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Box label="Sales (delivered, net)" value={rs(revenue)} />
            <Box label="Cost of goods" value={rs(cost)} tone="text-red-600" />
            <Box label={`Gross profit · ${margin.toFixed(1)}%`} value={rs(gross)} tone="text-indigo-700" />
            <Box label="Expenses" value={rs(expenses)} tone="text-amber-600" />
            <Box label="Net profit" value={rs(net)} tone={net >= 0 ? 'text-emerald-700' : 'text-red-600'} />
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-900">By company</h2>
              <CsvButton filename={`profit-companies-${from}-to-${to}.csv`} headers={['Company', 'Sales', 'Cost', 'Profit']} rows={r.companies.map((x) => [x.name, num(x.revenue), num(x.cost), num(x.profit)])} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Company</th><th className={th}>Sales</th><th className={th}>Cost</th><th className={th}>Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.companies.map((x) => (
                    <tr key={x.name}>
                      <td className="px-2 py-2 font-medium text-slate-900">{x.name}</td>
                      <td className={td}>{rs(num(x.revenue))}</td>
                      <td className={`${td} text-red-600`}>{rs(num(x.cost))}</td>
                      <td className={`${td} font-semibold ${num(x.profit) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rs(num(x.profit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-900">By product</h2>
              <CsvButton filename={`profit-products-${from}-to-${to}.csv`} headers={['Product', 'Pcs sold', 'Sales', 'Cost', 'Profit']} rows={r.products.map((x) => [x.name, num(x.sold_pcs), num(x.revenue), num(x.cost), num(x.profit)])} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Product</th><th className={th}>Pcs</th><th className={th}>Sales</th><th className={th}>Cost</th><th className={th}>Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.products.map((x) => (
                    <tr key={x.product_id}>
                      <td className="px-2 py-2 font-medium text-slate-900">
                        {x.name}
                        {x.no_cost && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">no cost</span>}
                      </td>
                      <td className={td}>{num(x.sold_pcs)}</td>
                      <td className={td}>{rs(num(x.revenue))}</td>
                      <td className={`${td} text-red-600`}>{rs(num(x.cost))}</td>
                      <td className={`${td} font-semibold ${num(x.profit) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rs(num(x.profit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-900">Expenses by category</h2>
              <Link href="/expenses" className="text-xs font-semibold text-indigo-600">Add expense →</Link>
            </div>
            {r.expense_categories.length === 0 && <p className="p-4 pt-0 text-sm text-slate-500">No expenses in this period.</p>}
            <div className="divide-y divide-slate-100">
              {r.expense_categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-900">{c.category} <span className="text-xs text-slate-400">({num(c.entries)})</span></span>
                  <span className="font-semibold text-slate-900">{rs(num(c.amount))}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Profit counts goods delivered in this period, dated by trip settlement. Cost uses each product&apos;s last purchase cost, so older sales
            are valued at today&apos;s cost.
          </p>
        </>
      )}
    </div>
  );
}