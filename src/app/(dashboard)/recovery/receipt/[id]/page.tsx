import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dayLabel, docNo, one, rs, timeLabel } from '@/lib/format';
import PrintButton from '@/components/PrintButton';

type ShopRef = { name: string; owner_name: string | null; phone: string | null; address: string | null };
type Named = { full_name: string };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const [{ data: c }, { data: tenant }] = await Promise.all([
    supabase
      .from('collections')
      .select(
        'id, receipt_no, amount, method, note, balance_after, created_at, shops(name, owner_name, phone, address), collector:profiles!collections_collected_by_fkey(full_name)'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('tenants').select('name').maybeSingle(),
  ]);

  if (!c) notFound();

  const shop = one(c.shops as unknown as ShopRef | ShopRef[] | null);
  const by = one(c.collector as unknown as Named | Named[] | null);
  const after = Number(c.balance_after ?? 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/recovery" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          Recovery
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <div className="card page-break mx-auto w-full max-w-md p-6 text-sm">
        <div className="border-b border-dashed border-slate-300 pb-4 text-center">
          <p className="text-lg font-bold text-slate-900">{tenant?.name ?? 'Distribution'}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment receipt</p>
        </div>

        <div className="space-y-1 py-4">
          <div className="flex justify-between">
            <span className="text-slate-500">Receipt no.</span>
            <span className="font-bold text-indigo-700">{docNo('RC-', c.receipt_no)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date</span>
            <span className="font-medium text-slate-900">
              {dayLabel(c.created_at)} · {timeLabel(c.created_at)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Received from</span>
            <span className="text-right font-semibold text-slate-900">{shop?.name}</span>
          </div>
          {shop?.owner_name && (
            <div className="flex justify-between">
              <span className="text-slate-500">Owner</span>
              <span className="text-slate-900">{shop.owner_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Method</span>
            <span className="capitalize text-slate-900">{c.method}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-indigo-50 py-4 text-center">
          <p className="text-xs text-indigo-600">Amount received</p>
          <p className="text-3xl font-bold text-indigo-900">{rs(c.amount)}</p>
        </div>

        <div className="space-y-1 py-4">
          <div className="flex justify-between text-slate-600">
            <span>Balance before</span>
            <span>{rs(after + Number(c.amount))}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900">
            <span>Balance after</span>
            <span>{rs(after)}</span>
          </div>
          {c.note && <p className="pt-2 text-xs text-slate-500">Note: {c.note}</p>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Received by: {by?.full_name ?? '-'}</div>
          <div className="border-t border-slate-300 pt-2">Shopkeeper</div>
        </div>
      </div>
    </div>
  );
}