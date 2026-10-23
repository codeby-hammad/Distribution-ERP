import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getCompany } from '@/lib/company';
import PageHeader from '@/components/PageHeader';
import { saveCompanyAction } from './actions';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { ok, err } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== 'owner') redirect('/');

  const c = await getCompany(supabase);

  return (
    <div className="space-y-4">
      <PageHeader title="Company settings" subtitle="Shown on invoices, statements and printouts" />

      {err && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{err}</div>}
      {ok && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          Settings saved.
        </div>
      )}

      <form action={saveCompanyAction} className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt="Logo" className="size-20 rounded-xl border border-slate-200 object-contain" />
          ) : (
            <div className="grid size-20 place-items-center rounded-xl bg-slate-50 text-xs text-slate-400">No logo</div>
          )}
          <div className="flex-1">
            <label className="label">Logo (PNG, JPG or WebP, under 1 MB)</label>
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="field py-2" />
            {c.logoUrl && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="remove_logo" value="1" className="size-4 accent-indigo-600" />
                Remove current logo
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="label">Company name</label>
          <input name="name" required defaultValue={c.name} className="field" />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea name="address" rows={2} defaultValue={c.address ?? ''} className="field" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={c.phone ?? ''} className="field" />
          </div>
          <div>
            <label className="label">NTN</label>
            <input name="ntn" defaultValue={c.ntn ?? ''} className="field" />
          </div>
          <div>
            <label className="label">STRN</label>
            <input name="strn" defaultValue={c.strn ?? ''} className="field" />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" name="tax_enabled" value="1" defaultChecked={c.taxEnabled} className="size-4 accent-indigo-600" />
            Show sales tax on invoices
          </label>
                    <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rate for filer shops (%)</label>
              <input type="number" name="tax_rate_filer" min={0} max={100} step="0.01" defaultValue={c.taxRateFiler} className="field" />
            </div>
            <div>
              <label className="label">Rate for non-filer shops (%)</label>
              <input type="number" name="tax_rate_nonfiler" min={0} max={100} step="0.01" defaultValue={c.taxRateNonFiler} className="field" />
            </div>
          </div>
          <p className="text-xs text-slate-500">Shops with no status use the filer rate. Prices are treated as including the tax. Confirm the rates with your accountant.</p>
        </div>

        <div>
          <label className="label">Invoice footer</label>
          <textarea
            name="invoice_footer"
            rows={3}
            defaultValue={c.invoice_footer ?? ''}
            className="field"
            placeholder="e.g. Goods once sold will not be returned. Cheques in favour of ..."
          />
        </div>

        <button className="btn-primary w-full">Save settings</button>
      </form>
    </div>
  );
}