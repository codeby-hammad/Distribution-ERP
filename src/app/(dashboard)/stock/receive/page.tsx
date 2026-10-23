import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import ReceiveForm from './ReceiveForm';

export default async function ReceivePage() {
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager', 'warehouse'].includes(profile.role)) redirect('/products');

  async function receive(payload: string): Promise<{ id?: string; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: { items?: Record<string, unknown>[] };
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }
    if (!body.items?.length) return { error: 'Add at least one item' };

    const withIds = {
      ...body,
      items: body.items.map((i) => ({ ...i, id: crypto.randomUUID() })),
    };

    const { data, error } = await supabase.rpc('post_grn', { p: withIds });
    if (error) return { error: error.message };

    revalidatePath('/products');
    revalidatePath('/stock');
    revalidatePath('/suppliers');
    return { id: data as string };
  }

  const [{ data: warehouses }, { data: suppliers }, { data: products }, { data: stats }] = await Promise.all([
    supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('companies').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('products')
      .select('id, name, pcs_per_carton')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
    supabase.from('product_stats').select('product_id, last_cost, last_purchase_on, last_supplier'),
  ]);

  const statMap = new Map((stats ?? []).map((s) => [s.product_id as string, s]));

  return (
    <div>
      <PageHeader title="Receive stock" subtitle="Record goods received from a supplier" />
      <ReceiveForm
        submit={receive}
        today={todayPK()}
        warehouses={warehouses ?? []}
        suppliers={suppliers ?? []}
        products={(products ?? []).map((p) => {
          const st = statMap.get(p.id as string);
          const perPcs = Number(st?.last_cost ?? 0);
          return {
            id: p.id,
            name: p.name,
            pcsPerCarton: p.pcs_per_carton,
            lastCostCarton: perPcs > 0 ? Math.round(perPcs * Number(p.pcs_per_carton) * 100) / 100 : null,
            lastOn: (st?.last_purchase_on as string | null) ?? null,
            lastSupplier: (st?.last_supplier as string | null) ?? null,
          };
        })}
      />
    </div>
  );
}