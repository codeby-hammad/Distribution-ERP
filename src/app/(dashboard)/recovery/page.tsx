import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Receipt, Wallet } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { docNo, one, rs, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import RecoveryList from './RecoveryList';

type RouteRef = { name: string };

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
    const { supabase, profile } = await requireProfile();

  async function collect(
    payload: string
  ): Promise<{ id?: string; receiptNo?: number; error?: string }> {
    'use server';
    const { supabase } = await requireProfile();

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      return { error: 'Invalid data' };
    }

    const { data, error } = await supabase.rpc('record_collection', { p: body });
    if (error) return { error: error.message };

    revalidatePath('/recovery');
    revalidatePath('/cash');
    revalidatePath('/shops');
    const r = data as { id: string; receipt_no: number };
    return { id: r.id, receiptNo: r.receipt_no };
  }

  const [{ data: shops }, { data: bals }, { data: pending }, { data: recent }] =
    await Promise.all([
      supabase
        .from('shops')
        .select('id, name, owner_name, phone, routes(name)')
        .is('deleted_at', null)
        .order('name'),
      supabase.from('shop_balances').select('shop_id, ledger_balance'),
      supabase
        .from('collections')
        .select('amount')
        .eq('collected_by', profile.id)
        .eq('method', 'cash')
        .is('handover_id', null),
      supabase
        .from('collections')
        .select('id, receipt_no, amount, method, created_at, shops(name)')
        .eq('collected_by', profile.id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

  const balMap = new Map((bals ?? []).map((b) => [b.shop_id, Number(b.ledger_balance)]));
  const inHand = (pending ?? []).reduce((s, c) => s + Number(c.amount), 0);

  const list = (shops ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    owner: s.owner_name,
    phone: s.phone,
    route: one(s.routes as unknown as RouteRef | RouteRef[] | null)?.name ?? null,
    balance: balMap.get(s.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Recovery" subtitle="Collect old balances from shops" />

      <div className="hero relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/20">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-xs text-indigo-100">Cash in your hand (not yet handed over)</p>
            <p className="text-2xl font-bold">{rs(inHand)}</p>
          </div>
        </div>
      </div>

      <RecoveryList shops={list} collect={collect} />

      {!!recent?.length && (
        <div className="card">
          <h2 className="flex items-center gap-2 p-4 pb-2 font-bold text-slate-900">
            <Receipt size={18} className="text-indigo-600" />
            Your recent receipts
          </h2>
          <div className="divide-y divide-slate-100">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/recovery/receipt/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {one(r.shops as unknown as RouteRef | RouteRef[] | null)?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {docNo('RC-', r.receipt_no)} · {r.method} · {when(r.created_at)}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{rs(r.amount)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}