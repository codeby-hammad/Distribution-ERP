import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { one } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import SettleForm from './SettleForm';

type Prod = { name: string; pcs_per_carton: number };

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  if (!['owner', 'manager', 'cashier'].includes(profile.role)) redirect(`/trips/${id}`);

  async function settle(payload: string): Promise<{ ok?: boolean; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }

    const { error } = await supabase.rpc('settle_trip', { p: { ...body, trip_id: id } });
    if (error) return { error: error.message };

    revalidatePath('/trips');
    revalidatePath(`/trips/${id}`);
    revalidatePath('/orders');
    revalidatePath('/stock');
    revalidatePath('/shops');
    return { ok: true };
  }

  const { data: trip } = await supabase
    .from('delivery_trips')
    .select('id, trip_no, status')
    .eq('id', id)
    .maybeSingle();

  if (!trip) notFound();
  if (!['loaded', 'out'].includes(trip.status)) redirect(`/trips/${id}`);

  const { data: invs } = await supabase
    .from('invoices')
    .select(
      'id, invoice_no, subtotal, total, shop_id, shops(name), invoice_items(id, qty_pcs, rate, is_bonus, amount, products(name, pcs_per_carton))'
    )
    .eq('trip_id', id)
    .order('invoice_no');

  const shopIds = [...new Set((invs ?? []).map((i) => i.shop_id as string))];
  const { data: bals } = shopIds.length
    ? await supabase.from('shop_balances').select('shop_id, ledger_balance').in('shop_id', shopIds)
    : { data: [] as { shop_id: string; ledger_balance: number }[] };
  const balMap = new Map((bals ?? []).map((b) => [b.shop_id, Number(b.ledger_balance)]));

  // Cash the delivery man recorded on his phone (a note only, never posted to ledgers)
  const { data: entries } = await supabase
    .from('trip_cash_entries')
    .select('invoice_id, amount')
    .eq('trip_id', id);

  const recorded: Record<string, number> = {};
  for (const e of entries ?? []) {
    const k = e.invoice_id as string;
    recorded[k] = Math.round(((recorded[k] ?? 0) + Number(e.amount)) * 100) / 100;
  }

  const invoices = (invs ?? []).map((i) => ({
    id: i.id as string,
    no: i.invoice_no as number,
    shop: one(i.shops as unknown as { name: string } | { name: string }[] | null)?.name ?? 'Shop',
    subtotal: Number(i.subtotal),
    total: Number(i.total),
    balance: balMap.get(i.shop_id as string) ?? 0,
    items: ((i.invoice_items ?? []) as Record<string, unknown>[])
      .map((it) => {
        const p = one(it.products as Prod | Prod[] | null);
        return {
          id: it.id as string,
          name: p?.name ?? 'Product',
          qty: Number(it.qty_pcs),
          perCarton: p?.pcs_per_carton ?? 1,
          amount: Number(it.amount),
          bonus: Boolean(it.is_bonus),
        };
      })
      .sort((a, b) => Number(a.bonus) - Number(b.bonus) || a.name.localeCompare(b.name)),
  }));

  return (
    <div>
      <Link href={`/trips/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Trip #{trip.trip_no}
      </Link>
      <PageHeader title="Settle trip" subtitle="Enter what was delivered and the cash collected" />
      <SettleForm tripId={id} invoices={invoices} recorded={recorded} submit={settle} />
    </div>
  );
}