import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { ctn, docNo, one, rs, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { approveRequestAction, rejectRequestAction } from './actions';

type Named = { name: string };
type Prod = { name: string; pcs_per_carton: number; price_per_pcs: number };
const pk = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600 * 1000).toISOString();
const COND: Record<string, string> = { damaged: 'Damaged', expired: 'Expired' };

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; err?: string; rejected?: string }>;
}) {
  const { tab: tabParam, ok, err, rejected } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const tab = tabParam === 'requests' ? 'requests' : 'notes';

  const [{ data }, { data: pending }, { data: whs }] = await Promise.all([
    supabase
      .from('sales_returns')
      .select('id, credit_note_no, total, replace_value, reason, created_at, shops(name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('return_requests')
      .select('id, reason, note, created_at, salesman_id, shops(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100),
    supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const rows = data ?? [];
  const reqs = pending ?? [];

  const reqIds = reqs.map((r) => r.id as string);
  const manIds = [...new Set(reqs.map((r) => r.salesman_id as string))];
  const [{ data: items }, { data: men }] = await Promise.all([
    reqIds.length
      ? supabase
          .from('return_request_items')
          .select('request_id, qty_pcs, condition, mode, products(name, pcs_per_carton, price_per_pcs)')
          .in('request_id', reqIds)
      : Promise.resolve({ data: [] as never[] }),
    manIds.length ? supabase.from('profiles').select('id, full_name').in('id', manIds) : Promise.resolve({ data: [] as never[] }),
  ]);
  const manName = new Map(((men ?? []) as { id: string; full_name: string }[]).map((m) => [m.id, m.full_name]));
  const itemsBy = new Map<string, Record<string, unknown>[]>();
  for (const it of (items ?? []) as Record<string, unknown>[]) {
    const k = it.request_id as string;
    itemsBy.set(k, [...(itemsBy.get(k) ?? []), it]);
  }

  const nowPk = pk(new Date().toISOString());
  const month = nowPk.slice(0, 7);
  const day = nowPk.slice(0, 10);
  const inMonth = rows.filter((r) => pk(r.created_at).slice(0, 7) === month);
  const today = rows.filter((r) => pk(r.created_at).slice(0, 10) === day);
  const sum = (l: { total: number | string }[]) => l.reduce((a, r) => a + (Number(r.total) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Sales returns"
        subtitle="Credit notes and replacements for goods taken back"
        action={
          <Link href="/returns/new" className="btn-primary shrink-0">
            <Plus size={18} />
            New
          </Link>
        }
      />

      {ok && <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Approved. The credit note was created.</div>}
      {rejected && <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">Request rejected.</div>}
      {err && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{err}</div>}

      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
        <Link href="/returns?tab=requests" className={`card p-3 md:p-4 ${reqs.length ? 'ring-1 ring-amber-300' : ''}`}>
          <p className="text-xl font-extrabold text-amber-600 md:text-2xl">{reqs.length}</p>
          <p className="text-[11px] font-semibold text-slate-500">Requests waiting</p>
        </Link>
        <div className="card p-3 md:p-4">
          <p className="truncate text-xl font-extrabold text-red-600 md:text-2xl">{rs(sum(inMonth))}</p>
          <p className="text-[11px] font-semibold text-slate-500">Credited this month</p>
        </div>
        <div className="card p-3 md:p-4">
          <p className="truncate text-xl font-extrabold text-slate-900 md:text-2xl">{rs(sum(today))}</p>
          <p className="text-[11px] font-semibold text-slate-500">Credited today</p>
        </div>
      </div>

      <Link href="/returns/claims" className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <span className="font-bold text-slate-900">Returned goods and supplier claims</span>
        <span className="text-sm text-indigo-600">Open →</span>
      </Link>

      <div className="mb-4 flex gap-2">
        {[
          { k: 'notes', l: 'Credit notes' },
          { k: 'requests', l: `Requests (${reqs.length})` },
        ].map((t) => (
          <Link
            key={t.k}
            href={`/returns?tab=${t.k}`}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.k ? 'hero text-white shadow-md shadow-indigo-500/25' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {t.l}
          </Link>
        ))}
      </div>

      {tab === 'notes' &&
        (!rows.length ? (
          <EmptyState icon={RotateCcw} title="No returns yet" hint="Create a credit note when a shop returns goods." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const shop = one(r.shops as unknown as Named | Named[] | null);
              const repl = Number(r.replace_value) || 0;
              return (
                <Link key={r.id} href={`/returns/${r.id}`} className="card flex items-center gap-3 p-4 transition active:scale-[0.99]">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                    <RotateCcw size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{shop?.name ?? 'Shop'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {docNo('CN-', r.credit_note_no)} · {when(r.created_at)}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {Number(r.total) > 0 && <p className="font-bold text-red-600">- {rs(r.total)}</p>}
                    {repl > 0 && <p className="text-xs font-semibold text-indigo-600">Replaced {rs(repl)}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

      {tab === 'requests' &&
        (!reqs.length ? (
          <EmptyState icon={RotateCcw} title="No requests waiting" hint="Return requests from salesmen appear here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {reqs.map((r) => {
              const shop = one(r.shops as unknown as Named | Named[] | null);
              const its = itemsBy.get(r.id as string) ?? [];
              const hasReplace = its.some((it) => it.mode === 'replace');
              const est = its.reduce((s, it) => {
                const p = one(it.products as unknown as Prod | Prod[] | null);
                return s + (it.mode === 'replace' ? 0 : Number(it.qty_pcs) * Number(p?.price_per_pcs ?? 0));
              }, 0);
              return (
                <div key={r.id} className="card space-y-3 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{shop?.name ?? 'Shop'}</p>
                    <p className="text-xs text-slate-500">
                      {manName.get(r.salesman_id as string) ?? 'Salesman'} · {when(r.created_at)}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-slate-600">{r.note}</p>}
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl bg-slate-50/70">
                    {its.map((it, i) => {
                      const p = one(it.products as unknown as Prod | Prod[] | null);
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-900">{p?.name}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {ctn(Number(it.qty_pcs), p?.pcs_per_carton ?? 1)} · {COND[it.condition as string] ?? String(it.condition)} ·{' '}
                            {it.mode === 'replace' ? 'Replace' : 'Credit'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Credit at price list</span>
                    <span className="font-bold text-red-600">- {rs(est)}</span>
                  </div>

                  <form action={approveRequestAction} className="flex gap-2">
                    <input type="hidden" name="id" value={r.id as string} />
                    {hasReplace && (
                      <select name="warehouse_id" required className="field py-2" defaultValue={(whs ?? [])[0]?.id ?? ''}>
                        {(whs ?? []).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <Check size={16} />
                      Approve
                    </button>
                  </form>

                  <form action={rejectRequestAction} className="flex gap-2">
                    <input type="hidden" name="id" value={r.id as string} />
                    <input name="reason" required className="field py-2" placeholder="Reason to reject" />
                    <button className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                      <X size={15} />
                      Reject
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}