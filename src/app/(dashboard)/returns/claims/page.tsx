import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { ctn, dateLabel, docNo, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import CsvButton from '@/components/CsvButton';
import { claimAction } from '../actions';

type Row = {
  id: string;
  company: string;
  product: string;
  shop: string;
  qty_pcs: number;
  pcs_per_carton: number;
  condition: string;
  mode: string;
  batch_no: string | null;
  expiry_date: string | null;
  credit_note_no: number;
  created_at: string;
  cost_value: number;
  claim_ref: string | null;
};
type Res = {
  summary: { held_value: number; claimed_value: number; received_value: number };
  companies: { company: string; lines: number; pcs: number; value: number }[];
  rows: Row[];
};

const TABS = [
  { k: 'held', l: 'Held' },
  { k: 'claimed', l: 'Claimed' },
  { k: 'received', l: 'Received' },
];
const num = (v: unknown) => Number(v) || 0;

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const tab = TABS.some((t) => t.k === sp.tab) ? (sp.tab as string) : 'held';
  const { data, error } = await supabase.rpc('report_returned_goods', { p_status: tab });
  const r = data as Res | null;
  const next = tab === 'held' ? 'claimed' : tab === 'claimed' ? 'received' : null;

  return (
    <div className="space-y-4">
      <Link href="/returns" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Returns
      </Link>
      <PageHeader title="Returned goods" subtitle="Expired and damaged goods taken back, and claims from suppliers" />

      {sp.ok && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Updated.</div>}
      {sp.err && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{sp.err}</div>}
      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{error.message}</div>}

      {r && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3">
              <p className="text-[11px] font-semibold text-slate-500">Held (to claim)</p>
              <p className="truncate text-lg font-extrabold text-amber-600">{rs(num(r.summary.held_value))}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] font-semibold text-slate-500">Claimed, waiting</p>
              <p className="truncate text-lg font-extrabold text-indigo-700">{rs(num(r.summary.claimed_value))}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] font-semibold text-slate-500">Received</p>
              <p className="truncate text-lg font-extrabold text-emerald-700">{rs(num(r.summary.received_value))}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {TABS.map((t) => (
              <Link
                key={t.k}
                href={`/returns/claims?tab=${t.k}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  tab === t.k ? 'hero text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {t.l}
              </Link>
            ))}
          </div>

          {r.companies.length > 0 && (
            <div className="card divide-y divide-slate-100">
              <h2 className="p-4 pb-2 font-bold text-slate-900">By company</h2>
              {r.companies.map((c) => (
                <div key={c.company} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-900">
                    {c.company} <span className="text-xs text-slate-400">({num(c.lines)} lines)</span>
                  </span>
                  <span className="font-semibold text-slate-900">{rs(num(c.value))}</span>
                </div>
              ))}
            </div>
          )}

          <form action={claimAction} className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-bold text-slate-900">Lines ({r.rows.length})</h2>
              <CsvButton
                filename={`returned-goods-${tab}.csv`}
                headers={['Company', 'Product', 'Shop', 'Credit note', 'Condition', 'Batch', 'Expiry', 'Pcs', 'Cost value']}
                rows={r.rows.map((x) => [x.company, x.product, x.shop, docNo('CN-', x.credit_note_no), x.condition, x.batch_no ?? '', x.expiry_date ?? '', num(x.qty_pcs), num(x.cost_value)])}
              />
            </div>
            {r.rows.length === 0 && <p className="p-4 pt-0 text-sm text-slate-500">Nothing here.</p>}
            <div className="divide-y divide-slate-100">
              {r.rows.map((x) => (
                <label key={x.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {next && <input type="checkbox" name="ids" value={x.id} className="size-4 accent-indigo-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{x.product}</p>
                    <p className="truncate text-xs text-slate-500">
                      {x.company} · {x.shop} · {docNo('CN-', x.credit_note_no)} · {x.condition}
                      {x.mode === 'replace' ? ' · replaced' : ''}
                      {x.batch_no ? ` · Batch ${x.batch_no}` : ''}
                      {x.expiry_date ? ` · Exp ${dateLabel(x.expiry_date)}` : ''}
                    </p>
                    {x.claim_ref && <p className="text-[11px] text-slate-400">Ref: {x.claim_ref}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{ctn(num(x.qty_pcs), num(x.pcs_per_carton))}</p>
                    <p className="text-[11px] text-slate-400">{rs(num(x.cost_value))}</p>
                  </div>
                </label>
              ))}
            </div>

            {next && r.rows.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-4">
                <input type="hidden" name="status" value={next} />
                <input name="ref" className="field" placeholder={next === 'claimed' ? 'Claim / letter no. (optional)' : 'Company credit note no. (optional)'} />
                <button className="btn-primary w-full">
                  {next === 'claimed' ? 'Mark ticked lines as claimed' : 'Mark ticked lines as received'}
                </button>
              </div>
            )}
          </form>
          <p className="text-xs text-slate-500">
            Values use each product&apos;s last purchase cost. These goods are not in your sellable stock.
          </p>
        </>
      )}
    </div>
  );
}