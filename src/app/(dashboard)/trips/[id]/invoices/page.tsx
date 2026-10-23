import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { loadInvoices } from '@/lib/invoices';
import InvoiceView from '@/components/InvoiceView';
import PrintButton from '@/components/PrintButton';

export default async function TripInvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { tenantName, company, invoices } = await loadInvoices(supabase, { tripId: id });
  if (!invoices.length) redirect(`/trips/${id}`);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/trips/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          Trip
        </Link>
        <PrintButton label={`Print ${invoices.length} invoices`} />
      </div>

      <div className="space-y-6">
        {invoices.map((inv) => (
          <InvoiceView key={inv.id} tenantName={tenantName} company={company} inv={inv} />
        ))}
      </div>
    </div>
  );
}