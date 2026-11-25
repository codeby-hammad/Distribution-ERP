import { ctn, docNo, rs } from '@/lib/format';
import type { InvoiceData } from '@/lib/invoices';
import type { Company } from '@/lib/company';
import { CompanyFooter, CompanyHeader } from '@/components/CompanyHeader';

export default function InvoiceView({
  tenantName,
  company,
  inv,
}: {
  tenantName: string;
  company?: Company;
  inv: InvoiceData;
}) {
  const date = new Date(inv.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });

  return (
    <div className="card page-break mx-auto w-full max-w-3xl p-5 text-sm md:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          {company ? (
            <CompanyHeader c={company} />
          ) : (
            <p className="text-lg font-bold text-slate-900">{tenantName}</p>
          )}
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sales invoice</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-indigo-700">{docNo('INV-', inv.no)}</p>
          <p className="text-xs text-slate-500">{date}</p>
          {inv.orderNo != null && <p className="text-xs text-slate-500">Order #{inv.orderNo}</p>}
        </div>
      </div>

      <div className="py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
        <p className="text-base font-bold text-slate-900">{inv.shop.name}</p>
        {inv.shop.owner && <p className="text-slate-600">{inv.shop.owner}</p>}
        {inv.shop.address && <p className="text-slate-600">{inv.shop.address}</p>}
        {inv.shop.phone && <p className="text-slate-600">{inv.shop.phone}</p>}
        {company?.taxEnabled && inv.shop.taxStatus !== 'unknown' && (
          <p className="text-xs font-semibold text-slate-600">
            {inv.shop.taxStatus === 'filer' ? 'Active taxpayer (filer)' : 'Non-filer'}
            {inv.shop.ntn ? ` · NTN/CNIC: ${inv.shop.ntn}` : ''}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2 text-right">Rate/pc</th>
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inv.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                <td className="px-2 py-2 font-medium text-slate-900">
                  {l.name}
                  {l.bonus && <span className="chip ml-2">Bonus</span>}
                </td>
                <td className="px-2 py-2">
                  {ctn(l.qty, l.perCarton)}
                  <span className="block text-[11px] text-slate-400">{l.qty} pcs</span>
                  {l.delivered !== null && l.delivered !== l.qty && (
                    <span className="block text-[11px] font-semibold text-amber-600">
                      Delivered {ctn(l.delivered, l.perCarton)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">{l.bonus ? '-' : rs(l.rate)}</td>
                <td className="px-2 py-2 text-right font-semibold">{rs(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{rs(inv.subtotal)}</span>
        </div>
        {inv.discount > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Discount / scheme</span>
            <span>- {rs(inv.discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
          <span>Invoice total</span>
          <span>{rs(inv.total)}</span>
        </div>
                {company?.taxEnabled && (() => {
          const nonFiler = inv.shop.taxStatus === 'non_filer';
          const rate = nonFiler ? company.taxRateNonFiler : company.taxRateFiler;
          if (rate <= 0) return null;
          const taxable = Math.round((inv.total / (1 + rate / 100)) * 100) / 100;
          const tax = Math.round((inv.total - taxable) * 100) / 100;
          return (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex justify-between"><span>Value excluding tax</span><span>{rs(taxable)}</span></div>
              <div className="flex justify-between">
                <span>{nonFiler ? 'Sales tax + further tax' : 'Sales tax'} {rate}% (included)</span>
                <span>{rs(tax)}</span>
              </div>
            </div>
          );
        })()}
        
        {inv.returned > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Returns</span>
            <span>- {rs(inv.returned)}</span>
          </div>
        )}
        {inv.collected > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Paid</span>
            <span>- {rs(inv.collected)}</span>
          </div>
        )}
                        {(() => {
          const adv = inv.previous < -0.5; // shop had paid more than it owed
          const credit = inv.net < -0.5; // after this invoice the shop is still in credit
          return (
            <>
              <div className="flex justify-between pt-2 text-slate-600">
                <span>{adv ? 'Advance paid earlier (shop credit)' : 'Previous balance (old dues)'}</span>
                <span>{adv ? `- ${rs(Math.abs(inv.previous))}` : rs(inv.previous)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-900 px-3 py-2 text-base font-bold text-white print:bg-slate-200 print:text-slate-900">
                <span>{credit ? 'Credit balance (advance with us)' : 'Total payable'}</span>
                <span>{credit ? `- ${rs(Math.abs(inv.net))}` : rs(Math.max(inv.net, 0))}</span>
              </div>
              <p className="text-right text-[11px] text-slate-400">
                Old balance + this invoice{inv.returned > 0 ? ' - returns' : ''}{inv.collected > 0 ? ' - paid' : ''}
              </p>
              {adv && (
                <p className="no-print rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                  This shop has a credit of {rs(Math.abs(inv.previous))} in the ledger. If the shop did not pay in
                  advance, open its ledger and check for a double payment or return before printing.
                </p>
              )}
            </>
          );
        })()}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
        <div className="border-t border-slate-300 pt-2">Received by (shopkeeper)</div>
        <div className="border-t border-slate-300 pt-2">Delivered by</div>
      </div>

      {company && <CompanyFooter c={company} />}
    </div>
  );
}