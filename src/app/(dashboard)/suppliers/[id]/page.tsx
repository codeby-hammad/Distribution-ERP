import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Package, Phone } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, dateLabel, docNo, one, rs } from '@/lib/format';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/');

  const { data: sup } = await supabase
    .from('companies')
    .select('id, name, contact_name, phone, address, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!sup) notFound();

  const [{ data: stat }, { data: prods }, { data: grns }] = await Promise.all([
    supabase
      .from('supplier_stats')
      .select('total_purchased, purchase_count, last_on, product_count, investment')
      .eq('supplier_id', id)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, name, pcs_per_carton')
      .eq('company_id', id)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('grns')
      .select('id, grn_no, received_on, invoice_ref, total_cost, grn_items(count)')
      .eq('supplier_id', id)
      .order('received_on', { ascending: false })
      .order('grn_no', { ascending: false })
      .limit(50),
  ]);

  const ids = (prods ?? []).map((p) => p.id);
  const { data: ps } = ids.length
    ? await supabase.from('product_stats').select('product_id, stock_pcs, last_cost').in('product_id', ids)
    : { data: [] as { product_id: string; stock_pcs: number; last_cost: number | null }[] };
  const psMap = new Map((ps ?? []).map((x) => [x.product_id, x]));

  const boxes = [
    { l: 'Products', v: String(stat?.product_count ?? 0) },
    { l: 'Stock investment', v: rs(stat?.investment) },
    { l: 'Total purchased', v: rs(stat?.total_purchased) },
    { l: 'Last purchase', v: stat?.last_on ? dateLabel(stat.last_on) : '-' },
  ];

  return (
    <div className="space-y-4">
      <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Suppliers
      </Link>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="hero grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white">
            {sup.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900">{sup.name}</h1>
            <p className="truncate text-xs text-slate-500">
              {[sup.contact_name, sup.address].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {boxes.map((b) => (
            <div key={b.l} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">{b.l}</p>
              <p className="text-sm font-bold text-slate-900">{b.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {sup.phone && (
            <a href={`tel:${sup.phone}`} className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <Phone size={14} />
              {sup.phone}
            </a>
          )}
          <Link
            href={`/products?q=${encodeURIComponent(sup.name)}`}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600"
          >
            <Package size={14} />
            Open in Products & Stock
          </Link>
        </div>
        {sup.notes && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{sup.notes}</p>}
      </div>

      <div className="card">
        <h2 className="p-4 pb-2 font-bold text-slate-900">Products</h2>
        {!prods?.length ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No products yet. Edit a product and choose this supplier.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {prods.map((p) => {
              const s = psMap.get(p.id);
              const stock = Number(s?.stock_pcs ?? 0);
              const cost = s?.last_cost != null ? Number(s.last_cost) : null;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {stock > 0 ? ctn(stock, p.pcs_per_carton) : 'Out of stock'}
                      {cost != null && ` · cost ${rs(cost * p.pcs_per_carton)} / ctn`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {cost != null ? rs(Math.max(stock, 0) * cost) : '-'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="p-4 pb-2 font-bold text-slate-900">Purchase history</h2>
        {!grns?.length ? (
          <p className="p-8 text-center text-sm text-slate-400">No purchases from this supplier yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {grns.map((g) => {
              const items = one(g.grn_items as unknown as { count: number } | { count: number }[] | null)?.count ?? 0;
              return (
                <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {docNo('GRN-', g.grn_no)}
                      {g.invoice_ref ? ` · Bill ${g.invoice_ref}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dateLabel(g.received_on)} · {items} {items === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{rs(g.total_cost)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}