import { revalidatePath } from 'next/cache';
import { Percent, Phone, Store } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';
import EmptyState from '@/components/EmptyState';
import Link from 'next/link';

const TAX_BADGE: Record<string, { t: string; c: string }> = {
  filer: { t: 'Filer', c: 'bg-emerald-50 text-emerald-700' },
  non_filer: { t: 'Non-filer', c: 'bg-amber-50 text-amber-700' },
};

export default async function ShopsPage() {
  const { supabase, profile } = await requireProfile();

  async function addShop(formData: FormData) {
    'use server';
    const { supabase, profile } = await requireProfile();
    if (!canManage(profile.role)) return;
    await supabase.from('shops').insert({
      tenant_id: profile.tenant_id,
      route_id: String(formData.get('route_id')) || null,
      name: String(formData.get('name')).trim(),
      owner_name: String(formData.get('owner_name') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      credit_limit: Number(formData.get('credit_limit')) || 0,
      opening_balance: Number(formData.get('opening_balance')) || 0,
    });
    revalidatePath('/shops');
  }

  const [{ data: routes }, { data: shops }] = await Promise.all([
    supabase.from('routes').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('shops')
      .select('id, name, owner_name, phone, credit_limit, opening_balance, tax_status, routes(name)')
      .is('deleted_at', null)
      .order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Shops"
        subtitle={`${shops?.length ?? 0} customers`}
        action={
          canManage(profile.role) && (
            <div className="flex items-center gap-2">
              <Link
                href="/shops/tax"
                className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-700 ring-1 ring-slate-200 transition hover:bg-indigo-50"
              >
                <Percent size={16} />
                Tax status
              </Link>
              <AddSheet label="Add" title="New shop">
                <form action={addShop} className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Shop name</label>
                    <input name="name" required className="field" placeholder="e.g. Ali General Store" />
                  </div>
                  <div>
                    <label className="label">Owner</label>
                    <input name="owner_name" className="field" placeholder="Owner name" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input name="phone" type="tel" inputMode="tel" className="field" placeholder="03xx xxxxxxx" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Route</label>
                    <select name="route_id" defaultValue="" className="field">
                      <option value="">No route</option>
                      {routes?.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Credit limit (Rs)</label>
                    <input name="credit_limit" type="number" inputMode="numeric" min={0} className="field" placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Opening balance (Rs)</label>
                    <input name="opening_balance" type="number" inputMode="numeric" className="field" placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Address</label>
                    <input name="address" className="field" placeholder="Market, area" />
                  </div>
                  <button className="btn-primary col-span-2 mt-1">Save shop</button>
                </form>
              </AddSheet>
            </div>
          )
        }
      />

      {!shops?.length ? (
        <EmptyState icon={Store} title="No shops yet" hint="Add your first customer shop." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => {
            const tax = TAX_BADGE[s.tax_status as string];
            return (
              <div key={s.id} className="card p-4">
                <Link href={`/shops/${s.id}`} className="flex items-center gap-3">
                  <div className="hero grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{s.owner_name ?? 'No owner name'}</p>
                  </div>
                  {tax && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tax.c}`}>{tax.t}</span>
                  )}
                </Link>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Credit limit</p>
                    <p className="text-sm font-semibold text-slate-900">{rs(s.credit_limit)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Opening balance</p>
                    <p className="text-sm font-semibold text-slate-900">{rs(s.opening_balance)}</p>
                  </div>
                </div>

                {s.phone && (
                  <a href={`tel:${s.phone}`} className="mt-3 flex items-center gap-2 text-sm font-medium text-indigo-600">
                    <Phone size={14} />
                    {s.phone}
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