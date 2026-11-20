'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Truck, X } from 'lucide-react';
import { rs } from '@/lib/format';

type O = { id: string; orderNo: number; shop: string; by: string; when: string; total: number; routeId: string | null };
type DM = { id: string; name: string; vehicle: string };
type WH = { id: string; name: string };

export default function TripSelect({
  orders,
  deliveryMen,
  warehouses,
  submit,
}: {
  orders: O[];
  deliveryMen: DM[];
  warehouses: WH[];
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const tripId = useRef('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [dm, setDm] = useState('');
  const [wh, setWh] = useState(warehouses[0]?.id ?? '');
  const [vehicle, setVehicle] = useState('');
  const [error, setError] = useState('');

  const chosen = useMemo(() => orders.filter((o) => sel.has(o.id)), [orders, sel]);
  const total = chosen.reduce((s, o) => s + o.total, 0);
  const routes = new Set(chosen.map((o) => o.routeId ?? ''));
  const mixed = routes.size > 1;
  const routeId = routes.size === 1 && chosen[0]?.routeId ? chosen[0].routeId : null;

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function openSheet() {
    tripId.current = crypto.randomUUID();
    setError('');
    setOpen(true);
  }

  function onDm(id: string) {
    setDm(id);
    const m = deliveryMen.find((d) => d.id === id);
    if (m?.vehicle) setVehicle(m.vehicle);
  }

  function create() {
    setError('');
    if (!wh) return setError('No warehouse found');
    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: tripId.current,
          warehouse_id: wh,
          route_id: routeId,
          delivery_man_id: dm || null,
          vehicle_no: vehicle.trim() || null,
          order_ids: Array.from(sel),
        })
      );
      if (res.error) return setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      router.push(`/trips/${res.id ?? tripId.current}`);
    });
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between text-xs">
        <p className="text-slate-500">Tick approved orders to put them on one trip.</p>
        <button
          type="button"
          onClick={() => setSel(sel.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)))}
          className="font-semibold text-indigo-600"
        >
          {sel.size === orders.length ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <div className="grid gap-3 pb-24 md:grid-cols-2">
        {orders.map((o) => (
          <label
            key={o.id}
            className={`card flex cursor-pointer items-center gap-3 p-4 transition ${
              sel.has(o.id) ? 'ring-2 ring-indigo-400' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={sel.has(o.id)}
              onChange={() => toggle(o.id)}
              className="size-5 shrink-0 accent-indigo-600"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{o.shop}</p>
              <p className="truncate text-xs text-slate-500">
                #{o.orderNo} · {o.by} · {o.when}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">{rs(o.total)}</p>
              <Link
                href={`/orders/${o.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold text-indigo-600"
              >
                Open
              </Link>
            </div>
          </label>
        ))}
      </div>

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-40 px-3 md:bottom-4 md:left-72">
          <button
            type="button"
            onClick={openSheet}
            className="hero mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl px-4 py-3 text-white shadow-xl shadow-indigo-500/30"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Truck size={18} /> {sel.size} selected · {rs(total)}
            </span>
            <span className="text-sm font-bold">Create trip</span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New trip</h2>
                <p className="text-sm text-slate-500">
                  {sel.size} orders · {rs(total)}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <X size={18} />
              </button>
            </div>

            {mixed && (
              <p className="mb-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                These orders are on different routes. The trip will have no single route.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Delivery man</label>
                <select value={dm} onChange={(e) => onDm(e.target.value)} className="field">
                  <option value="">Not assigned yet</option>
                  {deliveryMen.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Vehicle number</label>
                <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="field" placeholder="Optional" />
              </div>
              {warehouses.length > 1 && (
                <div>
                  <label className="label">Warehouse</label>
                  <select value={wh} onChange={(e) => setWh(e.target.value)} className="field">
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-slate-400">The trip is created as a draft. Stock moves only when you load it.</p>

            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}

            <button onClick={create} disabled={pending} className="btn-primary mt-4 w-full disabled:opacity-60">
              {pending ? 'Creating...' : 'Create trip'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}