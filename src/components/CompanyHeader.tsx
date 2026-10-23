import type { Company } from '@/lib/company';

export function CompanyHeader({ c }: { c: Company }) {
  return (
    <div className="flex items-start gap-3">
      {c.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logoUrl} alt="" className="size-14 shrink-0 rounded-lg object-contain" />
      )}
      <div>
        <p className="text-lg font-bold text-slate-900">{c.name}</p>
        {c.address && <p className="text-xs text-slate-500">{c.address}</p>}
        {c.phone && <p className="text-xs text-slate-500">Tel: {c.phone}</p>}
        {(c.ntn || c.strn) && (
          <p className="text-xs text-slate-500">
            {c.ntn ? `NTN: ${c.ntn}` : ''}
            {c.ntn && c.strn ? ' · ' : ''}
            {c.strn ? `STRN: ${c.strn}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export function CompanyFooter({ c }: { c: Company }) {
  if (!c.invoice_footer) return null;
  return (
    <p className="mt-6 whitespace-pre-line border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
      {c.invoice_footer}
    </p>
  );
}