const STYLES: Record<string, string> = {
  booked: 'bg-amber-50 text-amber-700',
  draft: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  loaded: 'bg-sky-50 text-sky-700',
  issued: 'bg-sky-50 text-sky-700',
  rejected: 'bg-red-50 text-red-700',
  returned: 'bg-red-50 text-red-700',
  partial: 'bg-amber-50 text-amber-700',
  in_trip: 'bg-sky-50 text-sky-700',
  delivered: 'bg-indigo-50 text-indigo-700',
  settled: 'bg-indigo-50 text-indigo-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

const LABELS: Record<string, string> = {
  booked: 'Pending',
  in_trip: 'In trip',
};

export default function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
        STYLES[status] ?? STYLES.cancelled
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}