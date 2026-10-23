'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart3, Boxes, Check, QrCode, Truck, WifiOff } from 'lucide-react';

/* ---------- scroll reveal ---------- */
export function Reveal({
    children,
    delay = 0,
    className = '',
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setOn(true);
                    io.disconnect();
                }
            },
            { threshold: 0.12 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={`transition-all duration-700 ${on ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${className}`}
        >
            {children}
        </div>
    );
}

/* ---------- mock frames ---------- */
function Phone({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto w-[260px] rounded-[2.4rem] bg-slate-900 p-2.5 shadow-2xl ring-1 ring-white/20">
            <div className="overflow-hidden rounded-[1.9rem] bg-slate-50">{children}</div>
        </div>
    );
}

function Pill({ t, c }: { t: string; c: string }) {
    return <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${c}`}>{t}</span>;
}

function SalesmanScreen() {
    return (
        <Phone>
            <div className="hero px-4 pb-4 pt-6 text-white">
                <p className="text-[10px] text-indigo-100">New order</p>
                <p className="text-sm font-bold">Ali Traders</p>
                <p className="text-[10px] text-indigo-100">Balance Rs 45,200 · Limit Rs 100,000</p>
            </div>
            <div className="space-y-2 p-3">
                <div className="rounded-xl bg-orange-50 p-2.5 ring-1 ring-orange-200">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-800">Biscuit 24pc</p>
                        <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[8px] font-bold text-white">PROMO</span>
                    </div>
                    <p className="text-[9px] font-semibold text-orange-700">Buy 10 ctn, get 1 free</p>
                    <div className="mt-1.5 flex gap-1.5">
                        <div className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">8 ctn</div>
                        <div className="rounded-md bg-white px-2 py-1 text-[10px] font-bold">0 pcs</div>
                    </div>
                    <p className="mt-1.5 rounded bg-orange-100 px-1.5 py-1 text-[9px] font-bold text-orange-700">Add 2 more ctn to get this offer</p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                    <p className="text-[11px] font-bold text-slate-800">Juice 12pc</p>
                    <div className="mt-1.5 flex gap-1.5">
                        <div className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold">4 ctn</div>
                        <div className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold">0 pcs</div>
                    </div>
                </div>
                <div className="hero rounded-xl py-2 text-center text-[11px] font-bold text-white">Save order · Rs 68,400</div>
                <p className="flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400">
                    <WifiOff size={10} /> Offline. Uploads when online
                </p>
            </div>
        </Phone>
    );
}

function DeliveryScreen() {
    const rows = [
        ['Noor Store', 'Received', 'bg-emerald-100 text-emerald-700', 'Rs 12,400'],
        ['City Mart', 'Partial', 'bg-amber-100 text-amber-700', 'Rs 8,000'],
        ['Ali Traders', 'Not received', 'bg-red-100 text-red-700', 'Rs 21,500'],
    ];
    return (
        <Phone>
            <div className="hero px-4 pb-4 pt-6 text-white">
                <p className="text-[10px] text-indigo-100">Trip #19 · Cash check</p>
                <p className="text-sm font-bold">Receive cash per bill</p>
            </div>
            <div className="space-y-2 p-3">
                <div className="rounded-xl bg-indigo-50 p-2.5 text-[10px] font-semibold text-slate-600">
                    <div className="flex justify-between"><span>Cash received</span><span className="text-emerald-700">Rs 20,400</span></div>
                    <div className="flex justify-between"><span>Not received</span><span className="text-red-600">Rs 21,500</span></div>
                </div>
                {rows.map(([n, s, c, a]) => (
                    <div key={n} className="rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-slate-800">{n}</p>
                            <Pill t={s} c={c} />
                        </div>
                        <p className="text-[10px] text-slate-500">Bill {a}</p>
                    </div>
                ))}
                <div className="rounded-xl bg-amber-50 p-2 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                    Old balance Rs 5,000 · Total to ask for Rs 26,500
                </div>
            </div>
        </Phone>
    );
}

function WarehouseScreen() {
    return (
        <Phone>
            <div className="hero px-4 pb-4 pt-6 text-white">
                <p className="text-[10px] text-indigo-100">Warehouse</p>
                <p className="flex items-center gap-1 text-sm font-bold"><QrCode size={13} /> Scan the delivery slip</p>
            </div>
            <div className="p-3">
                <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-white p-5 text-center">
                    <QrCode size={46} className="mx-auto text-slate-800" />
                </div>
                <div className="-mt-1 mt-3 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-100">
                    <p className="text-[11px] font-extrabold text-emerald-700">Goods loaded to Farhan</p>
                    <p className="text-[9px] text-slate-500">Trip #19 · LEB-1234</p>
                    <div className="mt-2 space-y-1 text-[10px] font-semibold text-slate-700">
                        <div className="flex justify-between"><span>Biscuit 24pc</span><span>11 ctn</span></div>
                        <div className="flex justify-between"><span>Juice 12pc</span><span>6 ctn</span></div>
                    </div>
                    <div className="hero mt-2.5 rounded-xl py-1.5 text-center text-[10px] font-bold text-white">Confirm handover</div>
                </div>
            </div>
        </Phone>
    );
}

function OwnerScreen() {
    const bars = [40, 62, 48, 80, 58, 90, 70];
    return (
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-slate-100 shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-2">
                <span className="size-2 rounded-full bg-red-400" /><span className="size-2 rounded-full bg-amber-400" /><span className="size-2 rounded-full bg-emerald-400" />
            </div>
            <div className="space-y-3 p-4">
                <div className="hero rounded-xl p-3 text-white">
                    <p className="text-[10px] text-indigo-100">Welcome back</p>
                    <p className="text-sm font-bold">Owner dashboard</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[['Orders today', '34'], ['Cash received', 'Rs 412k'], ['Outstanding', 'Rs 3.2M']].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-white p-2 shadow-sm">
                            <p className="text-sm font-extrabold text-slate-900">{v}</p>
                            <p className="text-[9px] text-slate-500">{l}</p>
                        </div>
                    ))}
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-700">Sales, last 7 days</p>
                    <div className="mt-2 flex h-20 items-end gap-1.5">
                        {bars.map((h, i) => (
                            <div key={i} className={`flex-1 rounded-t ${i === 5 ? 'hero' : 'bg-indigo-100'}`} style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
                    <div className="rounded-xl bg-amber-50 p-2 text-amber-800 ring-1 ring-amber-200">7 orders to approve</div>
                    <div className="rounded-xl bg-amber-50 p-2 text-amber-800 ring-1 ring-amber-200">2 trips to settle</div>
                </div>
            </div>
        </div>
    );
}

/* ---------- product tabs ---------- */
const TABS = [
    { k: 'sales', label: 'Salesman app', title: 'Orders booked at the shop, even offline', pts: ['Cartons and pieces, with promo hints', 'Credit limit warning before you save', 'GPS stamp on every order and payment'], screen: <SalesmanScreen /> },
    { k: 'del', label: 'Delivery man', title: 'Every bill and every rupee, per shop', pts: ['Old balance and total to ask for', 'Cash received or not, bill by bill', 'Works without internet'], screen: <DeliveryScreen /> },
    { k: 'wh', label: 'Warehouse', title: 'Scan the slip, confirm the load', pts: ['Batch and expiry on every line', 'Handover recorded with name and time', 'Daily loaded history'], screen: <WarehouseScreen /> },
    { k: 'own', label: 'Owner dashboard', title: 'See the whole business in one screen', pts: ['Orders, cash and udhaar today', 'What needs your attention right now', 'Profit, aging, stock and expiry reports'], screen: <OwnerScreen /> },
];

export function ProductTabs() {
    const [i, setI] = useState(0);
    const [manual, setManual] = useState(false);

    useEffect(() => {
        if (manual) return;
        const t = setInterval(() => setI((v) => (v + 1) % TABS.length), 5000);
        return () => clearInterval(t);
    }, [manual]);

    const tab = TABS[i];
    return (
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t, n) => (
                        <button
                            key={t.k}
                            onClick={() => {
                                setI(n);
                                setManual(true);
                            }}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${n === i ? 'hero text-white shadow-lg shadow-indigo-500/30' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <h3 className="mt-6 text-2xl font-extrabold text-slate-900 md:text-3xl">{tab.title}</h3>
                <ul className="mt-4 space-y-3">
                    {tab.pts.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-slate-600">
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={13} /></span>
                            {p}
                        </li>
                    ))}
                </ul>
                <div className="mt-6 flex gap-1.5">
                    {TABS.map((t, n) => (
                        <span key={t.k} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-8 bg-indigo-600' : 'w-3 bg-slate-200'}`} />
                    ))}
                </div>
            </div>
            <div key={tab.k} className="relative animate-[pop_.5s_ease-out]">
                <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-indigo-200/60 to-fuchsia-200/60 blur-2xl" />
                <div className="relative">{tab.screen}</div>
                <p className="relative mt-3 text-center text-[11px] text-slate-400">Sample screen with sample data</p>
            </div>
        </div>
    );
}

/* ---------- loss calculator ---------- */
function Money({ label, value, set, hint }: { label: string; value: number; set: (n: number) => void; hint: string }) {
    return (
        <div>
            <label className="text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative mt-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rs</span>
                <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={value || ''}
                    onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                    className="field pl-10"
                    placeholder="0"
                />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
    );
}

const fmt = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-US');

export function LossCalculator({ whatsapp }: { whatsapp: string }) {
    const [expiry, setExpiry] = useState(50000);
    const [mistakes, setMistakes] = useState(30000);
    const [udhaar, setUdhaar] = useState(2000000);
    const [cut, setCut] = useState(30);

    const yearly = (expiry + mistakes) * 12;
    const saved = (yearly * cut) / 100;
    const text = `Assalam o Alaikum, my yearly losses are about ${fmt(yearly)} and udhaar is ${fmt(udhaar)}. I want a demo.`;

    return (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-100">
                <Money label="Expiry and damage loss per month" value={expiry} set={setExpiry} hint="Goods thrown away or returned and not recovered" />
                <Money label="Cash short, billing and counting mistakes per month" value={mistakes} set={setMistakes} hint="Wrong bills, missing cash, forgotten udhaar entries" />
                <Money label="Udhaar currently outstanding" value={udhaar} set={setUdhaar} hint="Total money lying with shops" />
                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">How much of the loss could better control stop?</label>
                        <span className="text-sm font-extrabold text-indigo-700">{cut}%</span>
                    </div>
                    <input type="range" min={10} max={60} step={5} value={cut} onChange={(e) => setCut(Number(e.target.value))} className="mt-2 w-full accent-indigo-600" />
                    <p className="text-[11px] text-slate-400">This is your own guess, not a promise.</p>
                </div>
            </div>

            <div className="hero relative flex flex-col justify-between overflow-hidden rounded-3xl p-7 text-white shadow-xl shadow-indigo-500/25">
                <div className="absolute -right-10 -top-10 size-44 rounded-full bg-white/15 blur-2xl" />
                <div className="relative">
                    <p className="text-sm font-semibold text-indigo-100">You may be losing each year</p>
                    <p className="mt-1 text-4xl font-extrabold md:text-5xl">{fmt(yearly)}</p>
                    <div className="mt-5 rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
                        <p className="text-xs text-indigo-100">If you stop {cut}% of it</p>
                        <p className="text-2xl font-extrabold text-emerald-300">{fmt(saved)} saved per year</p>
                    </div>
                    <p className="mt-4 text-sm text-indigo-100">
                        And <span className="font-bold text-white">{fmt(udhaar)}</span> of your money is sitting with shops. Aging and recovery lists show who to chase first.
                    </p>
                </div>
                <a
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`}
                    className="relative mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-indigo-700"
                >
                    Show me how on WhatsApp
                </a>
                <p className="relative mt-2 text-center text-[10px] text-indigo-200">Estimate from the numbers you typed.</p>
            </div>
        </div>
    );
}

/* ---------- order to cash timeline ---------- */
const FLOW = [
    ['Order booked', 'On the salesman phone'],
    ['Approved', 'Credit and schemes checked'],
    ['Van loaded', 'Warehouse scans and confirms'],
    ['Delivered', 'Bills handed over'],
    ['Cash settled', 'Ledger updated per shop'],
];

export function OrderToCash() {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setStep((s) => (s + 1) % FLOW.length), 1800);
        return () => clearInterval(t);
    }, []);
    const pct = (step / (FLOW.length - 1)) * 100;

    return (
        <div>
            <div className="relative mx-auto mt-10 max-w-4xl">
                <div className="absolute inset-x-6 top-5 h-1 rounded-full bg-white/15" />
                <div className="absolute left-6 top-5 h-1 rounded-full bg-emerald-300 transition-all duration-700" style={{ width: `calc((100% - 3rem) * ${pct / 100})` }} />
                <div
                    className="absolute top-0 -translate-x-1/2 transition-all duration-700"
                    style={{ left: `calc(1.5rem + (100% - 3rem) * ${pct / 100})` }}
                >
                    <span className="grid size-11 place-items-center rounded-full bg-white text-indigo-700 shadow-lg">
                        <Truck size={20} />
                    </span>
                </div>
                <div className="relative grid grid-cols-5 pt-14">
                    {FLOW.map(([t, d], n) => (
                        <div key={t} className={`px-1 text-center transition ${n <= step ? 'opacity-100' : 'opacity-40'}`}>
                            <p className="text-xs font-bold text-white md:text-sm">{t}</p>
                            <p className="mt-0.5 hidden text-[11px] text-indigo-200 sm:block">{d}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export const _icons = { BarChart3, Boxes };