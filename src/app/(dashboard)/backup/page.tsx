import { redirect } from 'next/navigation';
import { Download, ShieldCheck } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, one, rs, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import CsvButton from '@/components/CsvButton';

const HOUR = 3600 * 1000;
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 24 * HOUR).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;
type Named = { name: string };

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<{ man?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const today = pkToday();
  const to = isDate(sp.to) ? (sp.to as string) : today;
  const from = isDate(sp.from) ? (sp.from as string) : addDays(to, -6);
  const start = `${from}T00:00:00+05:00`;
  const end = `${to}T23:59:59.999+05:00`;

  const { data: men } = await supabase.from('profiles').select('id, full_name, role').eq('role', 'salesman').order('full_name');
  const man = (men ?? []).find((m) => m.id === sp.man);

  let orders: Record<string, unknown>[] = [];
  let cols: Record<string, unknown>[] = [];
  let visits: Record<string, unknown>[] = [];
  let rets: Record<string, unknown>[] = [];

  if (man) {
    const [o, c, v, r] = await Promise.all([
      supabase.from('orders').select('order_no, status, total, booked_at, shops(name)').eq('salesman_id', man.id).is('deleted_at', null).gte('booked_at', start).lte('booked_at', end).order('booked_at', { ascending: false }).limit(2000),
      supabase.from('collections').select('receipt_no, amount, method, created_at, shops(name)').eq('collected_by', man.id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(2000),
      supabase.from('visits').select('no_order_reason, visited_at, shops(name)').eq('salesman_id', man.id).eq('outcome', 'no_order').gte('visited_at', start).lte('visited_at', end).order('visited_at', { ascending: false }).limit(2000),
      supabase.from('return_requests').select('status, reason, created_at, shops(name)').eq('salesman_id', man.id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(2000),
    ]);
    orders = (o.data ?? []) as Record<string, unknown>[];
    cols = (c.data ?? []) as Record<string, unknown>[];
    visits = (v.data ?? []) as Record<string, unknown>[];
    rets = (r.data ?? []) as Record<string, unknown>[];
  }

  const shop = (r: Record<string, unknown>) => one(r.shops as unknown as Named | Named[] | null)?.name ?? '';
  const live = orders.filter((o) => o.status !== 'rejected');
  const th = 'px-2 py-2';

  return (
    <div className="space-y-4">
      <PageHeader title="Backup & data" subtitle="Download your data and check what each salesman did" />

      {profile.role === 'owner' && (
        <div className="card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Full data backup</h2>
              <p className="text-sm text-slate-500">
                One ZIP with every business table (orders, invoices, ledger, stock, returns and more) as JSON files.
                Keep it somewhere safe. It contains customer balances.
              </p>
            </div>
          </div>
          <a href="/backup/download" className="btn-primary flex w-full items-center justify-center gap-2">
            <Download size={18} />
            Download full backup (ZIP)
          </a>
          <p className="text-xs text-slate-500">
            This is a data export, not the database backup. Your Supabase project backups stay the main protection. Large
            businesses may take a minute to prepare.
          </p>
        </div>
      )}

      <form method="get" className="card space-y-3 p-4">
        <h2 className="font-bold text-slate-900">Check a salesman</h2>
        <select name="man" defaultValue={man?.id ?? ''} required className="field">
          <option value="" disabled>Select a salesman</option>
          {(men ?? []).map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={from} max={today} className="field" />
          </div>
          <div className="flex-1">
            <label className="label">To</label>
            <input type="date" name="to" defaultValue={to} max={today} className="field" />
          </div>
          <button className="btn-primary shrink-0">Show</button>
        </div>
      </form>

      {man && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { l: 'Orders', v: `${live.length}`, s: rs(live.reduce((a, o) => a + num(o.total), 0)) },
              { l: 'Collected', v: rs(cols.reduce((a, c) => a + num(c.amount), 0)), s: `${cols.length} receipts` },
              { l: 'No-order visits', v: `${visits.length}`, s: '' },
              { l: 'Return requests', v: `${rets.length}`, s: '' },
            ].map((b) => (
              <div key={b.l} className="card p-3">
                <p className="text-[11px] font-semibold text-slate-500">{b.l}</p>
                <p className="truncate text-lg font-extrabold text-slate-900">{b.v}</p>
                {b.s && <p className="truncate text-[11px] text-slate-400">{b.s}</p>}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            {man.full_name} · {dateLabel(from)} to {dateLabel(to)}
          </p>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="font-bold text-slate-900">Orders</h3>
              <CsvButton
                filename={`${man.full_name}-orders-${from}-to-${to}.csv`}
                headers={['Order no', 'Shop', 'Status', 'Total', 'Booked at']}
                rows={orders.map((o) => [num(o.order_no), shop(o), String(o.status), num(o.total), String(o.booked_at)])}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><th className={th}>#</th><th className={th}>Shop</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={th}>When</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o, i) => (
                    <tr key={i}><td className={th}>{num(o.order_no)}</td><td className={th}>{shop(o)}</td><td className={`${th} capitalize`}>{String(o.status)}</td><td className={`${th} text-right font-semibold`}>{rs(num(o.total))}</td><td className={th}>{when(String(o.booked_at))}</td></tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-slate-400">No orders in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="font-bold text-slate-900">Collections</h3>
              <CsvButton
                filename={`${man.full_name}-collections-${from}-to-${to}.csv`}
                headers={['Receipt', 'Shop', 'Amount', 'Method', 'Date']}
                rows={cols.map((c) => [num(c.receipt_no), shop(c), num(c.amount), String(c.method), String(c.created_at)])}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><th className={th}>Receipt</th><th className={th}>Shop</th><th className={`${th} text-right`}>Amount</th><th className={th}>Method</th><th className={th}>When</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {cols.map((c, i) => (
                    <tr key={i}><td className={th}>{num(c.receipt_no)}</td><td className={th}>{shop(c)}</td><td className={`${th} text-right font-semibold text-emerald-700`}>{rs(num(c.amount))}</td><td className={`${th} capitalize`}>{String(c.method)}</td><td className={th}>{when(String(c.created_at))}</td></tr>
                  ))}
                  {cols.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-slate-400">No collections in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="font-bold text-slate-900">No-order visits and return requests</h3>
              <CsvButton
                filename={`${man.full_name}-visits-returns-${from}-to-${to}.csv`}
                headers={['Type', 'Shop', 'Detail', 'When']}
                rows={[
                  ...visits.map((v) => ['No order', shop(v), String(v.no_order_reason ?? ''), String(v.visited_at)]),
                  ...rets.map((r) => ['Return request', shop(r), `${String(r.reason ?? '')} (${String(r.status)})`, String(r.created_at)]),
                ]}
              />
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {visits.map((v, i) => (
                <div key={'v' + i} className="flex justify-between gap-3 px-4 py-2.5"><span className="truncate">{shop(v)} · {String(v.no_order_reason ?? '')}</span><span className="shrink-0 text-xs text-slate-400">{when(String(v.visited_at))}</span></div>
              ))}
              {rets.map((r, i) => (
                <div key={'r' + i} className="flex justify-between gap-3 px-4 py-2.5"><span className="truncate">{shop(r)} · return ({String(r.status)})</span><span className="shrink-0 text-xs text-slate-400">{when(String(r.created_at))}</span></div>
              ))}
              {visits.length + rets.length === 0 && <p className="px-4 py-3 text-slate-400">Nothing in this period.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}