import { createClient } from '@/lib/supabase/server';
import { one } from '@/lib/format';
import EditOrder from './EditOrder';
import { editOrderAction } from '@/app/(dashboard)/orders/[id]/actions';

type Prod = { name: string; pcs_per_carton: number; price_per_pcs: number };

export default async function EditOrderSection({ orderId, discount }: { orderId: string; discount: number }) {
  const supabase = await createClient();

  const [{ data: items }, { data: products }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, qty_pcs, products(name, pcs_per_carton, price_per_pcs)')
      .eq('order_id', orderId)
      .eq('is_bonus', false),
    supabase
      .from('products')
      .select('id, name, pcs_per_carton, price_per_pcs')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ]);

  const lines = (items ?? []).map((it) => {
    const p = one(it.products as unknown as Prod | Prod[] | null);
    return {
      id: it.id as string,
      name: p?.name ?? 'Product',
      perCarton: p?.pcs_per_carton ?? 1,
      rate: Number(p?.price_per_pcs ?? 0),
      qty: Number(it.qty_pcs),
    };
  });

  const usedNames = new Set(lines.map((l) => l.name));
  const all = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    perCarton: Number(p.pcs_per_carton),
    rate: Number(p.price_per_pcs),
  }));

  return (
    <EditOrder
      orderId={orderId}
      discount={discount}
      lines={lines}
      products={all.filter((p) => !usedNames.has(p.name))}
      submit={editOrderAction}
    />
  );
}