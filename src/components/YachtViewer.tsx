"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { YACHTS, type Yacht, type YachtId } from "@/data/site";
import { prioritiseYacht } from "@/lib/seqs";
import { startScroll, stopScroll } from "@/lib/scroll";
import Rotator from "./Rotator";
import Booking from "./Booking";

type Tab = "360" | "interior" | "gallery";

/**
 * One yacht, opened full screen: the drag-to-rotate 360 degree exterior, a look-around interior, the gallery,
 * the details panel with the "Book This Yacht" button, and the booking flow (visual only).
 */
export default function YachtViewer({ id, onClose, onSwitch }: { id: YachtId; onClose: () => void; onSwitch: (id: YachtId) => void }) {
  const yacht = YACHTS.find((y) => y.id === id)!;
  const [tab, setTab] = useState<Tab>("360");
  const [booking, setBooking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // lock the page behind, take focus, return it on close
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    stopScroll();
    document.documentElement.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && root.current) {
        const f = Array.from(root.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')).filter((n) => !n.hasAttribute("disabled") && n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      startScroll();
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  // a new yacht starts on its 360 view with the details showing
  useEffect(() => {
    setTab("360");
    setBooking(false);
    prioritiseYacht(id);
    panel.current?.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [booking]);

  const idx = YACHTS.findIndex((y) => y.id === id);
  const step = (d: number) => onSwitch(YACHTS[(idx + d + YACHTS.length) % YACHTS.length].id);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={`${yacht.name} — ${yacht.theme}`}
      className="viewer-in fixed inset-0 z-[90] flex flex-col bg-[var(--bg)] text-[var(--cream)]"
      style={{ ["--accent" as string]: yacht.accent }}
      data-lenis-prevent
    >
      {/* top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <button onClick={() => step(-1)} aria-label="Previous yacht" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 hover:border-[var(--accent)]">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => step(1)} aria-label="Next yacht" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 hover:border-[var(--accent)]">
            <ChevronRight size={16} />
          </button>
          <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Yachts">
            {YACHTS.map((y) => (
              <button
                key={y.id}
                onClick={() => onSwitch(y.id)}
                onPointerEnter={() => prioritiseYacht(y.id)}
                aria-current={y.id === id}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 font-mono text-[10px] tracking-[0.22em] transition-colors ${
                  y.id === id ? "bg-white/10 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: y.accent }} />
                <span className="hidden sm:inline">{y.name}</span>
                <span className="sm:hidden">{y.index}</span>
              </button>
            ))}
          </nav>
        </div>
        <button ref={closeBtn} onClick={onClose} aria-label="Close" className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 font-mono text-[10px] tracking-[0.25em] hover:border-[var(--accent)] hover:text-[var(--accent)]">
          <X size={14} /> CLOSE
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* viewer */}
        <div className="flex shrink-0 flex-col md:min-h-0 md:flex-1">
          <div className="flex gap-1 border-b border-white/10 px-3 md:px-5" role="tablist">
            {(
              [
                ["360", "Exterior 360°"],
                ["interior", "Interior"],
                ["gallery", "Gallery"],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative px-4 py-3.5 font-mono text-[10px] tracking-[0.25em] transition-colors ${tab === t ? "text-white" : "text-white/50 hover:text-white/80"}`}
              >
                {label.toUpperCase()}
                {tab === t && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[var(--accent)]" />}
              </button>
            ))}
          </div>
          <div className="relative aspect-[4/3] w-full bg-black sm:aspect-[16/10] md:aspect-auto md:min-h-0 md:flex-1">
            {tab === "360" && <Rotator key={id} yacht={yacht} active />}
            {tab === "interior" && <Interior key={id} yacht={yacht} />}
            {tab === "gallery" && <Gallery key={id} yacht={yacht} />}
          </div>
        </div>

        {/* details / booking */}
        <aside ref={panel} data-lenis-prevent className="shrink-0 border-t border-white/10 md:w-[min(440px,38vw)] md:overflow-y-auto md:border-l md:border-t-0">
          {booking ? <Booking yacht={yacht} onBack={() => setBooking(false)} /> : <Details yacht={yacht} onBook={() => setBooking(true)} />}
        </aside>
      </div>
    </div>
  );
}

function Details({ yacht, onBook }: { yacht: Yacht; onBook: () => void }) {
  return (
    <div className="flex min-h-full flex-col gap-7 p-6 md:p-8">
      <header>
        <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">
          {yacht.index} / 04 — {yacht.theme.toUpperCase()}
        </p>
        <h2 className="mt-2 font-serif text-5xl leading-[0.9] tracking-[-0.02em] md:text-6xl">{yacht.name}</h2>
        <p className="mt-3 font-serif text-xl italic text-white/80">{yacht.tagline}</p>
      </header>
      <p className="text-[15px] leading-relaxed text-white/75">{yacht.description}</p>

      <dl className="grid grid-cols-4 gap-3 border-y border-white/12 py-5">
        {yacht.specs.map((s) => (
          <div key={s.label}>
            <dt className="label !text-[9px]">{s.label}</dt>
            <dd className="mt-1.5 font-serif text-2xl">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="label">On board</h3>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[14px] text-white/80">
          {yacht.amenities.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" /> {a}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="label">Built for</h3>
        <p className="mt-3 flex flex-wrap gap-2">
          {yacht.eventTypes.map((t) => (
            <span key={t} className="rounded-full border border-white/20 px-3 py-1.5 text-[13px] text-white/85">
              {t}
            </span>
          ))}
        </p>
      </section>

      <section className="rounded-sm border border-white/12 bg-white/[0.03] p-4">
        <h3 className="label flex items-center gap-2">
          <CalendarDays size={13} /> Next event
        </h3>
        <p className="mt-2 font-serif text-2xl leading-tight">{yacht.nextEvent.title}</p>
        <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-[var(--accent)]">{yacht.nextEvent.date.toUpperCase()}</p>
      </section>

      <footer className="mt-auto border-t border-white/15 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-serif text-4xl leading-none">{yacht.price}</p>
            <p className="mt-1.5 text-xs text-white/50">{yacht.priceNote}</p>
          </div>
        </div>
        <button onClick={onBook} className="btn mt-5 w-full !py-5 text-[12px]">
          Book this yacht
        </button>
        <p className="mt-3 text-center text-[11px] text-white/40">No payment is taken yet · booking preview</p>
      </footer>
    </div>
  );
}

/** interior stills you can look around: drag sideways to pan across the room */
function Interior({ yacht }: { yacht: Yacht }) {
  const [room, setRoom] = useState(0);
  const r = yacht.rooms[room];
  return (
    <div className="absolute inset-0">
      <PanImage key={r.src} src={r.src} alt={`${yacht.name} — ${r.label}`} />
      <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-5">
        <p className="font-mono text-[10px] tracking-[0.35em] text-white/60">INTERIOR</p>
        <p className="mt-1 font-serif text-xl md:text-2xl">{r.label}</p>
        <p className="mt-1 hidden max-w-xs text-sm text-white/70 md:block">{r.note}</p>
      </div>
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 md:bottom-5">
        <p className="pointer-events-none rounded-full bg-black/40 px-4 py-1.5 font-mono text-[10px] tracking-[0.3em] text-white/80">DRAG TO LOOK AROUND</p>
        <div className="flex flex-wrap justify-center gap-2 px-3">
          {yacht.rooms.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setRoom(i)}
              className={`rounded-full border px-3.5 py-2 font-mono text-[10px] tracking-[0.25em] transition-colors ${
                i === room ? "border-[var(--accent)] bg-[var(--accent)] text-[#06120a]" : "border-white/25 bg-black/35 text-white/85 hover:border-white/70"
              }`}
            >
              {x.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** a wide still, shown larger than the frame; it drifts slowly until the visitor drags it */
function PanImage({ src, alt }: { src: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const st = useRef({ x: 0.5, drag: false, lastX: 0, auto: true });
  const raf = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = st.current;
    let t0 = performance.now();
    const apply = () => {
      const el = img.current;
      const b = box.current;
      if (!el || !b) return;
      const over = Math.max(0, el.offsetWidth - b.clientWidth);
      el.style.transform = `translate3d(${(-over * s.x).toFixed(1)}px,0,0)`;
    };
    const loop = (now: number) => {
      raf.current = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (s.auto && !reduced) {
        s.x = 0.5 + 0.5 * Math.sin(((now - t0) / 1000) * 0.28 - Math.PI / 2) * 0.9;
        apply();
      }
    };
    raf.current = requestAnimationFrame(loop);
    const onRes = () => apply();
    window.addEventListener("resize", onRes);
    apply();
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", onRes);
      t0 = 0;
    };
  }, []);

  return (
    <div
      ref={box}
      className="grab absolute inset-0 overflow-hidden"
      onPointerDown={(e) => {
        const s = st.current;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        s.drag = true;
        s.auto = false;
        s.lastX = e.clientX;
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s.drag || !img.current || !box.current) return;
        const over = Math.max(1, img.current.offsetWidth - box.current.clientWidth);
        s.x = Math.min(1, Math.max(0, s.x - (e.clientX - s.lastX) / over));
        s.lastX = e.clientX;
        img.current.style.transform = `translate3d(${(-over * s.x).toFixed(1)}px,0,0)`;
      }}
      onPointerUp={() => (st.current.drag = false)}
      onPointerCancel={() => (st.current.drag = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={src} alt={alt} draggable={false} className="absolute left-0 top-0 h-full w-auto max-w-none will-change-transform" style={{ minWidth: "135%" }} onLoad={() => img.current && box.current && (img.current.style.transform = `translate3d(${-(Math.max(0, img.current.offsetWidth - box.current.clientWidth)) * st.current.x}px,0,0)`)} />
    </div>
  );
}

function Gallery({ yacht }: { yacht: Yacht }) {
  const [i, setI] = useState(0);
  const g = yacht.gallery[i];
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={g.src} src={g.src} alt={g.caption} className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 md:inset-x-6 md:bottom-5">
        <p className="font-serif text-xl italic md:text-2xl">{g.caption}</p>
        <div className="flex gap-2">
          {yacht.gallery.map((x, k) => (
            <button
              key={x.src}
              onClick={() => setI(k)}
              aria-label={x.caption}
              aria-current={k === i}
              className={`h-12 w-20 overflow-hidden rounded-sm border-2 transition-opacity ${k === i ? "border-[var(--accent)]" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
