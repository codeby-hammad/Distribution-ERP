import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile, canManage } from '@/lib/auth';
import { one, todayPK } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import NewTripForm from './NewTripForm';

type ShopRef = { name: string; route_id: string | null; routes: { name: string } | { name: string }[] | null };

export default async function NewTripPage() {
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/trips');

  async function createTrip(payload: string): Promise<{ id?: string; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }

    const { data, error } = await supabase.rpc('create_trip', { p: body });
    if (error) return { error: error.message };

    revalidatePath('/trips');
    revalidatePath('/orders');
    return { id: data as string };
  }

  const [{ data: orders }, { data: routes }, { data: warehouses }, { data: men }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('id, order_no, total, booked_at, shops(name, route_id, routes(name))')
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('booked_at'),
      supabase.from('routes').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('warehouses').select('id, name').is('deleted_at', null).order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, vehicle_no')
        .eq('role', 'delivery')
        .eq('is_active', true)
        .order('full_name'),
    ]);

  return (
    <div>
      <PageHeader title="New trip" subtitle="Pick approved orders to deliver together" />
      <NewTripForm
        submit={createTrip}
        today={todayPK()}
        routes={routes ?? []}
        warehouses={warehouses ?? []}
        deliveryMen={(men ?? []).map((m) => ({
          id: m.id,
          name: m.full_name,
          vehicle: (m.vehicle_no as string | null) ?? '',
        }))}
        orders={(orders ?? []).map((o) => {
          const s = one(o.shops as unknown as ShopRef | ShopRef[] | null);
          return {
            id: o.id,
            no: o.order_no,
            total: Number(o.total),
            shop: s?.name ?? 'Unknown shop',
            routeId: s?.route_id ?? null,
            routeName: one(s?.routes ?? null)?.name ?? 'No route',
          };
        })}
      />
    </div>
  );
}