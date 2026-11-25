'use client';

import { useState } from 'react';

type Opt = { id: string; name: string };

export default function SchemeForm({
  action,
  products,
  companies,
  today,
  defaultEnd,
}: {
  action: (fd: FormData) => Promise<void>;
  products: Opt[];
  companies: Opt[];
  today: string;
  defaultEnd: string;
}) {
  const [target, setTarget] = useState('');
  const [type, setType] = useState<'bonus' | 'percent' | 'flat'>('bonus');
  const [unit, setUnit] = useState<'ctn' | 'pcs'>('ctn');

  const isCompany = target.startsWith('company:');
  const u = unit === 'pcs' ? 'pieces' : 'cartons';

  function onTarget(v: string) {
    setTarget(v);
    if (v.startsWith('company:')) {
      setUnit('ctn');
      if (type === 'bonus') setType('percent');
    }
  }

  const preview =
    type === 'bonus'
      ? `Buy X ${u}, get Y ${u} free`
      : type === 'percent'
        ? `Percent off when buying X ${u}`
        : `Rs off per ${unit === 'pcs' ? 'piece' : 'carton'} when buying X ${u}`;

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="label">Scheme name</label>
        <input name="name" required className="field" placeholder="e.g. Oct biscuit 10+1" />
      </div>

      <div className="col-span-2">
        <label className="label">Applies to</label>
        <select name="target" required value={target} onChange={(e) => onTarget(e.target.value)} className="field">
          <option value="" disabled>
            Choose a product or company
          </option>
          <optgroup label="One product">
            {products.map((p) => (
              <option key={p.id} value={`product:${p.id}`}>{p.name}</option>
            ))}
          </optgroup>
          <optgroup label="Whole company">
            {companies.map((c) => (
              <option key={c.id} value={`company:${c.id}`}>All {c.name} products</option>
            ))}
          </optgroup>
        </select>
        {isCompany && (
          <p className="mt-1 text-[11px] text-amber-600">Company schemes work in cartons and cannot be bonus.</p>
        )}
      </div>

      <div>
        <label className="label">Type</label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="field">
          <option value="bonus" disabled={isCompany}>Bonus (10+1)</option>
          <option value="percent">Percent off</option>
          <option value="flat">Rs off per unit</option>
        </select>
      </div>
      <div>
        <label className="label">Unit</label>
        {isCompany && <input type="hidden" name="unit" value="ctn" />}
        <select
          name={isCompany ? undefined : 'unit'}
          value={unit}
          disabled={isCompany}
          onChange={(e) => setUnit(e.target.value as typeof unit)}
          className="field"
        >
          <option value="ctn">Cartons</option>
          <option value="pcs">Pieces</option>
        </select>
      </div>

      <p className="col-span-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800">{preview}</p>

      <div>
        <label className="label">Buy at least ({unit})</label>
        <input type="number" name="min_cartons" min={1} step={1} required className="field" placeholder="10" />
      </div>

      {type === 'bonus' && (
        <div>
          <label className="label">Free quantity ({unit})</label>
          <input type="number" name="bonus_cartons" min={1} step={1} required className="field" placeholder="1" />
        </div>
      )}
      {type === 'percent' && (
        <div>
          <label className="label">Percent off (%)</label>
          <input type="number" name="percent" min={0.01} max={100} step="0.01" required className="field" placeholder="5" />
        </div>
      )}
      {type === 'flat' && (
        <div>
          <label className="label">Rs off per {unit === 'pcs' ? 'piece' : 'carton'}</label>
          <input type="number" name="flat_per_carton" min={0.01} step="0.01" required className="field" placeholder="50" />
        </div>
      )}

      <div>
        <label className="label">Starts</label>
        <input type="date" name="valid_from" defaultValue={today} required className="field" />
      </div>
      <div>
        <label className="label">Ends</label>
        <input type="date" name="valid_to" defaultValue={defaultEnd} required className="field" />
      </div>

      <p className="col-span-2 text-xs text-slate-500">
        Only the best scheme applies per product. To change a scheme, switch it off and add a new one.
      </p>

      <button className="btn-primary col-span-2">Save scheme</button>
    </form>
  );
}