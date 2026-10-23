import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CheckCircle2, ExternalLink, ImageOff, MapPin, Phone, ShieldAlert, Store, UserRound } from 'lucide-react';
import { requireProfile, canManage } from '@/lib/auth';
import { one, when } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

function goBack(kind: 'ok' | 'error', msg: string): never {
  redirect(`/new-shops?${kind}=${encodeURIComponent(msg)}`);
}

async function approveShop(fd: FormData) {
  'use server';
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) goBack('error', 'Not allowed');

  const credit = Number(String(fd.get('credit_limit') ?? '').trim() || 0);
  if (!(credit >= 0)) goBack('error', 'Enter a valid credit limit');

  const { error } = await supabase.rpc('approve_shop', {
    p_shop: String(fd.get('shop_id') ?? ''),
    p_credit_limit: credit,
  });
  revalidatePath('/new-shops');
  revalidatePath('/shops');
  if (error) goBack('error', error.message.replace(/^[A-Z_]+:\s*/, ''));
  goBack('ok', 'Shop approved. Its orders can now be approved.');
}

async function rejectShop(fd: FormData) {
  'use server';
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) goBack('error', 'Not allowed');

  const { error } = await supabase.rpc('reject_shop', {
    p_shop: String(fd.get('shop_id') ?? ''),
  });
  revalidatePath('/new-shops');
  revalidatePath('/shops');
  revalidatePath('/orders');
  if (error) goBack('error', error.message.replace(/^[A-Z_]+:\s*/, ''));
  goBack('ok', 'Shop rejected and removed. Its pending orders were rejected.');
}

type Named = { name?: string; full_name?: string };

export default async function NewShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!canManage(profile.role)) redirect('/');

  const [{ data: shops }, { data: active }] = await Promise.all([
    supabase
      .from('shops')
      .select(
        'id, name, owner_name, phone, address, lat, lng, photo_path, created_at, routes(name), creator:profiles!shops_created_by_fkey(full_name)'
      )
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('shops').select('name').eq('status', 'active').is('deleted_at', null).limit(5000),
  ]);

  const activeNames = new Set((active ?? []).map((s) => String(s.name).trim().toLowerCase()));

  const paths = (shops ?? []).map((s) => s.photo_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from('shop-photos').createSignedUrls(paths, 3600);
    for (const u of data ?? []) {
      if (u.signedUrl && u.path) urls.set(u.path, u.signedUrl);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="New shops"
        subtitle={`${shops?.length ?? 0} waiting for your approval`}
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

      {!shops?.length ? (
        <EmptyState
          icon={Store}
          title="No new shops waiting"
          hint="Shops added by salesmen from the app appear here for approval."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shops.map((s) => {
            const route = one(s.routes as unknown as Named | Named[] | null);
            const by = one(s.creator as unknown as Named | Named[] | null);
            const photo = s.photo_path ? urls.get(s.photo_path) : undefined;
            const similar = activeNames.has(String(s.name).trim().toLowerCase());
            return (
              <div key={s.id} className="card overflow-hidden">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={`Photo of ${s.name}`} className="aspect-video w-full bg-slate-100 object-cover" />
                ) : (
                  <div className="grid aspect-video w-full place-items-center bg-slate-100 text-slate-400">
                    <div className="flex flex-col items-center gap-1 text-xs">
                      <ImageOff size={26} />
                      {s.photo_path ? 'Photo could not be loaded' : 'Photo not uploaded yet'}
                    </div>
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {route?.name ?? 'No route'} · added by {by?.full_name ?? 'staff'} · {when(s.created_at)}
                    </p>
                  </div>

                  {similar && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      A shop with the same name already exists. Check it is not a duplicate.
                    </p>
                  )}

                  <div className="space-y-1.5 text-sm text-slate-600">
                    {s.owner_name && (
                      <p className="flex items-center gap-2">
                        <UserRound size={14} className="text-slate-400" />
                        {s.owner_name}
                      </p>
                    )}
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-indigo-600">
                        <Phone size={14} />
                        {s.phone}
                      </a>
                    )}
                    {s.address && (
                      <p className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {s.address}
                      </p>
                    )}
                    {s.lat != null && s.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 font-semibold text-indigo-600"
                      >
                        <ExternalLink size={14} />
                        View location on map
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">No GPS location was captured.</p>
                    )}
                  </div>

                  <form action={approveShop} className="flex gap-2 border-t border-slate-100 pt-3">
                    <input type="hidden" name="shop_id" value={s.id} />
                    <input
                      name="credit_limit"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="Credit limit (0 = no limit)"
                      className="field py-2.5"
                    />
                    <button className="btn-primary shrink-0 px-5 py-2.5">Approve</button>
                  </form>

                  <details>
                    <summary className="cursor-pointer list-none text-xs font-semibold text-red-600 [&::-webkit-details-marker]:hidden">
                      Reject this shop
                    </summary>
                    <form action={rejectShop} className="mt-2 flex items-center gap-3 rounded-xl bg-red-50 p-3">
                      <input type="hidden" name="shop_id" value={s.id} />
                      <p className="flex-1 text-xs text-red-700">
                        This removes the shop and rejects its waiting orders. It cannot be undone.
                      </p>
                      <button className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                        Confirm reject
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}