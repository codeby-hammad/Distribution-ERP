import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dayLabel, rs } from '@/lib/format';
import PrintButton from '@/components/PrintButton';

const LABELS: Record<string, string> = {
  invoice: 'Invoice',
  return: 'Return',
  payment: 'Payment',
  adjustment: 'Adjustment',
};

export default async function PrintStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const [{ data: shop }, { data: entries }, { data: tenant }] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, owner_name, phone, address, opening_balance')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('shop_ledger')
      .select('id, entry_type, debit, credit, note, created_at')
      .eq('shop_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('tenants').select('name').maybeSingle(),
  ]);

  if (!shop) notFound();

  const opening = Number(shop.opening_balance);
  let run = opening;
  const rows = (entries ?? []).map((e) => {
    run += Number(e.debit) - Number(e.credit);
    return { ...e, balance: run };
  });
  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
  const today = new Date().toISOString();

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/shops/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          {shop.name}
        </Link>
        <PrintButton label="Print statement" />
      </div>

      <div className="card mx-auto w-full max-w-3xl p-5 text-sm md:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold text-slate-900">{tenant?.name ?? 'Distribution'}</p>
            <p className="text-xs text-slate-500">Account statement</p>
          </div>
          <p className="text-xs text-slate-500">As of {dayLabel(today)}</p>
        </div>

        <div className="py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Customer</p>
          <p className="text-base font-bold text-slate-900">{shop.name}</p>
          {shop.owner_name && <p className="text-slate-600">{shop.owner_name}</p>}
          {shop.address && <p className="text-slate-600">{shop.address}</p>}
          {shop.phone && <p className="text-slate-600">{shop.phone}</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/60">
                <td className="px-2 py-2" />
                <td className="px-2 py-2 font-medium text-slate-700">Opening balance</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right font-semibold">{rs(opening)}</td>
              </tr>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-500">{dayLabel(r.created_at)}</td>
                  <td className="px-2 py-2 text-slate-900">
                    {LABELS[r.entry_type] ?? r.entry_type}
                    {r.note && <span className="block text-[11px] text-slate-400">{r.note}</span>}
                  </td>
                  <td className="px-2 py-2 text-right">{Number(r.debit) > 0 ? rs(r.debit) : ''}</td>
                  <td className="px-2 py-2 text-right">{Number(r.credit) > 0 ? rs(r.credit) : ''}</td>
                  <td className="px-2 py-2 text-right font-semibold">{rs(r.balance)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-2 py-2" colSpan={2}>Totals</td>
                <td className="px-2 py-2 text-right">{rs(totalDebit)}</td>
                <td className="px-2 py-2 text-right">{rs(totalCredit)}</td>
                <td className="px-2 py-2 text-right">{rs(run)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl bg-indigo-50 px-4 py-3 text-center">
          <p className="text-xs text-indigo-600">Amount due</p>
          <p className="text-2xl font-bold text-indigo-900">{rs(run)}</p>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Please report any difference within 7 days of receiving this statement.
        </p>
      </div>
    </div>
  );
}