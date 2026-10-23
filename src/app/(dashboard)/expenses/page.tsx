import { Trash2 } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { dateLabel, rs } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import { addExpenseAction, deleteExpenseAction } from './actions';

const CATEGORIES = ['Fuel', 'Salaries', 'Rent', 'Electricity', 'Van repair', 'Delivery man allowance', 'Packing', 'Marketing', 'Other'];
const HOUR = 3600 * 1000;
const pkToday = () => new Date(Date.now() + 5 * HOUR).toISOString().slice(0, 10);

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { err, ok } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const today = pkToday();
  const monthStart = today.slice(0, 8) + '01';

  const { data: rows } = await supabase
    .from('expenses')
    .select('id, expense_date, category, amount, note')
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  const list = rows ?? [];
  const monthTotal = list.filter((r) => r.expense_date >= monthStart).reduce((s, r) => s + Number(r.amount), 0);
  const canDelete = ['owner', 'manager'].includes(profile.role);

  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" subtitle="Daily running costs of the business" />

      {err && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">{err}</div>}
      {ok && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Expense saved.</div>}

      <form action={addExpenseAction} className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" defaultValue={today} max={today} required className="field" />
          </div>
          <div>
            <label className="label">Amount (Rs)</label>
            <input type="number" name="amount" min={1} step="0.01" inputMode="decimal" required className="field" />
          </div>
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" required className="field">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input name="note" className="field" placeholder="e.g. Diesel for van LEB-1234" />
        </div>
        <button className="btn-primary w-full">Add expense</button>
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold text-slate-900">Recent expenses</h2>
          <span className="text-xs font-semibold text-slate-500">This month: {rs(monthTotal)}</span>
        </div>
        {list.length === 0 && <p className="p-4 text-sm text-slate-500">No expenses yet.</p>}
        <div className="divide-y divide-slate-100">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{r.category}</p>
                <p className="truncate text-xs text-slate-500">
                  {dateLabel(r.expense_date)}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <p className="font-bold text-slate-900">{rs(r.amount)}</p>
              {canDelete && (
                <form action={deleteExpenseAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button aria-label="Delete expense" className="grid size-9 place-items-center rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}