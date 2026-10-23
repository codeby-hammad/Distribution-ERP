'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { rs } from '@/lib/format';

type Collector = { id: string; name: string; expected: number; count: number };
type Submit = (payload: string) => Promise<{ ok?: boolean; error?: string }>;

const r2 = (n: number) => Math.round(n * 100) / 100;

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function Card({ c, submit }: { c: Collector; submit: Submit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hid] = useState(uid);
  const [received, setReceived] = useState(String(c.expected));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const diff = r2((Number(received) || 0) - c.expected);

  function onSubmit() {
    setError('');
    if (received === '' || Number(received) < 0) return setError('Enter the cash amount you counted');
    if (!confirm(`Receive ${rs(received)} from ${c.name}?`)) return;

    start(async () => {
      const res = await submit(
        JSON.stringify({
          id: hid,
          collector_id: c.id,
          expected: c.expected,
          received: Number(received),
          note: note.trim(),
        })
      );
      if (res.error) setError(res.error.replace(/^[A-Z_]+:\s*/, ''));
      else router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="hero grid size-11 shrink-0 place-items-center rounded-xl font-bold text-white">
          {c.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{c.name}</p>
          <p className="text-xs text-slate-500">
            {c.count} {c.count === 1 ? 'receipt' : 'receipts'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900">{rs(c.expected)}</p>
          <p className="text-[11px] text-slate-400">to hand over</p>
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-xl bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700"
        >
          Receive cash
        </button>
      ) : (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <label className="label">Cash counted (Rs)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className="field text-lg font-semibold"
            />
          </div>

          <div
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${
              diff === 0
                ? 'bg-emerald-50 text-emerald-700'
                : diff < 0
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span>{diff === 0 ? 'Cash matches' : diff < 0 ? 'Cash short' : 'Cash extra'}</span>
            <span>{rs(Math.abs(diff))}</span>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field"
            placeholder="Note (optional)"
          />

          {error && (
            <div className="flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button onClick={onSubmit} disabled={pending} className="btn-primary flex-1 disabled:opacity-60">
              {pending ? 'Saving...' : 'Confirm handover'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HandoverForm({
  collectors,
  submit,
}: {
  collectors: Collector[];
  submit: Submit;
}) {
  return (
    <div className="space-y-3">
      {collectors.map((c) => (
        <Card key={`${c.id}:${c.expected}`} c={c} submit={submit} />
      ))}
    </div>
  );
}