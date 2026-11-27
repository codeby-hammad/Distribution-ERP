'use client';

import { Printer } from 'lucide-react';

export default function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
      <Printer size={16} />
      {label}
    </button>
  );
}