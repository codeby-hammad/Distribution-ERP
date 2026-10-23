import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { loadTripData } from '@/lib/trips';
import { dateLabel, docNo, one, rs, when } from '@/lib/format';
import PrintButton from '@/components/PrintButton';
import { CompanyHeader } from '@/components/CompanyHeader';
import { getCompany } from '@/lib/company';

type ShopRow = {
  shopId: string;
  name: string;
  invoices: number[];
  total: number;
  returned: number;
  payable: number;
  submitted: number;
  due: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function PaymentsSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  if (!['owner', 'manager', 'cashier'].includes(profile.role)) redirect(`/trips/${id}`);

  const trip = await loadTripData(supabase, id);
  if (!trip) notFound();
  if (trip.status === 'draft') redirect(`/trips/${id}`);

    const [company, { data: head }, { data: invs }, { data: entries }] = await Promise.all([
    getCompany(supabase),
    supabase
      .from('delivery_trips')
      .select('status, settled_at, cash_expected, cash_received, cash_difference, settle_note')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('id, invoice_no, shop_id, total, returned_value, collected, shops(name)')
      .eq('trip_id', id)
      .order('invoice_no'),
    supabase.from('trip_cash_entries').select('invoice_id, amount').eq('trip_id', id),
  ]);

  const settled = head?.status === 'settled' || !!head?.settled_at;

  const recorded = new Map<string, number>();
  for (const e of entries ?? []) {
    const k = e.invoice_id as string;
    recorded.set(k, r2((recorded.get(k) ?? 0) + Number(e.amount)));
  }

  const byShop = new Map<string, ShopRow>();
  for (const i of invs ?? []) {
    const shopId = i.shop_id as string;
    const name = one(i.shops as unknown as { name: string } | { name: string }[] | null)?.name ?? 'Shop';
    const total = Number(i.total) || 0;
    const returned = settled ? Number(i.returned_value) || 0 : 0;
    const submitted = settled ? Number(i.collected) || 0 : recorded.get(i.id as string) ?? 0;

    const row = byShop.get(shopId) ?? {
      shopId,
      name,
      invoices: [],
      total: 0,
      returned: 0,
      payable: 0,
      submitted: 0,
      due: 0,
    };
    row.invoices.push(i.invoice_no as number);
    row.total = r2(row.total + total);
    row.returned = r2(row.returned + returned);
    row.submitted = r2(row.submitted + submitted);
    byShop.set(shopId, row);
  }

  const rows = [...byShop.values()]
    .map((r) => {
      const payable = Math.max(r2(r.total - r.returned), 0);
      return { ...r, payable, due: Math.max(r2(payable - r.submitted), 0) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (k: 'total' | 'returned' | 'payable' | 'submitted' | 'due') =>
    r2(rows.reduce((s, r) => s + r[k], 0));

  const diff = Number(head?.cash_difference ?? 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/trips/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          Trip #{trip.no}
        </Link>
        <PrintButton label="Print" />
      </div>

      <div className="card mx-auto w-full max-w-3xl p-5 text-sm md:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
            <CompanyHeader c={company} />
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments sheet</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              {settled
                ? `Settled${head?.settled_at ? ` · ${when(head.settled_at)}` : ''}`
                : 'Recorded by delivery man, not settled yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-indigo-700">{docNo('TRIP-', trip.no)}</p>
            <p className="text-xs text-slate-500">{dateLabel(trip.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
          {[
            { l: 'Route', v: trip.route ?? 'All routes' },
            { l: 'Vehicle', v: trip.vehicle ?? '-' },
            { l: 'Delivery man', v: trip.driver ?? '-' },
            { l: 'Shops', v: String(rows.length) },
          ].map((x) => (
            <div key={x.l}>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{x.l}</p>
              <p className="font-semibold text-slate-900">{x.v}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Shop</th>
                <th className="px-2 py-2 text-right">Invoice</th>
                {settled && <th className="px-2 py-2 text-right">Returns</th>}
                <th className="px-2 py-2 text-right">Payable</th>
                <th className="px-2 py-2 text-right">Submitted</th>
                <th className="px-2 py-2 text-right">Not received</th>
                <th className="px-2 py-2 text-center">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={settled ? 8 : 7} className="px-2 py-6 text-center text-slate-400">
                    No invoices on this trip.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.shopId}>
                  <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.invoices.map((n) => docNo('INV-', n)).join(', ')}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right">{rs(r.total)}</td>
                  {settled && (
                    <td className={`px-2 py-2 text-right ${r.returned > 0 ? 'text-red-600' : ''}`}>
                      {rs(r.returned)}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right">{rs(r.payable)}</td>
                  <td className="px-2 py-2 text-right font-semibold text-emerald-700">{rs(r.submitted)}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${r.due > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {rs(r.due)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block size-4 rounded border border-slate-400 align-middle" />
                  </td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-slate-50 font-bold">
                  <td className="px-2 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-2 py-2 text-right">{rs(sum('total'))}</td>
                  {settled && <td className="px-2 py-2 text-right">{rs(sum('returned'))}</td>}
                  <td className="px-2 py-2 text-right">{rs(sum('payable'))}</td>
                  <td className="px-2 py-2 text-right text-emerald-700">{rs(sum('submitted'))}</td>
                  <td className="px-2 py-2 text-right text-red-600">{rs(sum('due'))}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{settled ? 'Cash expected' : 'Recorded by delivery man'}</p>
            <p className="text-sm font-bold text-slate-900">
              {rs(settled ? Number(head?.cash_expected ?? 0) : sum('submitted'))}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">Cash handed in</p>
            <p className="text-sm font-bold text-slate-900">
              {settled ? rs(Number(head?.cash_received ?? 0)) : '____________'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{diff < 0 ? 'Cash short' : diff > 0 ? 'Cash extra' : 'Difference'}</p>
            <p
              className={`text-sm font-bold ${
                !settled ? 'text-slate-900' : diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {settled ? rs(Math.abs(diff)) : '____________'}
            </p>
          </div>
        </div>

        {head?.settle_note && <p className="mt-3 text-xs text-slate-500">Note: {head.settle_note}</p>}

        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Cashier / Office</div>
          <div className="border-t border-slate-300 pt-2">Delivery man</div>
        </div>
      </div>
    </div>
  );
}