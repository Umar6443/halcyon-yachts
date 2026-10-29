"use client";

import { BRAND } from "@/data/site";
import { useLoadState } from "@/lib/loadstate";

/** Branded loader bound to the real download progress of the first screen of the film. */
export default function Loader() {
  const { progress, ready, note } = useLoadState();
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050b16] transition-opacity duration-700 ${
        ready ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={ready}
    >
      <div className="font-serif text-4xl tracking-[0.4em] text-[#f3efe6] sm:text-5xl">{BRAND.name}</div>
      <div className="mt-3 font-mono text-[10px] tracking-[0.5em] text-white/50">{BRAND.tag.toUpperCase()}</div>
      <div className="mt-12 h-px w-56 overflow-hidden bg-white/10 sm:w-72">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 flex w-56 justify-between font-mono text-[10px] tracking-[0.3em] text-white/50 sm:w-72">
        <span>PREPARING THE BAY</span>
        <span>{String(progress).padStart(3, "0")}</span>
      </div>
      <p className="mt-6 h-4 font-mono text-[10px] tracking-[0.25em] text-white/35">{note}</p>
    </div>
  );
}
