'use client';

import { useState } from 'react';

type P = {
  id: string;
  name: string;
  brand: string;
  companyId: string;
  sku: string;
  barcode: string;
  pcs: number;
  unit: number;
  minCtn: number;
};

const fmt = (x: number, d: number) => String(Math.round(x * 10 ** d) / 10 ** d);

export default function ProductForm({
  action,
  product,
  suppliers = [],
}: {
  action: (fd: FormData) => Promise<void>;
  product?: P;
  suppliers?: { id: string; name: string }[];
}) {
  const [pcs, setPcs] = useState(product ? String(product.pcs) : '');
  const [unit, setUnit] = useState(product ? fmt(product.unit, 4) : '');
  const [carton, setCarton] = useState(product ? fmt(product.unit * product.pcs, 2) : '');

  function onPcs(v: string) {
    setPcs(v);
    const k = Number(v);
    if (k > 0 && unit !== '') setCarton(fmt(Number(unit) * k, 2));
  }

  function onUnit(v: string) {
    setUnit(v);
    const k = Number(pcs);
    if (v === '') setCarton('');
    else if (k > 0) setCarton(fmt(Number(v) * k, 2));
  }

  function onCarton(v: string) {
    setCarton(v);
    const k = Number(pcs);
    if (v === '') setUnit('');
    else if (k > 0) setUnit(fmt(Number(v) / k, 4));
  }

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="col-span-2">
        <label className="label">Product name</label>
        <input
          name="name"
          required
          defaultValue={product?.name}
          className="field"
          placeholder="e.g. Chocolate wafer 24s"
        />
      </div>

            <div>
        <label className="label">Supplier / brand</label>
        <select name="company_id" defaultValue={product?.companyId ?? ''} className="field">
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {!suppliers.length && (
          <p className="mt-1 text-[11px] text-amber-600">Add suppliers on the Suppliers page first.</p>
        )}
      </div>
      <div>
        <label className="label">SKU (optional)</label>
        <input name="sku" defaultValue={product?.sku} className="field" placeholder="CW-24" />
      </div>

      <div className="col-span-2">
        <label className="label">Barcode (optional)</label>
        <input
          name="barcode"
          defaultValue={product?.barcode}
          inputMode="numeric"
          className="field"
          placeholder="Scan or type the barcode"
        />
      </div>

      <div>
        <label className="label">Pcs per carton</label>
        <input
          name="pcs_per_carton"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={pcs}
          onChange={(e) => onPcs(e.target.value)}
          className="field"
          placeholder="24"
        />
      </div>
      <div>
        <label className="label">Low stock alert (cartons)</label>
        <input
          name="min_stock_ctn"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          defaultValue={product ? product.minCtn : ''}
          className="field"
          placeholder="e.g. 5"
        />
      </div>

      <div>
        <label className="label">Sale price per carton (Rs)</label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={carton}
          onChange={(e) => onCarton(e.target.value)}
          className="field"
          placeholder="0"
        />
      </div>
      <div>
        <label className="label">Sale price per piece (Rs)</label>
        <input
          name="price_per_pcs"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          required
          value={unit}
          onChange={(e) => onUnit(e.target.value)}
          className="field"
          placeholder="0.00"
        />
      </div>

      <p className="col-span-2 text-xs text-slate-500">
        Enter either price and the other is calculated.
        {product && ' Changing pieces per carton changes how existing stock is shown in cartons.'}
      </p>

      <button className="btn-primary col-span-2 mt-1">
        {product ? 'Save changes' : 'Save product'}
      </button>
    </form>
  );
}