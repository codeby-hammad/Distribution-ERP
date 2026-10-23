import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  Boxes,
  Briefcase,
  CheckCircle2,
  Crown,
  KeyRound,
  Search,
  ShieldAlert,
  ShoppingBag,
  Truck,
  UserCheck,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import PageHeader from '@/components/PageHeader';
import AddSheet from '@/components/AddSheet';

const ROLES = [
  { value: 'manager', label: 'Manager', hint: 'Approves orders, creates trips, manages products, shops and cash' },
  { value: 'salesman', label: 'Salesman', hint: 'Books orders and collects recovery. Sees only his own orders' },
  { value: 'delivery', label: 'Delivery man', hint: 'Sees only his own trips, prints invoices, records recovery' },
  { value: 'cashier', label: 'Cashier', hint: 'Settles trips, receives cash, prints statements' },
  { value: 'warehouse', label: 'Warehouse keeper', hint: 'Receives stock and loads trips' },
];

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  ...Object.fromEntries(ROLES.map((r) => [r.value, r.label])),
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'owner', label: 'Owner' },
  { key: 'manager', label: 'Managers' },
  { key: 'salesman', label: 'Salesmen' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'cashier', label: 'Cashiers' },
  { key: 'warehouse', label: 'Warehouse' },
];

// full class names so Tailwind keeps them
const ROLE_STYLE: Record<string, { avatar: string; chip: string; icon: typeof Users }> = {
  owner: { avatar: 'from-violet-500 to-fuchsia-500', chip: 'bg-violet-50 text-violet-700', icon: Crown },
  manager: { avatar: 'from-indigo-500 to-blue-500', chip: 'bg-indigo-50 text-indigo-700', icon: Briefcase },
  salesman: { avatar: 'from-sky-500 to-cyan-500', chip: 'bg-sky-50 text-sky-700', icon: ShoppingBag },
  delivery: { avatar: 'from-amber-500 to-orange-500', chip: 'bg-amber-50 text-amber-700', icon: Truck },
  cashier: { avatar: 'from-emerald-500 to-teal-500', chip: 'bg-emerald-50 text-emerald-700', icon: Wallet },
  warehouse: { avatar: 'from-rose-500 to-pink-500', chip: 'bg-rose-50 text-rose-700', icon: Boxes },
};

const toEmail = (v: string) => {
  const s = v.trim().toLowerCase();
  return s.includes('@') ? s : `${s}@erp.local`;
};

const showLogin = (email: string) => email.replace(/@erp\.local$/, '');

function back(kind: 'ok' | 'error', msg: string): never {
  redirect(`/staff?${kind}=${encodeURIComponent(msg)}`);
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; role?: string }>;
}) {
  const { ok, error, q = '', role: roleParam = 'all' } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== 'owner') redirect('/');

  async function createStaff(fd: FormData) {
    'use server';
    const { profile } = await requireProfile();
    if (profile.role !== 'owner') back('error', 'Only the owner can add staff');

    const name = String(fd.get('full_name') ?? '').trim();
    const login = String(fd.get('login') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const role = String(fd.get('role') ?? '');
    const vehicle = String(fd.get('vehicle_no') ?? '').trim().toUpperCase().slice(0, 20);


    if (!name || !login) back('error', 'Enter a name and a login');
    if (!/^[a-z0-9._+@-]+$/i.test(login)) {
      back('error', 'Login can only contain letters, numbers and . _ - + @');
    }
    if (!ROLES.some((r) => r.value === role)) back('error', 'Choose a role');
    if (password.length < 8) back('error', 'Password must be at least 8 characters');

    const admin = adminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: toEmail(login),
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
      app_metadata: { role },
    });
    if (error || !data.user) back('error', error?.message ?? 'Could not create the login');

        const { error: pErr } = await admin.from('profiles').insert({
      id: data.user.id,
      tenant_id: profile.tenant_id,
      full_name: name,
      role,
      vehicle_no: role === 'delivery' && vehicle ? vehicle : null,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      back('error', pErr.message);
    }

    revalidatePath('/staff');
    back('ok', `${name} can now sign in`);
  }

  async function setActive(fd: FormData) {
    'use server';
    const { profile } = await requireProfile();
    if (profile.role !== 'owner') back('error', 'Only the owner can change staff');

    const id = String(fd.get('id') ?? '');
    const active = fd.get('active') === '1';
    if (id === profile.id) back('error', "You can't change your own account");

    const admin = adminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('id, role, tenant_id, full_name')
      .eq('id', id)
      .maybeSingle();
    if (!target || target.tenant_id !== profile.tenant_id) back('error', 'Staff member not found');
    if (target.role === 'owner') back('error', "The owner account can't be deactivated");

    const { error } = await admin.from('profiles').update({ is_active: active }).eq('id', id);
    if (error) back('error', error.message);

    const { error: banErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (banErr) back('error', banErr.message);

    revalidatePath('/staff');
    back('ok', `${target.full_name} is now ${active ? 'active' : 'deactivated'}`);
  }

  async function resetPassword(fd: FormData) {
    'use server';
    const { profile } = await requireProfile();
    if (profile.role !== 'owner') back('error', 'Only the owner can reset passwords');

    const id = String(fd.get('id') ?? '');
    const password = String(fd.get('password') ?? '');
    if (password.length < 8) back('error', 'Password must be at least 8 characters');

    const admin = adminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('id, tenant_id, full_name')
      .eq('id', id)
      .maybeSingle();
    if (!target || target.tenant_id !== profile.tenant_id) back('error', 'Staff member not found');

    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) back('error', error.message);

    back('ok', `Password changed for ${target.full_name}`);
  }
    async function setVehicle(fd: FormData) {
    'use server';
    const { profile } = await requireProfile();
    if (profile.role !== 'owner') back('error', 'Only the owner can change staff');

    const id = String(fd.get('id') ?? '');
    const vehicle = String(fd.get('vehicle_no') ?? '').trim().toUpperCase().slice(0, 20);

    const admin = adminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('id, tenant_id, full_name, role')
      .eq('id', id)
      .maybeSingle();
    if (!target || target.tenant_id !== profile.tenant_id || target.role !== 'delivery') {
      back('error', 'Delivery man not found');
    }

    const { error } = await admin.from('profiles').update({ vehicle_no: vehicle || null }).eq('id', id);
    if (error) back('error', error.message);

    revalidatePath('/staff');
    back('ok', `Vehicle saved for ${target.full_name}`);
  }

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, vehicle_no')
    .order('full_name');

  const logins = new Map<string, string>();
  try {
    const admin = adminClient();
    await Promise.all(
      (staff ?? []).map(async (s) => {
        const { data } = await admin.auth.admin.getUserById(s.id);
        logins.set(s.id, data.user?.email ?? '');
      })
    );
  } catch {}

  const all = staff ?? [];
  const activeCount = all.filter((s) => s.is_active !== false).length;
  const offCount = all.length - activeCount;

  const roleKey = FILTERS.some((f) => f.key === roleParam) ? roleParam : 'all';
  const needle = q.trim().toLowerCase();

  const shown = all.filter((s) => {
    if (roleKey !== 'all' && s.role !== roleKey) return false;
    if (!needle) return true;
    const login = showLogin(logins.get(s.id) ?? '').toLowerCase();
    return (
      s.full_name.toLowerCase().includes(needle) ||
      login.includes(needle) ||
      (ROLE_LABEL[s.role] ?? s.role).toLowerCase().includes(needle)
    );
  });

  const countFor = (key: string) => (key === 'all' ? all.length : all.filter((s) => s.role === key).length);
  const href = (key: string) => `/staff?role=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle="Create logins and control who can do what"
        action={
          <AddSheet label="Add" title="New staff login">
            <form action={createStaff} className="space-y-3">
              <div>
                <label className="label">Full name</label>
                <input name="full_name" required className="field" placeholder="e.g. Ali Raza" />
              </div>
              <div>
                <label className="label">Login (email or username)</label>
                <input
                  name="login"
                  required
                  autoCapitalize="none"
                  className="field"
                  placeholder="ali.sales or ali@gmail.com"
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" required defaultValue="" className="field">
                  <option value="" disabled>Select a role</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Vehicle no. (delivery man only)</label>
                <input name="vehicle_no" className="field" placeholder="e.g. LEB-1234" />
              </div>
              <div>
                <label className="label">Password (min 8 characters)</label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="field"
                />
              </div>
              <button className="btn-primary w-full">Create login</button>
            </form>
          </AddSheet>
        }
      />

      {ok && (
        <div className="flex gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{ok}</p>
        </div>
      )}
      {error && (
        <div className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Summary boxes */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="card p-3 md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{all.length}</p>
          <p className="text-[11px] font-semibold text-slate-500">Total staff</p>
        </div>
        <div className="card p-3 md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <UserCheck size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{activeCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Active</p>
        </div>
        <div className="card p-3 md:p-4">
          <div className="mb-2 grid size-8 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <UserX size={16} />
          </div>
          <p className="text-xl font-extrabold text-slate-900 md:text-2xl">{offCount}</p>
          <p className="text-[11px] font-semibold text-slate-500">Deactivated</p>
        </div>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        <input type="hidden" name="role" value={roleKey} />
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, login or role"
            autoCapitalize="none"
            className="field pl-10"
          />
        </div>
        {q && (
          <Link
            href={`/staff?role=${roleKey}`}
            aria-label="Clear search"
            className="grid w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200"
          >
            <X size={17} />
          </Link>
        )}
        <button className="btn-primary shrink-0 px-5">Search</button>
      </form>

      {/* Role filter */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => {
          const n = countFor(f.key);
          if (f.key !== 'all' && n === 0 && roleKey !== f.key) return null;
          return (
            <Link
              key={f.key}
              href={href(f.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                roleKey === f.key
                  ? 'hero text-white shadow-md shadow-indigo-500/25'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-[11px] ${
                  roleKey === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Staff cards */}
      {shown.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-400">
            <Users size={22} />
          </div>
          <p className="font-semibold text-slate-900">No staff found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different name or choose All.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => {
            const self = s.id === profile.id;
            const active = s.is_active !== false;
            const login = showLogin(logins.get(s.id) ?? '');
            const st = ROLE_STYLE[s.role] ?? ROLE_STYLE.manager;
            const RoleIcon = st.icon;
            return (
              <div key={s.id} className={`card flex flex-col overflow-hidden ${active ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3 p-4">
                  <div className="relative shrink-0">
                    <div
                      className={`grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-md ${st.avatar}`}
                    >
                      {s.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white ${
                        active ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">
                      {s.full_name}
                      {self && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{login || 'Login hidden'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.chip}`}
                      >
                        <RoleIcon size={12} />
                        {ROLE_LABEL[s.role] ?? s.role}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  </div>
                </div>

                {!self && s.role !== 'owner' && (
                  <div className="mt-auto space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                                        {s.role === 'delivery' && s.vehicle_no && (
                      <p className="truncate text-xs font-semibold text-slate-600">Vehicle {s.vehicle_no}</p>
                    )}
                                      {s.role === 'delivery' && (
                    <form action={setVehicle} className="flex gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        name="vehicle_no"
                        defaultValue={s.vehicle_no ?? ''}
                        placeholder="Vehicle no."
                        className="field py-2"
                      />
                      <button className="btn-primary shrink-0 px-4 py-2">Save</button>
                    </form>
                  )}


                    <details>


                      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-indigo-600 [&::-webkit-details-marker]:hidden">
                        <KeyRound size={15} />
                        Reset password
                      </summary>
                      <form action={resetPassword} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder="New password"
                          className="field py-2"
                        />
                        <button className="btn-primary shrink-0 px-4 py-2">Save</button>
                      </form>
                    </details>

                    <form action={setActive}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={active ? '0' : '1'} />
                      <button
                        className={`flex items-center gap-2 text-sm font-semibold ${
                          active ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {active ? <UserX size={15} /> : <UserCheck size={15} />}
                        {active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <details className="card p-5">
        <summary className="cursor-pointer list-none font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
          What each role can do
        </summary>
        <div className="mt-3 space-y-2.5">
          {ROLES.map((r) => (
            <div key={r.value} className="flex gap-3 text-sm">
              <span className="chip h-fit shrink-0">{r.label}</span>
              <p className="text-slate-600">{r.hint}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}