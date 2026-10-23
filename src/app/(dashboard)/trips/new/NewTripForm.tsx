'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { rs } from '@/lib/format';

type Opt = { id: string; name: string };
type Man = { id: string; name: string; vehicle: string };
type Ord = {
  id: string;
  no: number;
  total: number;
  shop: string;
  routeId: string | null;
  routeName: string;
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function NewTripForm({
  orders,
  routes,
  warehouses,
  deliveryMen,
  today,
  submit,
}: {
  orders: Ord[];
  routes: Opt[];
  warehouses: Opt[];
  deliveryMen: Man[];
  today: string;
  submit: (payload: string) => Promise<{ id?: string; error?: string }>;
}) {
  const router = useRouter();
  const [tripId] = useState(uid);
  const [routeId, setRouteId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [deliveryManId, setDeliveryManId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicleEdited, setVehicleEdited] = useState(false);
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const man = deliveryMen.find((m) => m.id === deliveryManId);

  function pickMan(id: string) {
    setDeliveryManId(id);
    const m = deliveryMen.find((x) => x.id === id);
    // auto-fill only if the user has not typed a vehicle by hand
    if (!vehicleEdited) setVehicle(m?.vehicle ?? '');
  }

  const visible = orders.filter((o) => !routeId || o.routeId === routeId);
  const selected = orders.filter((o) => picked.includes(o.id));
  const total = selected.reduce((s, o) => s + o.total, 0);
  const allVisiblePicked = visible.length > 0 && visible.every((o) => picked.includes(o.id));

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleAll = () =>
    setPicked(allVisiblePicked ? [] : visible.map((o) => o.id));

  function onSubmit() {
    setError('');
    if (!picked.length) return setError('Select at least one order');
    if (!warehouseId) return setError('No warehouse found');

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: tripId,
          trip_date: date,
          route_id: routeId,
          warehouse_id: warehouseId,
          vehicle_no: vehicle.trim().toUpperCase(),
          delivery_man_id: deliveryManId,
          order_ids: picked,
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else router.push(`/trips/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 gap-3 p-4">
        <div>
          <label className="label">Trip date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </div>
        <div>
          <label className="label">Delivery man (optional)</label>
          <select value={deliveryManId} onChange={(e) => pickMan(e.target.value)} className="field">
            <option value="">Not assigned</option>
            {deliveryMen.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Vehicle no.</label>
          <input
            value={vehicle}
            onChange={(e) => {
              setVehicle(e.target.value);
              setVehicleEdited(true);
            }}
            className="field"
            placeholder="e.g. LEA-1234"
          />
          {man?.vehicle ? (
            <p className="mt-1.5 text-xs text-slate-500">
              {man.name}&apos;s vehicle is <span className="font-semibold text-slate-700">{man.vehicle}</span>.
              {vehicle.trim().toUpperCase() !== man.vehicle.toUpperCase() && (
                <button
                  type="button"
                  onClick={() => {
                    setVehicle(man.vehicle);
                    setVehicleEdited(false);
                  }}
                  className="ml-1 font-semibold text-indigo-600"
                >
                  Use {man.vehicle}
                </button>
              )}
            </p>
          ) : man ? (
            <p className="mt-1.5 text-xs text-slate-400">No default vehicle saved for {man.name}. Type it here, or save it on the Staff page.</p>
          ) : null}
        </div>
        {warehouses.length > 1 && (
          <div className="col-span-2">
            <label className="label">Load from warehouse</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="field">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setPicked([]);
            }}
            className="field"
          >
            <option value="">All routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={toggleAll}
            className="shrink-0 rounded-xl bg-indigo-50 px-3 py-3 text-xs font-semibold text-indigo-700"
          >
            {allVisiblePicked ? 'Clear' : 'Select all'}
          </button>
        </div>

        {!visible.length ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No approved orders waiting for a trip.
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((o) => {
              const on = picked.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition ${
                    on ? 'bg-indigo-50 ring-indigo-300' : 'bg-white ring-slate-200'
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-lg ${
                      on ? 'hero text-white' : 'bg-slate-100 text-transparent'
                    }`}
                  >
                    <Check size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{o.shop}</span>
                    <span className="block truncate text-xs text-slate-500">
                      Order #{o.no} · {o.routeName}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-slate-900">{rs(o.total)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{selected.length} orders selected</span>
          <span className="text-2xl font-bold text-slate-900">{rs(total)}</span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">{error}</p>
        )}

        <button onClick={onSubmit} disabled={pending} className="btn-primary w-full disabled:opacity-60">
          {pending ? 'Creating...' : 'Create trip'}
        </button>
      </div>
    </div>
  );
}