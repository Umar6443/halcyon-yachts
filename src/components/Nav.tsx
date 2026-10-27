"use client";

import { BRAND } from "@/data/yachts";
import { CHAPTERS } from "@/data/chapters";

const LINKS = [
  { label: "Fleet", t: CHAPTERS[1].t + 0.2 },
  { label: "Experience", t: CHAPTERS[2].t + 0.2 },
];

export default function Nav({ active, onJump, visible }: { active: number; onJump: (t: number) => void; visible: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-5 transition-all duration-1000 sm:px-10 sm:py-7 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <button onClick={() => onJump(0)} className="flex items-baseline gap-3" aria-label={`${BRAND.name} — back to start`}>
        <span className="font-serif text-2xl tracking-[0.4em]">{BRAND.name}</span>
        <span className="hidden font-mono text-[9px] tracking-[0.4em] text-white/60 sm:inline">{BRAND.tag.toUpperCase()}</span>
      </button>
      <nav className="flex items-center gap-8" aria-label="Primary">
        {LINKS.map((l) => (
          <button
            key={l.label}
            onClick={() => onJump(l.t)}
            className="hidden font-mono text-[11px] tracking-[0.3em] text-white/75 transition-colors hover:text-white md:block"
          >
            {l.label.toUpperCase()}
          </button>
        ))}
        <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="btn !px-5 !py-3">
          Book
        </button>
      </nav>
      <span className="sr-only" aria-live="polite">
        {CHAPTERS[active]?.label}
      </span>
    </header>
  );
}
