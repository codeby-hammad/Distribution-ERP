import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import { saveShopTaxAction } from './actions';

export default async function ShopTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; err?: string }>;
}) {
  const { q = '', ok, err } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/shops');

  let query = supabase
    .from('shops')
    .select('id, name, tax_status, buyer_ntn')
    .is('deleted_at', null)
    .order('name')
    .limit(300);
  if (q.trim()) query = query.ilike('name', `%${q.trim().replace(/[%,]/g, '')}%`);
  const { data } = await query;
  const shops = data ?? [];

  const count = (s: string) => shops.filter((x) => x.tax_status === s).length;

  return (
    <div className="space-y-4">
      <Link href="/shops" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Shops
      </Link>
      <PageHeader title="Shop tax status" subtitle="Mark each shop as filer or non-filer" />

      {ok && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Saved.</div>}
      {err && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{err}</div>}

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Filer', v: count('filer') },
          { l: 'Non-filer', v: count('non_filer') },
          { l: 'Not set', v: count('unknown') },
        ].map((b) => (
          <div key={b.l} className="card p-3">
            <p className="text-xl font-extrabold text-slate-900">{b.v}</p>
            <p className="text-[11px] font-semibold text-slate-500">{b.l}</p>
          </div>
        ))}
      </div>

      <form method="get" className="relative">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input name="q" defaultValue={q} placeholder="Search shop name" className="field pl-10" />
      </form>

      <div className="space-y-2">
        {shops.map((s) => (
          <form key={s.id} action={saveShopTaxAction} className="card flex flex-wrap items-center gap-2 p-3">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="q" value={q} />
            <p className="min-w-0 flex-1 basis-40 truncate font-semibold text-slate-900">{s.name}</p>
            <select name="status" defaultValue={s.tax_status ?? 'unknown'} className="field w-36 py-2">
              <option value="unknown">Not set</option>
              <option value="filer">Filer</option>
              <option value="non_filer">Non-filer</option>
            </select>
            <input name="ntn" defaultValue={s.buyer_ntn ?? ''} placeholder="NTN / CNIC" className="field w-40 py-2" />
            <button className="btn-primary px-4 py-2">Save</button>
          </form>
        ))}
        {shops.length === 0 && <p className="card p-4 text-sm text-slate-500">No shops found.</p>}
      </div>
    </div>
  );
}