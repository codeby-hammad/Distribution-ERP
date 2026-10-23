import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import NewOrderForm from './NewOrderForm';

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const sp = await searchParams;
    const { supabase } = await requireProfile();

  async function createOrder(payload: string): Promise<{ id?: string; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: { items?: Record<string, unknown>[] };
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid order data' };
    }
    if (!body.items?.length) return { error: 'Add at least one product' };

    const withIds = {
      ...body,
      items: body.items.map((i) => ({ ...i, id: crypto.randomUUID() })),
    };

    const { data, error } = await supabase.rpc('submit_order', { p: withIds });
    if (error) return { error: error.message };

    revalidatePath('/orders');
    return { id: data as string };
  }

  const [{ data: shops }, { data: balances }, { data: products }] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, credit_limit, opening_balance')
      .is('deleted_at', null)
      .order('name'),
    supabase.from('shop_balances').select('shop_id, outstanding'),
    supabase
      .from('products')
      .select('id, name, pcs_per_carton, price_per_pcs')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ]);

  const balMap = new Map((balances ?? []).map((b) => [b.shop_id, Number(b.outstanding)]));

  return (
    <div>
      <PageHeader title="New order" subtitle="Book an order for a shop" />
      <NewOrderForm
        submit={createOrder}
         initialShopId={(shops ?? []).some((s) => s.id === sp.shop) ? sp.shop : ''}
        shops={(shops ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          creditLimit: Number(s.credit_limit),
          outstanding: balMap.get(s.id) ?? Number(s.opening_balance),
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          pcsPerCarton: p.pcs_per_carton,
          price: Number(p.price_per_pcs),
        }))}
      />
    </div>
  );
}