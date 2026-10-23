'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, X } from 'lucide-react';

export default function AddSheet({
  label,
  title,
  children,
  variant = 'add',
}: {
  label?: string;
  title: string;
  children: React.ReactNode;
  variant?: 'add' | 'edit';
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {variant === 'edit' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={title}
          className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Pencil size={17} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
          <Plus size={18} />
          {label}
        </button>
      )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div
              className="backdrop-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div
              className="sheet-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-lg md:rounded-3xl"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
              onSubmit={() => setTimeout(() => setOpen(false), 150)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              {children}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}