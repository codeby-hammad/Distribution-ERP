'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { navFor, isActive } from './nav-items';

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = navFor(role);
  const useMore = items.length > 5;
  const main = useMore ? items.slice(0, 4) : items;
  const more = useMore ? items.slice(4) : [];
  const moreActive = more.some((n) => isActive(pathname, n.href));

  const tab = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition ${
      active ? 'hero text-white shadow-md shadow-indigo-500/30' : 'text-slate-500'
    }`;

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)} />
          <div
            className="glass sheet-in fixed inset-x-3 z-40 rounded-2xl p-2 shadow-xl shadow-slate-900/10 md:hidden"
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
          >
            {more.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                  isActive(pathname, href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                }`}
              >
                <Icon size={19} />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}

      <nav
        className="glass fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-2xl p-1.5 shadow-xl shadow-slate-900/10 md:hidden"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      >
        {main.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={tab(isActive(pathname, href))}>
            <Icon size={20} />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        {useMore && (
          <button onClick={() => setOpen((o) => !o)} className={tab(moreActive || open)}>
            <MoreHorizontal size={20} />
            More
          </button>
        )}
      </nav>
    </>
  );
}