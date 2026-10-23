'use client';

import { CheckCheck } from 'lucide-react';

export default function ApproveAllButton({ count, amount }: { count: number; amount: string }) {
  return (
    <button
      type="submit"
      className="btn-primary w-full justify-center"
      onClick={(e) => {
        if (!window.confirm(`Approve all ${count} pending orders (${amount})?\n\nOrders that fail the credit check will be skipped.`)) {
          e.preventDefault();
        }
      }}
    >
      <CheckCheck size={18} />
      Approve all pending ({count})
    </button>
  );
}