import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CheckCircle2, PackageX, ShieldAlert } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, dateLabel, rs, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SettleClaim from '@/components/SettleClaim';

type ClaimRow = {
  id: string;
  claim_no: number;
  company_id: string | null;
  status: string;
  note: string | null;
  sent_value: number;
  recovered_value: number;
  loss_value: number;
  created_at: string;
  settled_at: string | null;
  expiry_claim_items: { product_id: string; qty_pcs: number; unit_cost: number | null }[];
};

const back = (kind: 'ok' | 'error', msg: string) =>
  redirect(`/stock/expired?${kind}=` + encodeURIComponent(msg));

export default async function ExpiredStockPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/products');

  async function sendClaim(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) redirect('/products');

    const sel = fd.getAll('sel').map(String);
    if (!sel.length) back('error', 'Select at least one expired batch');
    const parts = sel.map((s) => s.split('|'));
    const whs = new Set(parts.map((p) => p[0]));
    if (whs.size > 1) back('error', 'Select batches from one warehouse at a time');

    const { data, error } = await supabase.rpc('send_expiry_claim', {
      p: {
        id: crypto.randomUUID(),
        company_id: String(fd.get('company_id') ?? ''),
        warehouse_id: parts[0][0],
        note: String(fd.get('note') ?? ''),
        items: parts.map((p) => ({ product_id: p[1], batch_no: p[2] || null, expiry_date: p[3] })),
      },
    });
    if (error) back('error', error.message.replace(/^[A-Z_]+:\s*/, ''));

    const r = data as { claim_no?: number; sent_value?: number } | null;
    revalidatePath('/stock/expired');
    revalidatePath('/products');
    back('ok', `Claim EC-${String(r?.claim_no ?? '').padStart(5, '0')} sent. Value ${rs(Number(r?.sent_value ?? 0))}`);
  }

  async function writeOffOnly(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) redirect('/products');

    const sel = fd.getAll('sel').map(String);
    if (!sel.length) back('error', 'Select at least one expired batch');
    let loss = 0;
    for (const s of sel) {
      const [wh, prod, batch, exp] = s.split('|');
      const { data, error } = await supabase.rpc('write_off_expired', {
        p: { id: crypto.randomUUID(), warehouse_id: wh, product_id: prod, batch_no: batch || null, expiry_date: exp, note: String(fd.get('note') ?? '') },
      });
      if (error) back('error', error.message.replace(/^[A-Z_]+:\s*/, ''));
      loss += Number((data as { loss?: number } | null)?.loss ?? 0);
    }
    revalidatePath('/stock/expired');
    revalidatePath('/products');
    back('ok', `Written off without a claim. Loss ${rs(loss)}`);
  }

  async function settle(payload: string): Promise<{ ok?: boolean; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();
    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }
    const { error } = await supabase.rpc('settle_expiry_claim', { p: body });
    if (error) return { error: error.message };
    revalidatePath('/stock/expired');
    revalidatePath('/products');
    return { ok: true };
  }

  const today = todayPK();

  const [sohRes, claimRes, compRes, prodRes] = await Promise.all([
    supabase
      .from('stock_on_hand')
      .select('warehouse_id, product_id, batch_no, expiry_date, qty_pcs')
      .gt('qty_pcs', 0)
      .lt('expiry_date', today)
      .order('expiry_date', { ascending: true }),
    supabase
      .from('expiry_claims')
      .select('id, claim_no, company_id, status, note, sent_value, recovered_value, loss_value, created_at, settled_at, expiry_claim_items(product_id, qty_pcs, unit_cost)')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('companies').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('products').select('id, name, brand, company_id, pcs_per_carton').is('deleted_at', null).order('name'),
  ]);

  const products = prodRes.data ?? [];
  const pmap = new Map(products.map((p) => [p.id, p]));
  const companies = compRes.data ?? [];
  const cname = new Map(companies.map((c) => [c.id, c.name]));
  const claims = (claimRes.data ?? []) as unknown as ClaimRow[];
  const open = claims.filter((c) => c.status === 'sent');
  const done = claims.filter((c) => c.status === 'settled').slice(0, 10);

  const ids = Array.from(new Set((sohRes.data ?? []).map((r) => r.product_id)));
  const [statRes, whRes] = await Promise.all([
    ids.length
      ? supabase.from('product_stats').select('product_id, last_cost').in('product_id', ids)
      : Promise.resolve({ data: [] as { product_id: string; last_cost: number | null }[] }),
    supabase.from('warehouses').select('id, name').is('deleted_at', null),
  ]);
  const cost = new Map((statRes.data ?? []).map((s) => [s.product_id, s.last_cost != null ? Number(s.last_cost) : null]));
  const wh = new Map((whRes.data ?? []).map((w) => [w.id, w.name]));

  const rows = (sohRes.data ?? []).map((r) => {
    const p = pmap.get(r.product_id);
    const qty = Number(r.qty_pcs);
    const c = cost.get(r.product_id) ?? null;
    return { ...r, qty, name: p?.name ?? 'Product', brand: p?.brand ?? null, pcs: p?.pcs_per_carton ?? 1, loss: c != null ? qty * c : null, warehouse: wh.get(r.warehouse_id) ?? '' };
  });
  const totalLoss = rows.reduce((s, r) => s + (r.loss ?? 0), 0);
  const openValue = open.reduce((s, c) => s + Number(c.sent_value), 0);
  const settleProducts = products.map((p) => ({ id: p.id, name: p.name, pcs: p.pcs_per_carton as number }));

  return (
    <div className="space-y-5">
      <PageHeader title="Expired stock" subtitle="Send to company, then record replacement, exchange or credit" />

      <Link href="/products" className="text-sm font-semibold text-slate-500 hover:text-slate-800">&larr; Back to products</Link>

      {sp.ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /><p>{sp.ok}</p>
        </div>
      )}
      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" /><p>{sp.error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Expired on your books</p>
          <p className="text-xl font-extrabold text-red-600">{rs(totalLoss)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Waiting for company ({open.length})</p>
          <p className="text-xl font-extrabold text-amber-600">{rs(openValue)}</p>
        </div>
      </div>

      {/* 1. Expired batches */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-900">1. Expired batches ({rows.length})</h2>
        {!rows.length ? (
          <EmptyState icon={PackageX} title="No expired stock" hint="Expired batches will appear here." />
        ) : (
          <form className="space-y-3">
            <div className="space-y-2">
              {rows.map((r, i) => (
                <label key={i} className="card flex cursor-pointer items-center gap-3 p-3">
                  <input type="checkbox" name="sel" value={`${r.warehouse_id}|${r.product_id}|${r.batch_no ?? ''}|${r.expiry_date}`} className="size-5 accent-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {[r.brand, r.batch_no ? `Batch ${r.batch_no}` : 'No batch', r.warehouse].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs font-semibold text-red-600">Expired {dateLabel(r.expiry_date as string)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{ctn(r.qty, r.pcs)}</p>
                    <p className="text-xs text-slate-500">{r.loss != null ? rs(r.loss) : 'No cost'}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="card space-y-2 p-3">
              <label className="label">Company to claim from</label>
              <select name="company_id" className="field">
                <option value="">Choose company</option>
                {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <input name="note" placeholder="Note (optional)" className="field text-sm" />
              <div className="flex gap-2">
                <button formAction={sendClaim} className="btn-primary flex-1">Send selected to company</button>
                <button formAction={writeOffOnly} className="rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100">
                  Write off, no claim
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* 2. Open claims */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-900">2. Claims waiting for the company ({open.length})</h2>
        {!open.length && <p className="text-sm text-slate-400">No open claims.</p>}
        {open.map((c) => (
          <div key={c.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">EC-{String(c.claim_no).padStart(5, '0')} · {cname.get(c.company_id ?? '') ?? 'Company'}</p>
                <p className="text-xs text-slate-500">Sent {dateLabel(c.created_at.slice(0, 10))}{c.note ? ` · ${c.note}` : ''}</p>
              </div>
              <p className="font-bold text-amber-600">{rs(Number(c.sent_value))}</p>
            </div>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {c.expiry_claim_items.map((it, i) => {
                const p = pmap.get(it.product_id);
                return <li key={i}>{p?.name ?? 'Product'}: {ctn(it.qty_pcs, p?.pcs_per_carton ?? 1)}</li>;
              })}
            </ul>
            <SettleClaim
              claimId={c.id}
              sentValue={Number(c.sent_value)}
              products={settleProducts}
              submit={settle}
              items={c.expiry_claim_items.map((it) => {
                const p = pmap.get(it.product_id);
                return { productId: it.product_id, name: p?.name ?? 'Product', qty: it.qty_pcs, pcs: p?.pcs_per_carton ?? 1, unitCost: Number(it.unit_cost ?? 0) };
              })}
            />
          </div>
        ))}
      </section>

      {/* 3. Settled */}
      {!!done.length && (
        <section className="space-y-2">
          <h2 className="font-bold text-slate-900">3. Recently settled</h2>
          {done.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">EC-{String(c.claim_no).padStart(5, '0')} · {cname.get(c.company_id ?? '') ?? 'Company'}</p>
                <p className="text-xs text-slate-500">Sent {rs(Number(c.sent_value))} · Received {rs(Number(c.recovered_value))}</p>
              </div>
              <p className={`font-bold ${Number(c.loss_value) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {Number(c.loss_value) > 0 ? `Loss ${rs(Number(c.loss_value))}` : 'No loss'}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}