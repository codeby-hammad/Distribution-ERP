import { dateLabel, daysUntil } from '@/lib/format';

export default function ExpiryChip({ date }: { date: string | null }) {
  const base = 'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold';

  if (!date) {
    return <span className={`${base} bg-slate-100 text-slate-600`}>No expiry</span>;
  }

  const d = daysUntil(date);
  if (d < 0) {
    return <span className={`${base} bg-red-50 text-red-700`}>Expired {-d}d ago</span>;
  }
  if (d <= 30) {
    return (
      <span className={`${base} bg-amber-50 text-amber-700`}>
        {d === 0 ? 'Expires today' : `${d}d left`}
      </span>
    );
  }
  return <span className={`${base} bg-emerald-50 text-emerald-700`}>{dateLabel(date)}</span>;
}