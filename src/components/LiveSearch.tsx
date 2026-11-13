'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

export default function LiveSearch({
  placeholder = 'Search',
  delay = 300,
}: {
  placeholder?: string;
  delay?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const urlQ = params.get('q') ?? '';
  const [value, setValue] = useState(urlQ);
  const first = useRef(true);

  useEffect(() => {
    // do not navigate on first render
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const v = value.trim();
      if (v === (next.get('q') ?? '')) return;
      if (v) next.set('q', v);
      else next.delete('q');
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        placeholder={placeholder}
        className="field pl-10 pr-10"
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          <X size={17} />
        </button>
      )}
      {pending && (
        <span className="absolute right-10 top-1/2 size-3 -translate-y-1/2 animate-pulse rounded-full bg-indigo-400" />
      )}
    </div>
  );
}