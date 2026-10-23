export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}