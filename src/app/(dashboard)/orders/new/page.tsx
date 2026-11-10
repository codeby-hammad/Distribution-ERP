import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import NewOrderForm, { type Scheme } from './NewOrderForm';

type SchemeRow = {
  id: string;
  name: string;
  scope: 'product' | 'company';
  product_id: string | null;
  company_id: string | null;
  type: 'bonus' | 'percent' | 'flat';
  unit?: 'ctn' | 'pcs';
  min_cartons: number | null;
  bonus_cartons: number | null;
  percent: number | null;
  flat_per_carton: number | null;
  valid_from: string;
  valid_to: string;
};

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

  const [{ data: shops }, { data: balances }, { data: products }, schemeRes] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, credit_limit, opening_balance')
      .is('deleted_at', null)
      .order('name'),
    supabase.from('shop_balances').select('shop_id, outstanding'),
    supabase
      .from('products')
      .select('id, name, pcs_per_carton, price_per_pcs, company_id')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
    supabase.rpc('my_active_schemes'),
  ]);

  const balMap = new Map((balances ?? []).map((b) => [b.shop_id, Number(b.outstanding)]));

  const schemesFailed = Boolean(schemeRes.error) || !Array.isArray(schemeRes.data);
  const schemes: Scheme[] = schemesFailed
    ? []
    : (schemeRes.data as SchemeRow[]).map((s) => ({
        id: s.id,
        name: s.name,
        scope: s.scope,
        productId: s.product_id,
        companyId: s.company_id,
        type: s.type,
        unit: s.unit === 'pcs' ? 'pcs' : 'ctn',
        minQty: Number(s.min_cartons ?? 0),
        bonusQty: Number(s.bonus_cartons ?? 0),
        percent: Number(s.percent ?? 0),
        flatPerCarton: Number(s.flat_per_carton ?? 0),
        validFrom: String(s.valid_from),
        validTo: String(s.valid_to),
      }));

  return (
    <div>
      <PageHeader title="New order" subtitle="Book an order for a shop" />
      <NewOrderForm
        submit={createOrder}
        initialShopId={(shops ?? []).some((s) => s.id === sp.shop) ? sp.shop : ''}
        schemes={schemes}
        schemesFailed={schemesFailed}
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
          companyId: p.company_id ?? null,
        }))}
      />
    </div>
  );
}