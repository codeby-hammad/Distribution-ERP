import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Building2, CheckCircle2, Coins, Phone, Search, ShieldAlert, Trash2, Wallet } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';
import EmptyState from '@/components/EmptyState';
import SupplierForm from '@/components/SupplierForm';

function fail(msg: string): never {
  redirect('/suppliers?error=' + encodeURIComponent(msg));
}

function parse(fd: FormData) {
  const name = String(fd.get('name') ?? '').trim();
  if (!name) return { error: 'Enter the supplier name' };
  const t = (k: string) => String(fd.get(k) ?? '').trim() || null;
  return {
    value: {
      name,
      contact_name: t('contact_name'),
      phone: t('phone'),
      address: t('address'),
      notes: t('notes'),
    },
  };
}

const DUP = 'A supplier with this name already exists';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/');

  async function addSupplier(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

       const p = parse(fd);
    if (p.error !== undefined || !p.value) fail(p.error ?? 'Invalid data');

    const { error } = await supabase
      .from('companies')
      .insert({ tenant_id: profile.tenant_id, ...p.value });
    if (error) fail(error.code === '23505' ? DUP : error.message);

    revalidatePath('/suppliers');
    redirect('/suppliers?ok=' + encodeURIComponent('Supplier added'));
  }

  async function updateSupplier(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

    const id = String(fd.get('id') ?? '');
        const p = parse(fd);
    if (p.error !== undefined || !p.value) fail(p.error ?? 'Invalid data');

    const { error } = await supabase
      .from('companies')
      .update(p.value)
      .eq('id', id)
      .is('deleted_at', null);
    if (error) fail(error.code === '23505' ? DUP : error.message);

    revalidatePath('/suppliers');
    revalidatePath('/products');
    redirect('/suppliers?ok=' + encodeURIComponent('Supplier updated'));
  }

  async function deleteSupplier(fd: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) fail('Not allowed');

    const id = String(fd.get('id') ?? '');
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', id)
      .is('deleted_at', null);
    if (count) {
      fail(`This supplier still has ${count} ${count === 1 ? 'product' : 'products'}. Move or delete them first.`);
    }

    const { error } = await supabase
      .from('companies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) fail(error.message);

    revalidatePath('/suppliers');
    redirect('/suppliers?ok=' + encodeURIComponent('Supplier deleted'));
  }

  const [{ data: companies }, { data: stats }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, contact_name, phone, address, notes')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('supplier_stats')
      .select('supplier_id, total_purchased, purchase_count, last_on, product_count, investment'),
  ]);

  const statMap = new Map((stats ?? []).map((s) => [s.supplier_id, s]));
  const list = (companies ?? []).filter(
    (c) => !q || `${c.name} ${c.contact_name ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q)
  );

  const totalPurchased = (stats ?? []).reduce((s, x) => s + Number(x.total_purchased), 0);
  const totalInvest = (stats ?? []).reduce((s, x) => s + Number(x.investment), 0);

  const top = [
    { l: 'Suppliers', v: String(companies?.length ?? 0), icon: Building2, tint: 'bg-indigo-50 text-indigo-600' },
    { l: 'Total purchased', v: rs(totalPurchased), icon: Wallet, tint: 'bg-violet-50 text-violet-600' },
    { l: 'Stock investment', v: rs(totalInvest), icon: Coins, tint: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        subtitle="Companies and brands you buy from"
        action={
          <AddSheet label="Add" title="New supplier">
            <SupplierForm action={addSupplier} />
          </AddSheet>
        }
      />

      {sp.ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{sp.ok}</p>
        </div>
      )}
      {sp.error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{sp.error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {top.map((x) => (
          <div key={x.l} className="card p-4">
            <div className={`mb-3 grid size-10 place-items-center rounded-xl ${x.tint}`}>
              <x.icon size={20} />
            </div>
            <p className="text-base font-bold text-slate-900 md:text-2xl">{x.v}</p>
            <p className="text-xs text-slate-500">{x.l}</p>
          </div>
        ))}
      </div>

      <form className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search supplier, contact or phone"
          className="field pl-10"
        />
      </form>

      {!companies?.length ? (
        <EmptyState
          icon={Building2}
          title="No suppliers yet"
          hint="Add the companies you buy from, then pick them on products and when restocking."
        />
      ) : !list.length ? (
        <div className="card p-10 text-center text-sm text-slate-400">No suppliers match your search.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => {
            const st = statMap.get(c.id);
            return (
              <div key={c.id} className="card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/suppliers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="hero grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[c.contact_name, c.phone].filter(Boolean).join(' · ') || 'No contact details'}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center">
                    <AddSheet variant="edit" title={`Edit ${c.name}`}>
                      <SupplierForm action={updateSupplier} supplier={c} />
                    </AddSheet>
                    <form action={deleteSupplier}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        aria-label="Delete supplier"
                        className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    </form>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { l: 'Products', v: String(st?.product_count ?? 0) },
                    { l: 'Stock investment', v: rs(st?.investment) },
                    { l: 'Total purchased', v: rs(st?.total_purchased) },
                    { l: 'Last purchase', v: st?.last_on ? dateLabel(st.last_on) : '-' },
                  ].map((b) => (
                    <div key={b.l} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{b.l}</p>
                      <p className="text-sm font-bold text-slate-900">{b.v}</p>
                    </div>
                  ))}
                </div>

                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm font-medium text-indigo-600">
                    <Phone size={14} />
                    {c.phone}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}