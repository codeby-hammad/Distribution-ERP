'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Bell, BellOff, ShoppingCart, X } from 'lucide-react';
import { rs } from '@/lib/format';

type Toast = { id: string; orderNo: number | null; shop: string; total: number; by: string };

export default function OrderAlerts() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [enabled, setEnabled] = useState(true);
  const [live, setLive] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  function getCtx(): AudioContext | null {
    if (!audioRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioRef.current = new AC();
    }
    return audioRef.current;
  }

  function beep() {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const notes: [number, number][] = [
      [880, 0],
      [1175, 0.18],
      [880, 0.5],
      [1175, 0.68],
    ];
    for (const [freq, t] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + 0.18);
    }
  }
  const beepRef = useRef(beep);
  beepRef.current = beep;

  // remember the choice, and unlock audio on the first click anywhere (browser rule)
  useEffect(() => {
    try {
      if (localStorage.getItem('orderAlerts') === 'off') setEnabled(false);
    } catch {}
    const unlock = () => {
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLive(false);
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const seen = new Set<string>();

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      const myId = data.session.user.id;
      supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel('new-orders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          async (payload) => {
            const row = payload.new as { id: string; status: string; salesman_id: string };
            if (row.status !== 'booked' || row.salesman_id === myId || seen.has(row.id)) return;
            seen.add(row.id);

            // the insert event carries total 0, so wait a moment and read the final order
            await new Promise((r) => setTimeout(r, 1200));

            const { data: o } = await supabase
              .from('orders')
              .select('order_no, total, shops(name)')
              .eq('id', row.id)
              .maybeSingle();
            const { data: p } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.salesman_id)
              .maybeSingle();

            const od = o as unknown as {
              order_no: number;
              total: number;
              shops: { name: string } | { name: string }[] | null;
            } | null;
            const shopObj = Array.isArray(od?.shops) ? od?.shops[0] : od?.shops;

            const toast: Toast = {
              id: row.id,
              orderNo: od?.order_no ?? null,
              shop: shopObj?.name ?? 'a shop',
              total: Number(od?.total ?? 0),
              by: (p as { full_name?: string } | null)?.full_name ?? 'Salesman',
            };

            beepRef.current();
            setToasts((t) => [toast, ...t].slice(0, 4));
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 15000);

            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
              try {
                new Notification('New order', {
                  body: `${toast.by}: ${toast.shop}, ${rs(toast.total)}`,
                  tag: toast.id,
                });
              } catch {}
            }

            routerRef.current.refresh();
          }
        )
        .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled]);

  async function toggle() {
    if (enabled) {
      setEnabled(false);
      try {
        localStorage.setItem('orderAlerts', 'off');
      } catch {}
      return;
    }
    setEnabled(true);
    try {
      localStorage.setItem('orderAlerts', 'on');
    } catch {}
    beep(); // test sound, also unlocks audio
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        title={enabled ? 'New order alerts are on. Click to turn off' : 'Turn on new order alerts'}
        className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200 md:bottom-4"
      >
        {enabled ? <Bell size={16} className="text-indigo-600" /> : <BellOff size={16} className="text-slate-400" />}
        {enabled ? 'Alerts on' : 'Alerts off'}
        {enabled && (
          <span className={`size-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        )}
      </button>

      <div className="fixed right-3 top-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-2xl ring-1 ring-indigo-200">
            <div className="hero grid size-10 shrink-0 place-items-center rounded-xl text-white">
              <ShoppingCart size={18} />
            </div>
            <Link href="/orders" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                New order{t.orderNo ? ` #${t.orderNo}` : ''}
              </p>
              <p className="truncate text-xs text-slate-600">{t.shop}</p>
              <p className="text-xs text-slate-500">
                {t.by} · <b className="text-slate-800">{rs(t.total)}</b>
              </p>
            </Link>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              aria-label="Dismiss"
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}