import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { ctn, one, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

type Prod = { name: string; pcs_per_carton: number };

const LABELS: Record<string, string> = {
  grn: 'Received',
  sale_out: 'Loaded for sale',
  return_in: 'Return',
  adjustment: 'Adjustment',
  damage: 'Damaged',
  expired: 'Expired write-off',
};

export default async function MovementsPage() {
  const { supabase } = await requireProfile();

  const { data: rows } = await supabase
    .from('stock_movements')
    .select('id, qty_pcs, movement_type, batch_no, created_at, products(name, pcs_per_carton)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <Link href="/stock" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Stock
      </Link>
      <PageHeader title="Movements" subtitle="Latest 100 stock ledger entries" />

      {!rows?.length ? (
        <EmptyState icon={History} title="No movements yet" hint="Receive stock to create the first entry." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((r) => {
            const p = one(r.products as unknown as Prod | Prod[] | null);
            const inbound = r.qty_pcs > 0;
            return (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{p?.name ?? 'Product'}</p>
                  <p className="text-xs text-slate-500">
                    {LABELS[r.movement_type] ?? r.movement_type}
                    {r.batch_no ? ` · Batch ${r.batch_no}` : ''} · {when(r.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${inbound ? 'text-emerald-600' : 'text-red-600'}`}>
                    {inbound ? '+' : '-'}
                    {r.qty_pcs ? ctn(Math.abs(r.qty_pcs), p?.pcs_per_carton ?? 1) : '0 pcs'}
                  </p>
                  <p className="text-[11px] text-slate-400">{Math.abs(r.qty_pcs)} pcs</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}