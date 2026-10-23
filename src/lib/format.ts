const TZ = 'Asia/Karachi';

export const rs = (n: number | string | null | undefined) =>
  'Rs ' + Number(n ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });

export function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });

export const todayPK = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

export const daysUntil = (date: string) =>
  Math.round((Date.parse(date) - Date.parse(todayPK())) / 86400000);

export const dateLabel = (date: string) =>
  new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function ctn(qty: number, perCarton: number) {
  const c = Math.floor(qty / perCarton);
  const r = qty % perCarton;
  const parts = [];
  if (c) parts.push(`${c} ctn`);
  if (r || !c) parts.push(`${r} pcs`);
  return parts.join(' ');
}

export const docNo = (prefix: string, n: number) => prefix + String(n).padStart(5, '0');

export function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 86400000);
  return { from: start.toISOString(), to: end.toISOString() };
}