import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, docNo, one, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import ReturnForm from './ReturnForm';
import { createReturnAction } from '../actions';

type Prod = { name: string; pcs_per_carton: number };

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; invoice?: string }>;
}) {
  const { shop: shopId, invoice: invoiceId } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const [{ data: shops }, { data: warehouses }] = await Promise.all([
    supabase.from('shops').select('id, name').is('deleted_at', null).order('name').limit(2000),
    supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const shop = (shops ?? []).find((s) => s.id === shopId);

  let invoices: { id: string; invoice_no: number; total: number; created_at: string }[] = [];
  if (shop) {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_no, total, created_at')
      .eq('shop_id', shop.id)
      .not('delivered_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    invoices = data ?? [];
  }

  const invoice = invoices.find((i) => i.id === invoiceId) ?? null;

  let lines: { itemId: string; productId: string; name: string; perCarton: number; remaining: number; rate: number }[] = [];
  let products: { id: string; name: string; perCarton: number; rate: number }[] = [];

  if (shop && invoice) {
    const [{ data: inv }, { data: items }] = await Promise.all([
      supabase.from('invoices').select('subtotal, total').eq('id', invoice.id).maybeSingle(),
      supabase
        .from('invoice_items')
        .select('id, product_id, qty_pcs, amount, is_bonus, delivered_qty, products(name, pcs_per_carton)')
        .eq('invoice_id', invoice.id),
    ]);
    const ids = (items ?? []).map((i) => i.id as string);
    const { data: done } = ids.length
      ? await supabase.from('sales_return_items').select('invoice_item_id, qty_pcs').in('invoice_item_id', ids)
      : { data: [] as { invoice_item_id: string; qty_pcs: number }[] };

    const returned = new Map<string, number>();
    for (const d of done ?? []) returned.set(d.invoice_item_id, (returned.get(d.invoice_item_id) ?? 0) + Number(d.qty_pcs));

    const ratio = inv && Number(inv.subtotal) > 0 ? Number(inv.total) / Number(inv.subtotal) : 1;

    lines = (items ?? [])
      .map((it) => {
        const p = one(it.products as unknown as Prod | Prod[] | null);
        const remaining = Math.max(Number(it.delivered_qty ?? 0) - (returned.get(it.id as string) ?? 0), 0);
        const rate = it.is_bonus || !Number(it.qty_pcs) ? 0 : (Number(it.amount) / Number(it.qty_pcs)) * ratio;
        return {
          itemId: it.id as string,
          productId: it.product_id as string,
          name: (p?.name ?? 'Product') + (it.is_bonus ? ' (bonus)' : ''),
          perCarton: p?.pcs_per_carton ?? 1,
          remaining,
          rate,
        };
      })
      .filter((l) => l.remaining > 0);
  } else if (shop && invoiceId === 'none') {
    const { data } = await supabase
      .from('products')
      .select('id, name, pcs_per_carton, price_per_pcs')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name');
    products = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      perCarton: p.pcs_per_carton,
      rate: Number(p.price_per_pcs),
    }));
  }

  const mode = shop && invoice ? 'invoice' : shop && invoiceId === 'none' ? 'free' : null;

  return (
    <div className="space-y-4">
      <Link href="/returns" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Returns
      </Link>
      <PageHeader title="New credit note" subtitle="Goods taken back from a shop" />

      <form method="get" className="card space-y-3 p-4">
        <div>
          <label className="label">1. Shop</label>
          <div className="flex gap-2">
            <select name="shop" defaultValue={shop?.id ?? ''} required className="field">
              <option value="" disabled>Select a shop</option>
              {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button className="btn-primary shrink-0 px-4">Next</button>
          </div>
        </div>
      </form>

      {shop && (
        <div className="card space-y-2 p-4">
          <p className="label">2. Which invoice are the goods from?</p>
          {invoices.map((i) => (
            <Link
              key={i.id}
              href={`/returns/new?shop=${shop.id}&invoice=${i.id}`}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ring-1 ${
                invoice?.id === i.id ? 'bg-indigo-50 ring-indigo-300' : 'bg-white ring-slate-200'
              }`}
            >
              <span className="font-semibold text-slate-900">
                {docNo('INV-', i.invoice_no)} · {dateLabel(i.created_at)}
              </span>
              <span className="text-slate-600">{rs(i.total)}</span>
            </Link>
          ))}
          <Link
            href={`/returns/new?shop=${shop.id}&invoice=none`}
            className={`block rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${
              invoiceId === 'none' ? 'bg-indigo-50 text-indigo-700 ring-indigo-300' : 'bg-white text-slate-700 ring-slate-200'
            }`}
          >
            No invoice (old goods, credit at today&apos;s price list)
          </Link>
        </div>
      )}

      {mode && shop && (
        <ReturnForm
          shopId={shop.id}
          invoiceId={mode === 'invoice' ? invoice!.id : null}
          warehouses={warehouses ?? []}
          lines={lines}
          products={products}
          submit={createReturnAction}
        />
      )}
    </div>
  );
}