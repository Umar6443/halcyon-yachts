"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Check, CreditCard, Lock } from "lucide-react";
import type { Yacht } from "@/data/site";

/**
 * Booking panel: a visual flow only. Date, guests, extras, a running price and a card form are all there,
 * but nothing is sent anywhere and no payment is taken: payments / availability are connected later.
 */

const ADDONS = [
  { id: "catering", label: "Premium catering", note: "per guest", price: 55, perGuest: true },
  { id: "dj", label: "Live DJ & MC", note: "6 hours", price: 2400, perGuest: false },
  { id: "branding", label: "Branding crew & custom banners", note: "setup and strike", price: 3800, perGuest: false },
  { id: "media", label: "Photo & video crew", note: "highlights film", price: 1900, perGuest: false },
];

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`;
const digits = (s: string) => s.replace(/\D/g, "");

export default function Booking({ yacht, onBack }: { yacht: Yacht; onBack: () => void }) {
  const base = Number(yacht.price.replace(/[^\d]/g, "")) || 0;
  const maxGuests = Number(yacht.specs.find((s) => s.label === "Guests")?.value) || 100;
  const [guests, setGuests] = useState(Math.min(60, maxGuests));
  const [type, setType] = useState(yacht.eventTypes[0]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [done, setDone] = useState(false);

  const total = useMemo(
    () => base + ADDONS.reduce((n, a) => n + (picked[a.id] ? a.price * (a.perGuest ? guests : 1) : 0), 0),
    [base, picked, guests],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex h-full flex-col justify-center p-6 md:p-10">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[#06120a]">
          <Check size={22} />
        </span>
        <h3 className="mt-6 font-serif text-4xl leading-tight">Booking preview complete</h3>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          This is a preview of the booking flow for <strong className="text-white">{yacht.name}</strong>. Availability and payment are not connected yet, so nothing has been reserved and
          no card was charged.
        </p>
        <dl className="mt-6 grid max-w-md grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm">
          <div>
            <dt className="label">Event</dt>
            <dd className="mt-1">{type}</dd>
          </div>
          <div>
            <dt className="label">Guests</dt>
            <dd className="mt-1">{guests}</dd>
          </div>
          <div>
            <dt className="label">Estimated total</dt>
            <dd className="mt-1 font-serif text-2xl">{eur(total)}</dd>
          </div>
        </dl>
        <button onClick={onBack} className="btn-ghost mt-8 self-start">
          <ArrowLeft size={14} /> Back to the yacht
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col gap-7 p-6 md:p-8">
      <div>
        <button type="button" onClick={onBack} className="mb-5 flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-white/60 transition-colors hover:text-white">
          <ArrowLeft size={14} /> BACK TO {yacht.name}
        </button>
        <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">BOOK THIS YACHT</p>
        <h3 className="mt-2 font-serif text-4xl leading-none md:text-5xl">{yacht.name}</h3>
        <p className="mt-2 text-sm text-white/60">Booking preview · nothing is reserved or charged yet</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Event date</span>
          <input type="date" required className="field" />
        </label>
        <label className="block">
          <span className="label">Event type</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            {yacht.eventTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="label">Guests</span>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={maxGuests}
            step={5}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="h-1 w-full cursor-pointer accent-[var(--accent)]"
            aria-label="Number of guests"
          />
          <span className="w-14 text-right font-serif text-3xl">{guests}</span>
        </div>
      </div>

      <fieldset>
        <legend className="label">Extras</legend>
        <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
          {ADDONS.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-4 py-3.5">
                <input
                  type="checkbox"
                  checked={!!picked[a.id]}
                  onChange={(e) => setPicked({ ...picked, [a.id]: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="flex-1">
                  <span className="block text-[15px]">{a.label}</span>
                  <span className="block text-xs text-white/50">{a.note}</span>
                </span>
                <span className="font-mono text-xs text-white/80">
                  {eur(a.price)}
                  {a.perGuest ? " pp" : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input required className="field" autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input required type="email" className="field" autoComplete="email" />
        </label>
      </div>

      {/* card form: design only */}
      <div className="rounded-sm border border-white/15 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <span className="label flex items-center gap-2">
            <CreditCard size={14} /> Payment details
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.25em] text-white/45">
            <Lock size={11} /> PREVIEW ONLY
          </span>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">Card number</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="Card number"
            className="field !mt-0 !text-base"
            value={card.number}
            onChange={(e) => setCard({ ...card, number: digits(e.target.value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim() })}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM / YY"
            aria-label="Expiry"
            className="field !mt-0 !text-base"
            value={card.expiry}
            onChange={(e) => {
              const d = digits(e.target.value).slice(0, 4);
              setCard({ ...card, expiry: d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d });
            }}
          />
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="CVC"
            aria-label="CVC"
            className="field !mt-0 !text-base"
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: digits(e.target.value).slice(0, 4) })}
          />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-5 border-t border-white/15 pt-6">
        <div>
          <p className="label">Estimated total</p>
          <p className="mt-1 font-serif text-4xl">{eur(total)}</p>
          <p className="text-xs text-white/45">{yacht.priceNote}</p>
        </div>
        <button className="btn">Confirm booking</button>
      </div>
    </form>
  );
}
