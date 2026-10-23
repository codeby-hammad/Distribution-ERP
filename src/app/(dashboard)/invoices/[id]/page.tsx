import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { loadInvoices } from '@/lib/invoices';
import InvoiceView from '@/components/InvoiceView';
import PrintButton from '@/components/PrintButton';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { tenantName, company, invoices } = await loadInvoices(supabase, { id });
  const inv = invoices[0];
  if (!inv) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft size={16} />
          Trips
        </Link>
        <PrintButton />
      </div>
      <InvoiceView tenantName={tenantName} company={company} inv={inv} />
    </div>
  );
}