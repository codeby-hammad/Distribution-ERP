import type { createClient } from '@/lib/supabase/server';
import { one, todayPK } from '@/lib/format';

type Db = Awaited<ReturnType<typeof createClient>>;

export type SheetLine = {
  productId: string;
  name: string;
  perCarton: number;
  qty: number;
  have: number | null;
};
export type Pick = {
  name: string;
  perCarton: number;
  batch: string | null;
  expiry: string | null;
  qty: number;
};
export type TripOrder = { id: string; no: number; total: number; shop: string; address: string | null };

type Prod = { name: string; pcs_per_carton: number };
type ShopRef = { name: string; address: string | null };
type OrdRef = { id: string; order_no: number; total: number; shops: ShopRef | ShopRef[] | null };
type Named = { name: string };

export async function loadTripData(supabase: Db, id: string) {
  const { data: trip } = await supabase
    .from('delivery_trips')
    .select(
      'id, trip_no, trip_date, status, vehicle_no, loaded_at, warehouse_id, delivery_man_id, routes(name), warehouses(name)'
    )
    .eq('id', id)
    .maybeSingle();

  if (!trip) return null;

  let driver: string | null = null;
  if (trip.delivery_man_id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', trip.delivery_man_id)
      .maybeSingle();
    driver = data?.full_name ?? null;
  }

  const { data: tos } = await supabase
    .from('trip_orders')
    .select('order_id, orders(id, order_no, total, shops(name, address))')
    .eq('trip_id', id);

  const orders: TripOrder[] = (tos ?? [])
    .map((t) => {
      const o = one(t.orders as unknown as OrdRef | OrdRef[] | null);
      const s = one(o?.shops ?? null);
      return {
        id: o?.id ?? (t.order_id as string),
        no: o?.order_no ?? 0,
        total: Number(o?.total ?? 0),
        shop: s?.name ?? 'Unknown shop',
        address: s?.address ?? null,
      };
    })
    .sort((a, b) => a.shop.localeCompare(b.shop));

  const lineMap = new Map<string, SheetLine>();
  if (orders.length) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, qty_pcs, products(name, pcs_per_carton)')
      .in('order_id', orders.map((o) => o.id));

    for (const it of items ?? []) {
      const p = one(it.products as unknown as Prod | Prod[] | null);
      const cur = lineMap.get(it.product_id) ?? {
        productId: it.product_id as string,
        name: p?.name ?? 'Product',
        perCarton: p?.pcs_per_carton ?? 1,
        qty: 0,
        have: null,
      };
      cur.qty += Number(it.qty_pcs);
      lineMap.set(it.product_id, cur);
    }
  }

  if (trip.status === 'draft' && lineMap.size) {
    const today = todayPK();
    const { data: stock } = await supabase
      .from('stock_on_hand')
      .select('product_id, qty_pcs, expiry_date')
      .eq('warehouse_id', trip.warehouse_id)
      .in('product_id', [...lineMap.keys()])
      .gt('qty_pcs', 0);

    const have = new Map<string, number>();
    for (const s of stock ?? []) {
      if (s.expiry_date && s.expiry_date < today) continue;
      have.set(s.product_id, (have.get(s.product_id) ?? 0) + Number(s.qty_pcs));
    }
    for (const l of lineMap.values()) l.have = have.get(l.productId) ?? 0;
  }

  let picks: Pick[] = [];
  if (trip.status !== 'draft' && trip.status !== 'cancelled') {
    const { data: moves } = await supabase
      .from('stock_movements')
      .select('batch_no, expiry_date, qty_pcs, products(name, pcs_per_carton)')
      .eq('ref_type', 'trip')
      .eq('ref_id', id);

    picks = (moves ?? [])
      .map((m) => {
        const p = one(m.products as unknown as Prod | Prod[] | null);
        return {
          name: p?.name ?? 'Product',
          perCarton: p?.pcs_per_carton ?? 1,
          batch: m.batch_no as string | null,
          expiry: m.expiry_date as string | null,
          qty: Math.abs(Number(m.qty_pcs)),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    id: trip.id as string,
    no: trip.trip_no as number,
    date: trip.trip_date as string,
    status: trip.status as string,
    vehicle: (trip.vehicle_no as string | null) ?? null,
    route: one(trip.routes as unknown as Named | Named[] | null)?.name ?? null,
    warehouse: one(trip.warehouses as unknown as Named | Named[] | null)?.name ?? null,
    driver,
    orders,
    lines: [...lineMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    picks,
  };
}