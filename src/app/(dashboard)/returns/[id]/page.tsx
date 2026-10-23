import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { getCompany } from '@/lib/company';
import { ctn, docNo, one, rs, when } from '@/lib/format';
import { CompanyFooter, CompanyHeader } from '@/components/CompanyHeader';
import PrintButton from '@/components/PrintButton';

type Prod = { name: string; pcs_per_carton: number };
type Shop = { name: string; owner_name: string | null; phone: string | null; address: string | null };

const COND: Record<string, string> = { resaleable: 'Back into stock', damaged: 'Damaged, not restocked', expired: 'Expired, not restocked' };

export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (!['owner', 'manager'].includes(profile.role)) redirect('/');

  const [company, { data: r }, { data: items }] = await Promise.all([
    getCompany(supabase),
    supabase
      .from('sales_returns')
      .select('id, credit_note_no, total, reason, note, created_at, invoice_id, shops(name, owner_name, phone, address), invoices(invoice_no)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('sales_return_items')
      .select('id, qty_pcs, rate, amount, condition, batch_no, products(name, pcs_per_carton)')
      .eq('return_id', id),
  ]);
  if (!r) notFound();

  const shop = one(r.shops as unknown as Shop | Shop[] | null);
  const inv = one(r.invoices as unknown as { invoice_no: number } | { invoice_no: number }[] | null);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/returns" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          Returns
        </Link>
        <PrintButton />
      </div>

      <div className="card mx-auto w-full max-w-3xl p-5 text-sm md:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <CompanyHeader c={company} />
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Credit note</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-red-600">{docNo('CN-', r.credit_note_no)}</p>
            <p className="text-xs text-slate-500">{when(r.created_at)}</p>
            {inv && <p className="text-xs text-slate-500">Against {docNo('INV-', inv.invoice_no)}</p>}
          </div>
        </div>

        <div className="py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Credited to</p>
          <p className="text-base font-bold text-slate-900">{shop?.name}</p>
          {shop?.owner_name && <p className="text-slate-600">{shop.owner_name}</p>}
          {shop?.address && <p className="text-slate-600">{shop.address}</p>}
          {shop?.phone && <p className="text-slate-600">{shop.phone}</p>}
          {r.reason && <p className="mt-2 text-slate-600">Reason: {r.reason}</p>}
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2 text-right">Rate/pc</th>
              <th className="px-2 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(items ?? []).map((it, i) => {
              const p = one(it.products as unknown as Prod | Prod[] | null);
              return (
                <tr key={it.id}>
                  <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium text-slate-900">{p?.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {COND[it.condition] ?? it.condition}
                      {it.batch_no ? ` · Batch ${it.batch_no}` : ''}
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    {ctn(Number(it.qty_pcs), p?.pcs_per_carton ?? 1)}
                    <span className="block text-[11px] text-slate-400">{it.qty_pcs} pcs</span>
                  </td>
                  <td className="px-2 py-2 text-right">{rs(it.rate)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{rs(it.amount)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-bold">
              <td className="px-2 py-2" colSpan={4}>Total credit</td>
              <td className="px-2 py-2 text-right text-red-600">{rs(r.total)}</td>
            </tr>
          </tbody>
        </table>

        {r.note && <p className="mt-3 text-xs text-slate-500">Note: {r.note}</p>}

        <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Shopkeeper</div>
          <div className="border-t border-slate-300 pt-2">Authorised by</div>
        </div>
        <CompanyFooter c={company} />
      </div>
    </div>
  );
}