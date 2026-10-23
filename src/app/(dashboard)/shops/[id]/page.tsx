import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Printer } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { one, rs, when } from '@/lib/format';

const LABELS: Record<string, string> = {
  invoice: 'Invoice',
  return: 'Return',
  payment: 'Payment',
  adjustment: 'Adjustment',
};

export default async function ShopStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, owner_name, phone, address, credit_limit, opening_balance, routes(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!shop) notFound();

  const [{ data: bal }, { data: entries }] = await Promise.all([
    supabase.from('shop_balances').select('ledger_balance, outstanding').eq('shop_id', id).maybeSingle(),
    supabase
      .from('shop_ledger')
      .select('id, entry_type, debit, credit, note, ref_type, ref_id, created_at')
      .eq('shop_id', id)
      .order('created_at', { ascending: true }),
  ]);

  const opening = Number(shop.opening_balance);
  let run = opening;
  const rows = (entries ?? [])
    .map((e) => {
      run += Number(e.debit) - Number(e.credit);
      return { ...e, balance: run };
    })
    .reverse();

  const balance = Number(bal?.ledger_balance ?? opening);
  const pending = Number(bal?.outstanding ?? balance) - balance;
  const limit = Number(shop.credit_limit);
  const route = one(shop.routes as unknown as { name: string } | { name: string }[] | null);

  return (
    <div className="space-y-4">
      <Link href="/shops" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <ArrowLeft size={16} />
        Shops
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="hero grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white">
              {shop.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">{shop.name}</h1>
              <p className="truncate text-xs text-slate-500">
                {shop.owner_name ?? 'No owner name'}
                {shop.address ? ` · ${shop.address}` : ''}
              </p>
            </div>
          </div>
          {route?.name && <span className="chip shrink-0">{route.name}</span>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: 'Balance (owed)', v: rs(balance), strong: true },
            { l: 'Open orders', v: rs(pending) },
            { l: 'Credit limit', v: limit > 0 ? rs(limit) : 'No limit' },
            { l: 'Credit available', v: limit > 0 ? rs(Math.max(limit - balance - pending, 0)) : '-' },
          ].map((b) => (
            <div key={b.l} className={`rounded-xl p-3 ${b.strong ? 'bg-indigo-50' : 'bg-slate-50'}`}>
              <p className={`text-[11px] ${b.strong ? 'text-indigo-600' : 'text-slate-500'}`}>{b.l}</p>
              <p className={`text-sm font-bold ${b.strong ? 'text-indigo-900' : 'text-slate-900'}`}>{b.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <Phone size={14} />
              {shop.phone}
            </a>
          )}
          <Link
            href={`/shops/${id}/statement`}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600"
          >
            <Printer size={14} />
            Print statement
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="p-4 pb-2 font-bold text-slate-900">Ledger</h2>
        <div className="divide-y divide-slate-100">
          {rows.map((e) => {
            const isDebit = Number(e.debit) > 0;
            const href =
              e.ref_type === 'invoice' && e.ref_id
                ? `/invoices/${e.ref_id}`
                : e.ref_type === 'collection' && e.ref_id
                  ? `/recovery/receipt/${e.ref_id}`
                  : null;

            const content = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {LABELS[e.entry_type] ?? e.entry_type}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {e.note ?? '-'} · {when(e.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isDebit ? '+' : '-'} {rs(isDebit ? e.debit : e.credit)}
                  </p>
                  <p className="text-[11px] text-slate-400">Bal {rs(e.balance)}</p>
                </div>
              </>
            );

            return href ? (
              <Link
                key={e.id}
                href={href}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                {content}
              </Link>
            ) : (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                {content}
              </div>
            );
          })}
          <div className="flex items-center gap-3 bg-slate-50/70 px-4 py-3">
            <p className="flex-1 text-sm font-semibold text-slate-600">Opening balance</p>
            <p className="text-sm font-bold text-slate-900">{rs(opening)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}