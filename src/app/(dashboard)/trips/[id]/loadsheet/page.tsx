import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { loadTripData } from '@/lib/trips';
import { ctn, dateLabel, docNo } from '@/lib/format';
import PrintButton from '@/components/PrintButton';
import SlipQr from '@/components/SlipQr';
import { getCompany } from '@/lib/company';
import { CompanyFooter, CompanyHeader } from '@/components/CompanyHeader';

export default async function LoadSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const trip = await loadTripData(supabase, id);
  if (!trip) notFound();
  const company = await getCompany(supabase);
  const totalPcs = trip.lines.reduce((s, l) => s + l.qty, 0);
  const slipCode = docNo('TRIP-', trip.no);

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
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Load sheet</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <p className="text-lg font-bold text-indigo-700">{slipCode}</p>
            <p className="mb-2 text-xs text-slate-500">{dateLabel(trip.date)}</p>
            <SlipQr value={slipCode} size={110} />
            <p className="mt-1 text-[10px] text-slate-400">Warehouse: scan to confirm handover</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
          {[
            { l: 'Route', v: trip.route ?? 'All routes' },
            { l: 'Vehicle', v: trip.vehicle ?? '-' },
            { l: 'Delivery man', v: trip.driver ?? '-' },
            { l: 'Warehouse', v: trip.warehouse ?? '-' },
          ].map((x) => (
            <div key={x.l}>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{x.l}</p>
              <p className="font-semibold text-slate-900">{x.v}</p>
            </div>
          ))}
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Quantity</th>
              <th className="px-2 py-2 text-right">Total pcs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trip.lines.map((l, i) => (
              <tr key={l.productId}>
                <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                <td className="px-2 py-2 font-medium text-slate-900">{l.name}</td>
                <td className="px-2 py-2">{ctn(l.qty, l.perCarton)}</td>
                <td className="px-2 py-2 text-right font-semibold">{l.qty}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="px-2 py-2" colSpan={3}>Total</td>
              <td className="px-2 py-2 text-right">{totalPcs}</td>
            </tr>
          </tbody>
        </table>

        {trip.picks.length > 0 && (
          <>
            <p className="mb-2 mt-6 font-bold text-slate-900">Pick from these batches</p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">Batch</th>
                  <th className="px-2 py-2">Expiry</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trip.picks.map((p, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-2 py-2">{p.batch ?? '-'}</td>
                    <td className="px-2 py-2">{p.expiry ? dateLabel(p.expiry) : '-'}</td>
                    <td className="px-2 py-2 text-right">{ctn(p.qty, p.perCarton)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="mb-2 mt-6 font-bold text-slate-900">Shops on this trip</p>
        <ol className="list-decimal space-y-0.5 pl-5 text-slate-700">
          {trip.orders.map((o) => (
            <li key={o.id}>
              {o.shop} <span className="text-slate-400">(Order #{o.no})</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Warehouse keeper</div>
          <div className="border-t border-slate-300 pt-2">Delivery man</div>
        </div>
      </div>
    </div>
  );
}