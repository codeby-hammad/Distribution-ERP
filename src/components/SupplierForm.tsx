type S = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export default function SupplierForm({
  action,
  supplier,
}: {
  action: (fd: FormData) => Promise<void>;
  supplier?: S;
}) {
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <div className="col-span-2">
        <label className="label">Supplier / brand name</label>
        <input
          name="name"
          required
          defaultValue={supplier?.name}
          className="field"
          placeholder="e.g. Candyland Pvt Ltd"
        />
      </div>

      <div>
        <label className="label">Contact person</label>
        <input name="contact_name" defaultValue={supplier?.contact_name ?? ''} className="field" placeholder="Sales rep name" />
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={supplier?.phone ?? ''}
          className="field"
          placeholder="03xx xxxxxxx"
        />
      </div>

      <div className="col-span-2">
        <label className="label">Address</label>
        <input name="address" defaultValue={supplier?.address ?? ''} className="field" placeholder="City, area" />
      </div>

      <div className="col-span-2">
        <label className="label">Notes (optional)</label>
        <input
          name="notes"
          defaultValue={supplier?.notes ?? ''}
          className="field"
          placeholder="e.g. Orders every Monday, 30 days credit"
        />
      </div>

      <button className="btn-primary col-span-2 mt-1">
        {supplier ? 'Save changes' : 'Save supplier'}
      </button>
    </form>
  );
}