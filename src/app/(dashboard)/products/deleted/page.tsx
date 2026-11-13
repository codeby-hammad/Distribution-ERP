import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ArchiveRestore, CheckCircle2, ShieldAlert } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

export default async function DeletedProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/products');

  async function restoreProduct(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) redirect('/products');

    const { error } = await supabase
      .from('products')
      .update({ deleted_at: null })
      .eq('id', String(fd.get('id') ?? ''))
      .not('deleted_at', 'is', null);

    if (error) {
      const msg =
        error.code === '23505'
          ? 'Cannot restore: another product now uses the same SKU or barcode. Change that one first.'
          : error.message;
      redirect('/products/deleted?error=' + encodeURIComponent(msg));
    }

    revalidatePath('/products');
    revalidatePath('/products/deleted');
    redirect('/products/deleted?ok=' + encodeURIComponent('Product restored'));
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, sku, pcs_per_carton, price_per_pcs, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  const ids = (products ?? []).map((p) => p.id);
  const stockMap = new Map<string, number>();
  if (ids.length) {
    const { data: soh } = await supabase
      .from('stock_on_hand')
      .select('product_id, qty_pcs')
      .in('product_id', ids);
    for (const s of soh ?? []) {
      stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + Number(s.qty_pcs));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Deleted products" subtitle={`${products?.length ?? 0} hidden from the catalogue`} />

      <Link href="/products" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
        &larr; Back to products
      </Link>

      {sp.ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{sp.ok}</p>
        </div>
      )}
      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{sp.error}</p>
        </div>
      )}

      {!products?.length ? (
        <EmptyState icon={ArchiveRestore} title="No deleted products" hint="Deleted products will appear here." />
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const stock = stockMap.get(p.id) ?? 0;
            const pcs = p.pcs_per_carton as number;
            return (
              <div key={p.id} className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[p.brand, p.sku].filter(Boolean).join(' · ') || 'No brand or SKU'} · {pcs} pcs/ctn ·{' '}
                    {rs(Number(p.price_per_pcs) * pcs)} / ctn
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Deleted {new Date(p.deleted_at as string).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })}
                  </p>
                  {stock > 0 && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">
                      Still has {ctn(stock, pcs)} in stock. Restore it to manage this stock.
                    </p>
                  )}
                </div>
                <form action={restoreProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                    <ArchiveRestore size={15} />
                    Restore
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}