'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, Eye, EyeOff, Lock, Truck, User } from 'lucide-react';

const CSS = `
@keyframes ld-drive {
  0%, 72% { transform: translateX(0); }
  100%    { transform: translateX(260px); }
}
@keyframes ld-door {
  0%, 10%  { transform: rotate(0deg); }
  24%, 56% { transform: rotate(82deg); }
  66%, 100% { transform: rotate(0deg); }
}
@keyframes ld-box {
  0%, 26%  { transform: translateY(-16px); opacity: 0; }
  30%      { transform: translateY(-16px); opacity: 1; }
  50%, 100% { transform: translateY(0); opacity: 1; }
}
@keyframes ld-wheel {
  to { transform: rotate(360deg); }
}
@keyframes ld-road {
  from { background-position: 0 0; }
  to   { background-position: -24px 0; }
}
`;

function Wheel({ left }: { left: number }) {
  return (
    <span
      className="absolute rounded-full bg-slate-900 ring-2 ring-white/90"
      style={{ left, top: 20, width: 9, height: 9, animation: 'ld-wheel .35s linear infinite' }}
    >
      <span className="absolute left-0.5 top-0.5 size-[2px] rounded-full bg-white" />
    </span>
  );
}

function DispatchButton({ launching, onLaunch }: { launching: boolean; onLaunch: () => void }) {
  const { pending } = useFormStatus();
  const active = launching || pending;

  return (
    <button
      type="button"
      onClick={onLaunch}
      disabled={active}
      aria-label={active ? 'Loading and dispatching' : 'Sign in'}
      className="btn-primary relative h-12 w-full overflow-hidden disabled:cursor-default"
    >
      {/* idle label */}
      <span
        className={`flex items-center justify-center gap-2 transition-all duration-200 ${
          active ? 'translate-y-3 opacity-0' : 'opacity-100'
        }`}
      >
        <Truck size={18} />
        Sign in
      </span>

      {active && (
        <>
          {/* road */}
          <span
            className="absolute inset-x-0 bottom-[7px] h-[2px] opacity-60"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 12px, transparent 12px 24px)',
              animation: 'ld-road .4s linear infinite',
            }}
          />

          {/* truck + cargo, one group that drives away */}
          <span
            className="absolute bottom-[10px] block"
            style={{
              left: 'calc(50% - 32px)',
              width: 64,
              height: 28,
              animation: 'ld-drive 2.4s cubic-bezier(.55,0,.7,1) infinite',
            }}
          >
            {/* cargo body */}
            <span className="absolute left-0 top-0 h-6 w-10 rounded-[5px] bg-white/95 shadow" />
            {/* dark inside, visible when the door opens */}
            <span className="absolute left-[3px] top-[3px] h-[18px] w-[34px] rounded-[3px] bg-indigo-900/40" />

            {/* box that drops in */}
            <span
              className="absolute block rounded-[2px] bg-amber-400 ring-1 ring-amber-600"
              style={{ left: 14, top: 9, width: 12, height: 12, animation: 'ld-box 2.4s ease-in infinite' }}
            >
              <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-amber-600/60" />
            </span>

            {/* back door, hinged at the top, swings open to the left */}
            <span
              className="absolute block rounded-[2px] bg-white ring-1 ring-indigo-200"
              style={{
                left: -1,
                top: 0,
                width: 4,
                height: 24,
                transformOrigin: 'top center',
                animation: 'ld-door 2.4s ease-in-out infinite',
              }}
            />

            {/* cab */}
            <span className="absolute left-[42px] top-[8px] h-4 w-[20px] rounded-r-[6px] rounded-bl-[2px] bg-white/95 shadow">
              <span className="absolute right-[3px] top-[3px] h-[6px] w-[8px] rounded-[2px] bg-sky-300" />
            </span>

            <Wheel left={8} />
            <Wheel left={48} />
          </span>
        </>
      )}
    </button>
  );
}

export default function LoginForm({
  action,
  error,
  ok,
}: {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  ok?: string;
}) {
  const [show, setShow] = useState(false);
  const [launching, setLaunching] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function launch() {
    const form = formRef.current;
    if (!form || launching) return;
    if (!form.reportValidity()) return; // empty fields: no animation
    setLaunching(true);
    // submit as the truck starts driving away
    setTimeout(() => form.requestSubmit(), 1700);
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <style>{CSS}</style>

      {ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          {ok}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div>
        <label className="label">Email or username</label>
        <div className="relative">
          <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="email"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="field pl-11"
            placeholder="you@company.com or ali.sales"
          />
        </div>
      </div>

      <div>
        <label className="label">Password</label>
        <div className="relative">
          <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="password"
            type={show ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="field pl-11 pr-12"
            placeholder="••••••••"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                launch();
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <DispatchButton launching={launching} onLaunch={launch} />

      <p className="text-center text-xs text-slate-400">
        <a href="/forgot-password" className="font-semibold text-indigo-600">
          Forgot password?
        </a>{' '}
        Staff with a username: ask your administrator.
      </p>
    </form>
  );
}