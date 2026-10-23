'use client';

import { Printer } from 'lucide-react';

export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print shrink-0">
      <Printer size={18} />
      {label}
    </button>
  );
}