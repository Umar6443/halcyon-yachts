"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { ABOUT, BRAND, EVENTS, YACHTS, type YachtId } from "@/data/site";
import { hintYacht } from "@/lib/seqs";

/* ---------------------------------------------------------------- fleet */

export function Fleet({ onOpen }: { onOpen: (id: YachtId) => void }) {
  return (
    <section id="fleet" className="relative bg-[var(--bg)] px-5 py-24 sm:px-10 md:px-[6vw] md:py-36" aria-labelledby="fleet-h">
      <div className="mx-auto max-w-[1500px]">
        <header className="grid items-end gap-8 md:grid-cols-[1.3fr_1fr]">
          <div data-reveal>
            <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">THE FLEET · 4 YACHTS</p>
            <h2 id="fleet-h" className="mt-5 font-serif text-[13vw] leading-[0.92] tracking-[-0.02em] sm:text-[8vw] md:text-[5.6vw]">
              Explore our <em className="italic text-[var(--accent)]">yachts.</em>
            </h2>
          </div>
          <p data-reveal style={{ ["--d" as string]: "0.1s" }} className="max-w-md text-[15px] leading-relaxed text-white/70">
            Same 24 m catamaran, four completely different worlds. Choose one to turn it through 360°, step inside, see what is on board and book it.
          </p>
        </header>

        <ul className="mt-14 grid gap-5 md:grid-cols-2">
          {YACHTS.map((y, i) => (
            <li key={y.id} data-reveal style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <button
                onClick={() => onOpen(y.id)}
                onPointerEnter={() => hintYacht(y.id)}
                onFocus={() => hintYacht(y.id)}
                className="group relative block w-full overflow-hidden rounded-sm bg-[#0a1424] text-left"
                style={{ ["--accent" as string]: y.accent }}
                aria-label={`Open ${y.name}, ${y.theme}`}
              >
                <div className="relative aspect-[16/11] overflow-hidden sm:aspect-[16/10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={y.beam}
                    alt={`${y.name}: a 24 m catamaran dressed for ${y.theme.toLowerCase()} events`}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050b16] via-[#050b16]/30 to-transparent" />
                  <span className="absolute left-4 top-4 font-mono text-[10px] tracking-[0.35em] text-white/80">{y.index}</span>
                  <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/30 transition-colors group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-[#06120a]">
                    <ArrowUpRight size={16} />
                  </span>
                  <div className="absolute inset-x-5 bottom-5">
                    <span className="mb-3 block h-[3px] w-10 transition-[width] duration-500 group-hover:w-20" style={{ background: y.accent }} />
                    <p className="font-mono text-[10px] tracking-[0.3em] text-white/65">{y.theme.toUpperCase()}</p>
                    <h3 className="mt-1.5 font-serif text-4xl leading-none md:text-5xl">{y.name}</h3>
                    <p className="mt-2 font-serif text-lg italic text-white/80">{y.tagline}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 font-mono text-[10px] tracking-[0.25em] text-white/60">
                  <span>{y.specs[1].value} GUESTS</span>
                  <span className="text-[var(--accent)]">{y.price.toUpperCase()}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- events */

export function Events({ onOpen }: { onOpen: (id: YachtId) => void }) {
  return (
    <section id="events" className="relative bg-[var(--bg2)] px-5 py-24 sm:px-10 md:px-[6vw] md:py-36" aria-labelledby="events-h">
      <div className="mx-auto max-w-[1500px]">
        <div data-reveal>
          <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">UPCOMING EVENTS &amp; EXPERIENCES</p>
          <h2 id="events-h" className="mt-5 font-serif text-[13vw] leading-[0.92] tracking-[-0.02em] sm:text-[8vw] md:text-[5.6vw]">
            On the water, <em className="italic text-[var(--accent)]">this season.</em>
          </h2>
        </div>
        <ul className="mt-14 grid gap-5 md:grid-cols-2">
          {EVENTS.map((e, i) => {
            const y = YACHTS.find((x) => x.id === e.yacht)!;
            return (
              <li key={e.yacht} data-reveal style={{ ["--d" as string]: `${(i % 2) * 0.08}s`, ["--accent" as string]: y.accent }}>
                <article className="group grid overflow-hidden rounded-sm border border-white/10 bg-white/[0.02] sm:grid-cols-[1fr_1.1fr]">
                  <div className="relative aspect-[16/10] overflow-hidden sm:aspect-auto sm:min-h-[260px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.image} alt={`Guests at ${e.title} aboard ${y.name}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex flex-col p-6 md:p-7">
                    <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-[var(--accent)]">
                      <CalendarDays size={13} /> {e.date.toUpperCase()}
                    </p>
                    <h3 className="mt-3 font-serif text-3xl leading-[1.05]">{e.title}</h3>
                    <p className="mt-3 text-sm text-white/65">
                      Aboard <strong className="font-medium text-white">{y.name}</strong> · {y.theme}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-white/50">
                      <MapPin size={13} /> {e.place}
                    </p>
                    <button onClick={() => onOpen(y.id)} onPointerEnter={() => hintYacht(y.id)} className="btn-ghost mt-auto self-start !mt-7">
                      View the yacht <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- about */

export function About() {
  return (
    <section id="about" className="relative bg-[var(--bg)] px-5 py-24 sm:px-10 md:px-[6vw] md:py-36" aria-labelledby="about-h">
      <div className="mx-auto grid max-w-[1500px] items-center gap-14 md:grid-cols-[1fr_1fr] md:gap-20">
        <div>
          <p data-reveal className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">ABOUT {BRAND.name}</p>
          <h2 data-reveal id="about-h" className="mt-5 font-serif text-[12vw] leading-[0.94] tracking-[-0.02em] sm:text-[7.4vw] md:text-[4.8vw]">
            {ABOUT.heading[0]}
            <br />
            <em className="italic text-[var(--accent)]">{ABOUT.heading[1]}</em>
          </h2>
          {ABOUT.body.map((p, i) => (
            <p key={i} data-reveal className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/72">
              {p}
            </p>
          ))}
          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-8 border-t border-white/15 pt-8 sm:grid-cols-4">
            {ABOUT.stats.map((s) => (
              <div key={s.label} data-reveal>
                <dd className="font-serif text-5xl leading-none text-[var(--accent)]">{s.value}</dd>
                <dt className="mt-2 text-xs leading-snug text-white/55">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div data-reveal className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="img/hero-poster.webp" alt="Eight yachts anchored in a ring in the Adriatic" loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-sm object-cover object-[48%_60%] md:aspect-[5/6]" />
          <p className="absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.3em] text-white/80">THE FLEET AT ANCHOR · ADRIATIC</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- contact */

export function Contact() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `Name: ${f.get("name")}\nEmail: ${f.get("email")}\nOrganisation: ${f.get("org")}\nEvent type: ${f.get("type")}\nPreferred date: ${f.get("date")}\nGuests: ${f.get("guests")}\n\n${f.get("message")}`;
    setSent(true);
    window.location.href = `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Event enquiry")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <footer id="contact" className="relative bg-[#030811] text-[var(--cream)]" aria-labelledby="contact-h">
      <div className="mx-auto grid max-w-[1500px] gap-14 px-5 py-24 sm:px-10 md:grid-cols-2 md:px-[6vw] md:py-36">
        <div>
          <p data-reveal className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">CONTACT · EVENT ENQUIRIES</p>
          <h2 data-reveal id="contact-h" className="mt-5 font-serif text-[13vw] leading-[0.92] sm:text-[8vw] md:text-[5.4vw]">
            Plan your
            <br />
            <em className="italic text-[var(--accent)]">next event.</em>
          </h2>
          <dl data-reveal className="mt-10 space-y-5 text-sm">
            <div>
              <dt className="label">Email</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.contactEmail}</dd>
            </div>
            <div>
              <dt className="label">Phone</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.contactPhone}</dd>
            </div>
            <div>
              <dt className="label">Base</dt>
              <dd className="mt-1 font-serif text-2xl">{BRAND.base}</dd>
            </div>
          </dl>
        </div>
        <form onSubmit={submit} data-reveal className="space-y-6 self-end">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="label">Your name</span>
              <input name="name" required autoComplete="name" className="field" />
            </label>
            <label className="block">
              <span className="label">Email</span>
              <input name="email" type="email" required autoComplete="email" className="field" />
            </label>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="label">Project / organisation</span>
              <input name="org" autoComplete="organization" className="field" />
            </label>
            <label className="block">
              <span className="label">Event type</span>
              <select name="type" className="field">
                {YACHTS.map((y) => (
                  <option key={y.id} value={y.theme}>
                    {y.theme}
                  </option>
                ))}
                <option>Something else</option>
              </select>
            </label>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="label">Preferred date</span>
              <input name="date" type="date" className="field" />
            </label>
            <label className="block">
              <span className="label">Guests</span>
              <input name="guests" inputMode="numeric" placeholder="e.g. 80" className="field" />
            </label>
          </div>
          <label className="block">
            <span className="label">Tell us about the event</span>
            <textarea name="message" rows={3} className="field resize-none" />
          </label>
          <div className="flex flex-wrap items-center gap-5">
            <button className="btn">Send enquiry</button>
            {sent && (
              <p role="status" className="text-sm text-white/60">
                Opening your email app…
              </p>
            )}
          </div>
        </form>
      </div>
      <div className="border-t border-white/10 px-5 py-6 font-mono text-[10px] tracking-[0.25em] text-white/40 sm:px-10 md:px-[6vw]">
        © 2026 {BRAND.name} — {BRAND.tag.toUpperCase()} · PLACEHOLDER CONTENT: NAMES, DATES AND PRICES ARE FOR REVIEW.
      </div>
    </footer>
  );
}
