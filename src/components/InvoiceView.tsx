import { ctn, docNo, rs } from '@/lib/format';
import type { InvoiceData } from '@/lib/invoices';
import type { Company } from '@/lib/company';
import { CompanyFooter, CompanyHeader } from '@/components/CompanyHeader';
import { invoiceFont } from '@/lib/invoice-font';

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

  const adv = inv.previous < -0.5; // shop had paid more than it owed
  const credit = inv.net < -0.5; // shop is still in credit after this invoice
  const showPrev = Math.abs(inv.previous) > 0.5;

  const nonFiler = inv.shop.taxStatus === 'non_filer';
  const rate = company?.taxEnabled ? (nonFiler ? company.taxRateNonFiler : company.taxRateFiler) : 0;
  const taxable = rate > 0 ? Math.round((inv.total / (1 + rate / 100)) * 100) / 100 : 0;
  const tax = rate > 0 ? Math.round((inv.total - taxable) * 100) / 100 : 0;

  const num = 'tabular-nums';
  const label = 'text-[11px] print:text-[9.5pt] font-bold uppercase tracking-[0.14em] text-slate-600 print-muted';
  const muted = 'text-slate-600 print-muted';

  return (
    <div
      className={`${invoiceFont.className} page-break invoice-sheet mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 text-[14px] leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-200 md:p-10 print:max-w-none print:rounded-none print:p-0 print:text-[11pt] print:shadow-none print:ring-0`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-5">
        <div className="min-w-0">
          {company ? (
            <CompanyHeader c={company} />
          ) : (
            <p className="text-xl font-bold text-slate-900 print:text-[16pt]">{tenantName}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={label}>Sales invoice</p>
          <p className={`text-2xl font-bold print:text-[18pt] ${num}`}>{docNo('INV-', inv.no)}</p>
          <p className={`text-sm print:text-[10.5pt] ${num}`}>{date}</p>
          {inv.orderNo != null && (
            <p className={`text-sm print:text-[10.5pt] ${muted} ${num}`}>Order #{inv.orderNo}</p>
          )}
        </div>
      </div>

      {/* Bill to */}
      <div className="grid gap-4 py-5 sm:grid-cols-2">
        <div>
          <p className={label}>Bill to</p>
          <p className="text-base font-bold print:text-[12.5pt]">{inv.shop.name}</p>
          {inv.shop.owner && <p className={muted}>{inv.shop.owner}</p>}
          {inv.shop.address && <p className={muted}>{inv.shop.address}</p>}
          {inv.shop.phone && <p className={`${muted} ${num}`}>{inv.shop.phone}</p>}
        </div>
        {company?.taxEnabled && inv.shop.taxStatus !== 'unknown' && (
          <div className="sm:text-right">
            <p className={label}>Tax status</p>
            <p className="font-semibold">
              {inv.shop.taxStatus === 'filer' ? 'Active taxpayer (filer)' : 'Non-filer'}
            </p>
            {inv.shop.ntn && <p className={`${muted} ${num}`}>NTN/CNIC: {inv.shop.ntn}</p>}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y-2 border-black text-[11px] uppercase tracking-[0.1em] print:text-[9.5pt]">
              <th className="px-2 py-2.5 font-bold">#</th>
              <th className="px-2 py-2.5 font-bold">Product</th>
              <th className="px-2 py-2.5 font-bold">Quantity</th>
              <th className="px-2 py-2.5 text-right font-bold">Rate / pc</th>
              <th className="px-2 py-2.5 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-slate-400 align-top print:text-[10.5pt]">
                <td className={`px-2 py-2.5 ${muted} ${num}`}>{i + 1}</td>
                <td className="px-2 py-2.5 font-semibold">
                  {l.name}
                  {l.bonus && (
                    <span className="ml-2 rounded border border-black px-1.5 py-px text-[10px] font-bold uppercase tracking-wide print:text-[8.5pt]">
                      Bonus
                    </span>
                  )}
                </td>
                <td className={`px-2 py-2.5 ${num}`}>
                  {ctn(l.qty, l.perCarton)}
                  <span className={`block text-xs print:text-[9pt] ${muted}`}>{l.qty} pcs</span>
                  {l.delivered !== null && l.delivered !== l.qty && (
                    <span className="block text-xs font-bold print:text-[9pt]">
                      Delivered {ctn(l.delivered, l.perCarton)}
                    </span>
                  )}
                </td>
                <td className={`px-2 py-2.5 text-right ${num}`}>{l.bonus ? '-' : rs(l.rate)}</td>
                <td className={`px-2 py-2.5 text-right font-bold ${num}`}>{rs(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className={`ml-auto mt-5 w-full max-w-sm space-y-1.5 print:text-[10.5pt] ${num}`}>
        <div className="flex justify-between">
          <span className={muted}>Subtotal</span>
          <span>{rs(inv.subtotal)}</span>
        </div>
        {inv.discount > 0 && (
          <div className="flex justify-between">
            <span className={muted}>Discount / scheme</span>
            <span>- {rs(inv.discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-black pt-1.5 text-base font-bold print:text-[12pt]">
          <span>Invoice total</span>
          <span>{rs(inv.total)}</span>
        </div>

        {rate > 0 && (
          <div className="rounded-md border border-slate-400 px-3 py-2 text-xs print:text-[9.5pt]">
            <div className="flex justify-between">
              <span>Value excluding tax</span>
              <span>{rs(taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                {nonFiler ? 'Sales tax + further tax' : 'Sales tax'} {rate}% (included)
              </span>
              <span>{rs(tax)}</span>
            </div>
          </div>
        )}

        {inv.returned > 0 && (
          <div className="flex justify-between">
            <span className={muted}>Returns</span>
            <span>- {rs(inv.returned)}</span>
          </div>
        )}
        {inv.collected > 0 && (
          <div className="flex justify-between">
            <span className={muted}>Paid</span>
            <span>- {rs(inv.collected)}</span>
          </div>
        )}

        {showPrev && (
          <div className="flex justify-between pt-1">
            <span className={muted}>{adv ? 'Advance paid earlier (shop credit)' : 'Previous balance (old dues)'}</span>
            <span>{adv ? `- ${rs(Math.abs(inv.previous))}` : rs(inv.previous)}</span>
          </div>
        )}

        <div className="flex justify-between border-2 border-black px-3 py-2 text-lg font-extrabold print:text-[13pt]">
          <span>{credit ? 'Credit balance (advance with us)' : 'Total payable'}</span>
          <span>{credit ? `- ${rs(Math.abs(inv.net))}` : rs(Math.max(inv.net, 0))}</span>
        </div>
        <p className={`text-right text-xs print:text-[9pt] ${muted}`}>
          {showPrev ? 'Old balance + this invoice' : 'This invoice'}
          {inv.returned > 0 ? ' - returns' : ''}
          {inv.collected > 0 ? ' - paid' : ''}
        </p>

        {adv && (
          <p className="no-print rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
            This shop has a credit of {rs(Math.abs(inv.previous))} in the ledger. If the shop did not pay in advance,
            check its ledger for a double payment or return before printing.
          </p>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-14 grid grid-cols-2 gap-10 text-xs print:text-[9.5pt]">
        <div className="border-t border-black pt-2">Received by (shopkeeper)</div>
        <div className="border-t border-black pt-2 text-right">Delivered by</div>
      </div>

      {company && <CompanyFooter c={company} />}
    </div>
  );
}