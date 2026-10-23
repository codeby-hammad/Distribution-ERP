import type { SupabaseClient } from '@supabase/supabase-js';
import type { createClient } from '@/lib/supabase/server';
import { one } from '@/lib/format';
import { getCompany } from '@/lib/company';

type Db = Awaited<ReturnType<typeof createClient>>;

export type InvoiceLine = {
  id: string;
  name: string;
  qty: number;
  perCarton: number;
  rate: number;
  amount: number;
  bonus: boolean;
  delivered: number | null;
};

export type InvoiceData = {
  id: string;
  no: number;
  date: string;
  status: string;
  orderNo: number | null;
  shop: { name: string; owner: string | null; phone: string | null; address: string | null; taxStatus: string; ntn: string | null };
  subtotal: number;
  discount: number;
  total: number;
  returned: number;
  collected: number;
  previous: number;
  net: number;
  lines: InvoiceLine[];
};

type ShopRef = { name: string; owner_name: string | null; phone: string | null; address: string | null; tax_status: string | null; buyer_ntn: string | null };
type OrderRef = { order_no: number };
type Prod = { name: string; pcs_per_carton: number };

export async function loadInvoices(supabase: Db, filter: { id?: string; tripId?: string }) {
  let q = supabase
    .from('invoices')
    .select(
      'id, invoice_no, status, subtotal, discount, total, previous_balance, returned_value, collected, created_at, shop_id, shops(name, owner_name, phone, address, tax_status, buyer_ntn), orders(order_no), invoice_items(id, qty_pcs, rate, is_bonus, amount, delivered_qty, products(name, pcs_per_carton))'
    );

  if (filter.id) q = q.eq('id', filter.id);
  if (filter.tripId) q = q.eq('trip_id', filter.tripId);

  const [{ data: rows }, company] = await Promise.all([q, getCompany(supabase as unknown as SupabaseClient)]);

  const shopIds = [...new Set((rows ?? []).map((r) => r.shop_id as string))];
  const { data: bals } = shopIds.length
    ? await supabase.from('shop_balances').select('shop_id, ledger_balance').in('shop_id', shopIds)
    : { data: [] as { shop_id: string; ledger_balance: number }[] };

  const balMap = new Map((bals ?? []).map((b) => [b.shop_id, Number(b.ledger_balance)]));

    // Open (unsettled) bills are not in the ledger yet, so earlier ones must count as "previous" for later ones
  const { data: open } = shopIds.length
    ? await supabase
        .from('invoices')
        .select('shop_id, invoice_no, total')
        .in('shop_id', shopIds)
        .eq('status', 'issued')
    : { data: [] as { shop_id: string; invoice_no: number; total: number }[] };

  const invoices: InvoiceData[] = (rows ?? []).map((r) => {
    const shop = one(r.shops as unknown as ShopRef | ShopRef[] | null);
    const ord = one(r.orders as unknown as OrderRef | OrderRef[] | null);

    const settled = r.status !== 'issued';
    const total = Number(r.total);
    const returned = Number(r.returned_value ?? 0);
    const collected = Number(r.collected ?? 0);
    const earlierOpen = (open ?? [])
      .filter((o) => o.shop_id === r.shop_id && Number(o.invoice_no) < Number(r.invoice_no))
      .reduce((s, o) => s + Number(o.total), 0);
    const previous = settled ? Number(r.previous_balance ?? 0) : (balMap.get(r.shop_id) ?? 0) + earlierOpen;
    

    const lines: InvoiceLine[] = ((r.invoice_items ?? []) as Record<string, unknown>[])
      .map((it) => {
        const prod = one(it.products as Prod | Prod[] | null);
        return {
          id: it.id as string,
          name: prod?.name ?? 'Product',
          qty: Number(it.qty_pcs),
          perCarton: prod?.pcs_per_carton ?? 1,
          rate: Number(it.rate),
          amount: Number(it.amount),
          bonus: Boolean(it.is_bonus),
          delivered: it.delivered_qty == null ? null : Number(it.delivered_qty),
        };
      })
      .sort((a, b) => Number(a.bonus) - Number(b.bonus) || a.name.localeCompare(b.name));

    return {
      id: r.id,
      no: r.invoice_no,
      date: r.created_at,
      status: r.status,
      orderNo: ord?.order_no ?? null,
            shop: {
        name: shop?.name ?? 'Unknown shop',
        owner: shop?.owner_name ?? null,
        phone: shop?.phone ?? null,
        address: shop?.address ?? null,
        taxStatus: shop?.tax_status ?? 'unknown',
        ntn: shop?.buyer_ntn ?? null,
      },
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      total,
      returned,
      collected,
      previous,
      net: previous + total - returned - collected,
      lines,
    };
  });

  invoices.sort((a, b) => a.shop.name.localeCompare(b.shop.name) || a.no - b.no);

  return { tenantName: company.name, company, invoices };
}