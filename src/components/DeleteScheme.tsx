'use client';

import { Trash2 } from 'lucide-react';

export default function DeleteScheme({
  action,
  id,
  name,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  name: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete scheme "${name}"? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        aria-label="Delete scheme"
        className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={17} />
      </button>
    </form>
  );
}