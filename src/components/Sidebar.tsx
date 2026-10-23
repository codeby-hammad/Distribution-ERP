'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, LogOut } from 'lucide-react';
import { groupsFor, isActive } from './nav-items';

export default function Sidebar({
  name,
  role,
  signOut,
}: {
  name: string;
  role: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const groups = groupsFor(role);

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 p-4 md:block">
      <div
        className="flex h-full min-h-0 flex-col rounded-3xl p-4 text-slate-300"
        style={{ backgroundImage: 'linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%)' }}
      >
        <div className="mb-4 flex shrink-0 items-center gap-3 px-2 pt-2">
          <div className="hero grid size-10 place-items-center rounded-xl text-white shadow-lg shadow-indigo-900/40">
            <Boxes size={20} />
          </div>
          <div>
            <p className="font-bold leading-tight text-white">Distribution</p>
            <p className="text-xs text-indigo-300">ERP Suite</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-indigo-300/60">
                {g.title}
              </p>
              <div className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-white/10 text-white ring-1 ring-white/10'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      {label === 'Home' ? 'Dashboard' : label}
                      {active && <span className="ml-auto size-1.5 rounded-full bg-indigo-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-3 flex shrink-0 items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="hero grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="text-xs capitalize text-slate-400">{role}</p>
          </div>
          <form action={signOut}>
            <button
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}