import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AlertTriangle, ArrowLeft, Check, Gift, X } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { ctn, one, rs, when } from '@/lib/format';
import StatusChip from '@/components/StatusChip';
import EditOrderSection from '@/components/EditOrderSection';

type ShopInfo = {
  name: string;
  owner_name: string | null;
  phone: string | null;
  credit_limit: number;
  opening_balance: number;
};
type ProdInfo = { name: string; pcs_per_carton: number };
type Named = { full_name: string };
type Preview = {
  product: string;
  per_carton: number;
  scheme_name: string;
  bonus_pcs: number;
  discount: number;
};
type Applied = {
  scheme_name: string;
  bonus_pcs: number;
  discount_amount: number;
  products: ProdInfo | ProdInfo[] | null;
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, profile } = await requireProfile();

  async function approve(formData: FormData) {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('approve_order', {
      p_order_id: id,
      p_override: formData.get('override') === 'on',
    });
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    if (error) redirect(`/orders/${id}?error=${encodeURIComponent(error.message)}`);
    redirect(`/orders/${id}`);
  }

  async function reject(formData: FormData) {
    'use server';
    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('reject_order', {
      p_order_id: id,
      p_reason: String(formData.get('reason') || ''),
    });
    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    if (error) redirect(`/orders/${id}?error=${encodeURIComponent(error.message)}`);
    redirect(`/orders/${id}`);
  }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_no, status, subtotal, discount, total, notes, rejection_reason, booked_at, shop_id, shops(name, owner_name, phone, credit_limit, opening_balance), salesman:profiles!orders_salesman_id_fkey(full_name)'
    )
    .eq('id', id)
    .maybeSingle();

  if (!order) notFound();

  const pending = order.status === 'booked';
  const manage = canManage(profile.role);

  const [{ data: items }, { data: bal }, { data: applied }, previewRes] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, qty_pcs, rate, is_bonus, amount, products(name, pcs_per_carton)')
      .eq('order_id', id)
      .order('is_bonus'),
    supabase.from('shop_balances').select('outstanding').eq('shop_id', order.shop_id).maybeSingle(),
    pending
      ? Promise.resolve({ data: [] as Applied[] })
      : supabase
          .from('order_schemes')
          .select('scheme_name, bonus_pcs, discount_amount, products(name, pcs_per_carton)')
          .eq('order_id', id),
    pending && manage
      ? supabase.rpc('preview_order_schemes', { p_order_id: id })
      : Promise.resolve({ data: [] as Preview[] }),
  ]);

  const preview = (previewRes.data ?? []) as Preview[];
  const appliedList = (applied ?? []) as unknown as Applied[];

  const shop = one(order.shops as unknown as ShopInfo | ShopInfo[] | null);
  const man = one(order.salesman as unknown as Named | Named[] | null);

  const limit = Number(shop?.credit_limit ?? 0);
  const outstanding = Number(bal?.outstanding ?? shop?.opening_balance ?? 0);
  const previewDiscount = preview.reduce((s, p) => s + Number(p.discount), 0);
  const exposure = pending ? outstanding + Math.max(Number(order.total) - previewDiscount, 0) : outstanding;
  const over = limit > 0 && exposure > limit;

  return (
    <div className="space-y-4">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Orders
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Order #{order.order_no}</p>
            <h1 className="text-xl font-bold text-slate-900">{shop?.name ?? 'Unknown shop'}</h1>
            <p className="text-xs text-slate-500">
              {man?.full_name ?? '-'} · {when(order.booked_at)}
            </p>
          </div>
          <StatusChip status={order.status} />
        </div>
        {order.notes && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{order.notes}</p>
        )}
        {order.status === 'rejected' && order.rejection_reason && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            Rejected: {order.rejection_reason}
          </p>
        )}
      </div>

      {error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>{error.replace(/^[A-Z_]+:\s*/, '')}</p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 font-bold text-slate-900">Credit check</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Credit limit', value: limit > 0 ? rs(limit) : 'No limit' },
            { label: 'Outstanding', value: rs(outstanding) },
            { label: 'This order', value: rs(order.total) },
            { label: pending ? 'After approval' : 'Current exposure', value: rs(exposure) },
          ].map((b) => (
            <div key={b.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">{b.label}</p>
              <p className="text-sm font-semibold text-slate-900">{b.value}</p>
            </div>
          ))}
        </div>
        {over && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-red-600">
            <AlertTriangle size={16} />
            Over the credit limit by {rs(exposure - limit)}
          </p>
        )}
      </div>

      {pending && manage && preview.length > 0 && (
        <div className="card space-y-2 bg-indigo-50/60 p-5 ring-1 ring-indigo-100">
          <h2 className="flex items-center gap-2 font-bold text-indigo-900">
            <Gift size={18} />
            Schemes that will apply on approval
          </h2>
          {preview.map((p, i) => (
            <p key={i} className="text-sm text-indigo-900">
              <span className="font-semibold">{p.product}</span> · {p.scheme_name}:{' '}
              {Number(p.bonus_pcs) > 0 && `+${ctn(Number(p.bonus_pcs), Number(p.per_carton))} free`}
              {Number(p.discount) > 0 && `${Number(p.bonus_pcs) > 0 ? ' and ' : ''}${rs(p.discount)} off`}
            </p>
          ))}
          <p className="text-xs text-indigo-700">
            Totals below are before schemes. After approval the order total drops by {rs(previewDiscount)}.
          </p>
        </div>
      )}

      {!pending && appliedList.length > 0 && (
        <div className="card space-y-2 bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
          <h2 className="flex items-center gap-2 font-bold text-emerald-900">
            <Gift size={18} />
            Schemes applied
          </h2>
          {appliedList.map((a, i) => {
            const prod = one(a.products);
            return (
              <p key={i} className="text-sm text-emerald-900">
                <span className="font-semibold">{prod?.name ?? 'Product'}</span> · {a.scheme_name}:{' '}
                {Number(a.bonus_pcs) > 0 && `+${ctn(Number(a.bonus_pcs), prod?.pcs_per_carton ?? 1)} free`}
                {Number(a.discount_amount) > 0 &&
                  `${Number(a.bonus_pcs) > 0 ? ' and ' : ''}${rs(a.discount_amount)} off`}
              </p>
            );
          })}
        </div>
      )}

      <div className="card divide-y divide-slate-100">
        {items?.map((it) => {
          const prod = one(it.products as unknown as ProdInfo | ProdInfo[] | null);
          const ppc = prod?.pcs_per_carton ?? 1;
          return (
            <div key={it.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">
                  {prod?.name ?? 'Product'}
                  {it.is_bonus && <span className="chip ml-2">Bonus</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {Math.floor(it.qty_pcs / ppc)} ctn {it.qty_pcs % ppc} pcs · {it.qty_pcs} pcs @{' '}
                  {rs(it.rate)}
                </p>
              </div>
              <p className="font-bold text-slate-900">{rs(it.amount)}</p>
            </div>
          );
        })}
        {Number(order.discount) > 0 && (
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-semibold text-slate-600">Discount</span>
            <span className="font-bold text-red-600">- {rs(order.discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between bg-slate-50/70 p-4">
          <span className="text-sm font-semibold text-slate-600">Total</span>
          <span className="text-lg font-bold text-slate-900">{rs(order.total)}</span>
        </div>
      </div>
      {pending && manage && <EditOrderSection orderId={id} discount={Number(order.discount)} />}
      {pending && manage && (
        <div className="grid gap-3 md:grid-cols-2">
          <form action={approve} className="card space-y-3 p-4">
            <h3 className="font-bold text-slate-900">Approve</h3>
            <p className="text-xs text-slate-500">
              Prices are re-checked against the current price list, and schemes are applied, before approval.
            </p>
            {profile.role === 'owner' && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="override" className="size-4 accent-indigo-600" />
                Override credit limit
              </label>
            )}
            <button className="btn-primary w-full">
              <Check size={18} />
              Approve order
            </button>
          </form>

          <form action={reject} className="card space-y-3 p-4">
            <h3 className="font-bold text-slate-900">Reject</h3>
            <input name="reason" required className="field" placeholder="Reason (e.g. payment pending)" />
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100">
              <X size={18} />
              Reject order
            </button>
          </form>
        </div>
      )}
    </div>
  );
}