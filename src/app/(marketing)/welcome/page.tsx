import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Banknote,
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Gift,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Phone as PhoneIcon,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Truck,
  WifiOff,
  BarChart3,
  X,
} from 'lucide-react';
import { LossCalculator, OrderToCash, ProductTabs, Reveal } from './Parts';

/* ---------------- EDIT THESE ---------------- */
const CONFIG = {
  brand: 'Distribution ERP',
  whatsapp: '923261125120', // country code, no + or spaces
  phoneText: '0326 1125120',
  loginUrl: '/login',
  priceText: 'Rs ______',
  priceNote: 'One-time payment. No monthly subscription.',
  year: new Date().getFullYear(),
};
/* -------------------------------------------- */

export const metadata: Metadata = {
  title: `${CONFIG.brand} | Software for wholesale distributors in Pakistan`,
  description:
    'Order booking app, trip loading, invoices, recovery, stock and profit for distributors. Works offline. One-time payment, no monthly fee.',
};

const wa = (t: string) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;
const DEMO = 'Assalam o Alaikum, I want a demo of the Distribution ERP.';

const STRIP = [
  'Offline order booking', 'Trip loading and invoices', 'Warehouse QR scan', 'Udhaar aging 30/60/90', 'Schemes 10+1',
  'Expiry and returns', 'Supplier claims', 'Profit by product', 'Cash settlement per trip', 'Sales tax details on invoice',
];

const FEATURES = [
  { icon: ClipboardList, title: 'Order booking app', text: 'Carton and piece orders with GPS stamps and a credit limit check.' },
  { icon: Truck, title: 'Trips and delivery', text: 'Load the van, print invoices, settle cash bill by bill.' },
  { icon: Banknote, title: 'Recovery and ledger', text: 'Receipts, shop statements and aging in one place.' },
  { icon: Gift, title: 'Schemes and bonus', text: 'Bonus and discounts by product or company, visible while booking.' },
  { icon: RotateCcw, title: 'Returns and claims', text: 'Expiry returns, replacement and a supplier claim list.' },
  { icon: Package, title: 'Stock and expiry', text: 'Batch wise stock, free cartons, last cost and expiry reports.' },
  { icon: BarChart3, title: 'Reports and profit', text: 'Daily sales, salesman performance, profit and expenses.' },
  { icon: MapPin, title: 'Field control', text: 'Where each order and payment was taken, and how far from the shop.' },
  { icon: FileText, title: 'Professional invoices', text: 'Your logo, NTN and STRN, with filer and non-filer shop status.' },
];

const COMPARE: [string, string, string, string][] = [
  ['Works without internet', 'No', 'Varies', 'Yes'],
  ['Salesman mobile app', 'No', 'Varies', 'Yes'],
  ['Batch and expiry stock', 'Manual', 'Varies', 'Yes'],
  ['Udhaar aging and recovery', 'Manual', 'Varies', 'Yes'],
  ['Cash settlement per trip', 'Manual', 'Varies', 'Yes'],
  ['You pay', 'Staff time', 'Every month', 'Once'],
];

const FAQ = [
  { q: 'Is it really a one-time payment?', a: 'Yes. You pay once for the software. Optional yearly support and updates are separate and not forced.' },
  { q: 'Does it work without internet?', a: 'The salesman and delivery apps work offline. Everything saves on the phone and uploads when the signal returns.' },
  { q: 'Can we load our existing shops and balances?', a: 'Yes. We set up your products, shops and opening balances so you start with correct numbers.' },
  { q: 'What phones do staff need?', a: 'Any Android phone. Owner and office use a browser on a computer or phone.' },
  { q: 'Is our data safe?', a: 'Each company gets its own private database. Staff see only what their role allows, and you can download a data backup any time.' },
  { q: 'Do you support FBR integration?', a: 'Invoices show your NTN, STRN and a sales tax breakdown, with filer and non-filer shops marked. Direct FBR integration is not included at the moment.' },
  { q: 'Can I see it before I decide?', a: 'Yes. Message us on WhatsApp for a live demo on your own products.' },
];

const CSS = `
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(10px)} }
@keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes pop { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:none} }
@keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
`;

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-white pb-20 text-slate-800 md:pb-0">
      <style>{CSS}</style>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2.5 text-white">
            <span className="hero grid size-9 place-items-center rounded-xl shadow-md shadow-indigo-500/30"><Boxes size={18} /></span>
            <span className="font-bold">{CONFIG.brand}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#calc" className="hover:text-white">Your losses</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={CONFIG.loginUrl} className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white sm:block">Login</Link>
            <a href={wa(DEMO)} className="btn-primary px-4 py-2 text-sm"><MessageCircle size={16} />Get a demo</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 -top-24 size-[30rem] rounded-full bg-indigo-600/40 blur-3xl" style={{ animation: 'drift 14s ease-in-out infinite' }} />
        <div className="absolute -bottom-32 right-0 size-[32rem] rounded-full bg-fuchsia-600/30 blur-3xl" style={{ animation: 'drift 18s ease-in-out infinite reverse' }} />
        <div className="absolute left-1/2 top-10 size-72 rounded-full bg-sky-500/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-white/20">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
              Built for wholesale distributors in Pakistan
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] md:text-6xl">
              Udhaar, stock aur cash:{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                sab kuch control mein.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Salesmen book orders on their phone, delivery men settle cash bill by bill, and you see the whole business live. No monthly fee, ever.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={wa(DEMO)} className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-emerald-500/30 transition hover:scale-[1.03]">
                <MessageCircle size={18} />Free demo on WhatsApp
              </a>
              <a href="#calc" className="flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/25 transition hover:bg-white/20">
                Check how much you lose
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {['Works offline', 'Android app + web', 'Setup and training included'].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><Check size={15} className="text-emerald-400" />{t}</span>
              ))}
            </div>
          </div>

          {/* floating phone + cards */}
          <div className="relative mx-auto h-[430px] w-[300px]">
            <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="absolute left-1/2 top-0 w-[240px] -translate-x-1/2 rounded-[2.3rem] bg-slate-800 p-2.5 shadow-2xl ring-1 ring-white/20" style={{ animation: 'float 6s ease-in-out infinite' }}>
              <div className="overflow-hidden rounded-[1.8rem] bg-slate-50 text-slate-800">
                <div className="hero px-4 pb-4 pt-6 text-white">
                  <p className="text-[10px] text-indigo-100">Today · Route 3</p>
                  <p className="text-sm font-bold">Ali Traders</p>
                  <p className="text-[10px] text-indigo-100">Balance Rs 45,200</p>
                </div>
                <div className="space-y-2 p-3">
                  <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold">Biscuit 24pc</p>
                      <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[8px] font-bold text-white">PROMO</span>
                    </div>
                    <p className="text-[9px] font-semibold text-orange-600">Buy 10 ctn, get 1 free</p>
                    <p className="mt-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">+1 ctn free</p>
                  </div>
                  <div className="hero rounded-xl py-2 text-center text-[11px] font-bold text-white">Save order · Rs 68,400</div>
                  <p className="flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400"><WifiOff size={10} />Offline. Uploads when online</p>
                </div>
              </div>
            </div>
            <div className="absolute -left-10 top-24 rounded-2xl bg-white p-3 text-slate-800 shadow-2xl" style={{ animation: 'float2 5s ease-in-out infinite' }}>
              <p className="text-[10px] font-semibold text-slate-400">Cash received today</p>
              <p className="text-lg font-extrabold text-emerald-600">Rs 412,000</p>
            </div>
            <div className="absolute -right-8 top-56 rounded-2xl bg-white p-3 text-slate-800 shadow-2xl" style={{ animation: 'float 7s ease-in-out infinite' }}>
              <p className="text-[10px] font-semibold text-slate-400">Expiring in 30 days</p>
              <p className="text-sm font-extrabold text-red-600">240 pcs flagged</p>
            </div>
            <div className="absolute -bottom-2 left-4 flex items-center gap-2 rounded-2xl bg-white p-3 text-slate-800 shadow-2xl" style={{ animation: 'float2 6s ease-in-out infinite' }}>
              <span className="grid size-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><QrCode size={16} /></span>
              <div>
                <p className="text-[10px] font-semibold text-slate-400">Warehouse</p>
                <p className="text-xs font-extrabold">Handover confirmed</p>
              </div>
            </div>
          </div>
        </div>
        <p className="relative pb-3 text-center text-[10px] text-slate-500">Sample screens with sample data</p>

        {/* marquee */}
        <div className="relative overflow-hidden border-t border-white/10 bg-white/5 py-3">
          <div className="flex w-max gap-3" style={{ animation: 'marquee 40s linear infinite' }}>
            {[...STRIP, ...STRIP].map((t, i) => (
              <span key={i} className="whitespace-nowrap rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">Where does your profit goes?</h2>
          <p className="mt-3 text-slate-500">Most distributors do not lose money in one big way. It leaks out in small gaps.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ['Udhaar nobody chases', 'Old balances sit in registers. With a live ledger and 30/60/90 aging, you know who to call first.', 'bg-amber-50 text-amber-600'],
            ['Expiry and damage', 'Stock expires in the godown. Batch and expiry reports and a supplier claim list stop silent losses.', 'bg-red-50 text-red-600'],
            ['Cash that does not add up', 'Delivery cash is counted bill by bill and settled per trip, so shortages show up the same day.', 'bg-indigo-50 text-indigo-600'],
          ].map(([t, d, c], i) => (
            <Reveal key={t} delay={i * 120}>
              <div className="h-full rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100">
                <span className={`grid size-12 place-items-center rounded-2xl ${c}`}><X size={22} /></span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRODUCT */}
      <section id="product" className="bg-gradient-to-b from-slate-50 to-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">See it working</h2>
            <p className="mt-3 text-slate-500">One system, a screen for every person on your team.</p>
          </Reveal>
          <ProductTabs />
        </div>
      </section>

      {/* ORDER TO CASH */}
      <section className="relative overflow-hidden bg-slate-950 py-16 text-white md:py-24">
        <div className="absolute -right-20 top-0 size-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold md:text-5xl">One order, from shop to cash</h2>
            <p className="mt-3 text-slate-300">Every step is recorded, with who did it and when.</p>
          </Reveal>
          <OrderToCash />
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">Everything in one place</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 100}>
              <div className="group h-full rounded-3xl bg-white p-5 ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl">
                <div className="hero mb-4 grid size-11 place-items-center rounded-2xl text-white shadow-md shadow-indigo-500/20 transition group-hover:scale-110"><Icon size={21} /></div>
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calc" className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">What are leaks costing you?</h2>
            <p className="mt-3 text-slate-500">Type your own numbers. Nothing is stored.</p>
          </Reveal>
          <Reveal><LossCalculator whatsapp={CONFIG.whatsapp} /></Reveal>
        </div>
      </section>

      {/* COMPARE */}
      <section className="mx-auto max-w-4xl px-5 py-16 md:py-24">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">Why distributors switch</h2>
        </Reveal>
        <Reveal>
          <div className="overflow-hidden rounded-3xl ring-1 ring-slate-200">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-slate-50 text-center text-xs font-bold text-slate-500 md:text-sm">
              <div className="p-3 text-left" />
              <div className="p-3">Paper / Excel</div>
              <div className="p-3">Monthly software</div>
              <div className="hero p-3 text-white">{CONFIG.brand}</div>
            </div>
            {COMPARE.map(([row, a, b, c]) => (
              <div key={row} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center border-t border-slate-100 text-center text-xs md:text-sm">
                <div className="p-3 text-left font-semibold text-slate-800">{row}</div>
                <div className="p-3 text-slate-400">{a === 'No' ? <Minus size={16} className="mx-auto" /> : a}</div>
                <div className="p-3 text-slate-500">{b}</div>
                <div className="bg-indigo-50/60 p-3 font-bold text-indigo-700">
                  {c === 'Yes' ? <Check size={18} className="mx-auto text-emerald-600" /> : c}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative overflow-hidden bg-slate-950 py-16 text-white md:py-24">
        <div className="absolute -left-20 bottom-0 size-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-5">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold md:text-5xl">Pay once. Own it.</h2>
            <p className="mt-3 text-slate-300">No per-user monthly fees that grow every year.</p>
          </Reveal>
          <Reveal>
            <div className="mt-10 rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-[2px]">
              <div className="grid gap-8 rounded-[1.4rem] bg-slate-900 p-7 md:grid-cols-[1fr_1.1fr] md:p-10">
                <div>
                  <p className="text-sm font-semibold text-indigo-300">Complete distribution system</p>
                  <p className="mt-2 text-5xl font-extrabold">{CONFIG.priceText}</p>
                  <p className="mt-1 text-sm text-slate-400">{CONFIG.priceNote}</p>
                  <a href={wa('Assalam o Alaikum, please share the price and a demo.')} className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 font-bold text-white">
                    <MessageCircle size={18} />Ask for the price
                  </a>
                  <p className="mt-3 text-center text-xs text-slate-500">Optional yearly support, never forced.</p>
                </div>
                <ul className="space-y-3 text-sm">
                  {['Web portal for owner, manager and cashier', 'Android app for salesmen and delivery men', 'Warehouse scanner', 'Setup with your products, shops and balances', 'Staff training', 'Your own private database'].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-slate-200"><Check size={17} className="mt-0.5 shrink-0 text-emerald-400" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-5xl">Start safely, in four steps</h2>
          <p className="mt-3 text-slate-500">We never ask you to switch overnight.</p>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['1', 'We set it up', 'Your logo, products, shops, routes and staff logins.'],
            ['2', 'Staff install the app', 'Android app with their own login.'],
            ['3', 'Run both for two weeks', 'Compare balances and cash with your old method.'],
            ['4', 'Go fully live', 'When the numbers match, you switch.'],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="h-full rounded-3xl bg-gradient-to-b from-indigo-50 to-white p-5 ring-1 ring-indigo-100">
                <span className="hero grid size-10 place-items-center rounded-xl font-extrabold text-white">{n}</span>
                <h3 className="mt-3 font-bold text-slate-900">{t}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-extrabold text-slate-900 md:text-4xl">Questions distributors ask</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center text-white md:py-20">
          <div className="absolute -left-16 -top-16 size-72 rounded-full bg-indigo-600/40 blur-3xl" />
          <div className="absolute -bottom-20 right-0 size-80 rounded-full bg-fuchsia-600/30 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold md:text-5xl">Apna hisaab kitaab saaf karein.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-slate-300">A live demo on your own products and shops. No pressure, no monthly fee.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <a href={wa(DEMO)} className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-7 py-4 font-bold text-white shadow-xl shadow-emerald-500/30"><MessageCircle size={18} />WhatsApp us</a>
            <a href={`tel:+${CONFIG.whatsapp}`} className="flex items-center gap-2 rounded-2xl bg-white/10 px-7 py-4 font-semibold ring-1 ring-white/25"><PhoneIcon size={18} />{CONFIG.phoneText}</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-slate-400 sm:flex-row">
          <p>© {CONFIG.year} {CONFIG.brand}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ShieldCheck size={14} />Private data per company</span>
            <Link href={CONFIG.loginUrl} className="font-semibold text-slate-500 hover:text-indigo-600">Client login</Link>
          </div>
        </div>
      </footer>

      {/* sticky mobile bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <a href={wa(DEMO)} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-bold text-white">
          <MessageCircle size={18} />Free demo on WhatsApp
        </a>
      </div>
      <a href={wa(DEMO)} aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 z-50 hidden size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 transition hover:scale-105 md:grid">
        <MessageCircle size={26} />
      </a>
    </div>
  );
}