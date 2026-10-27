"use client";

import { BRAND } from "@/data/yachts";

/** Branded loader bound to real download progress (ring video + first frames of the first flight). */
export default function Loader({ progress, done }: { progress: number; done: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#06182a] transition-opacity duration-1000 ${
        done ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={done}
    >
      <div className="font-serif text-4xl tracking-[0.45em] text-[#f3efe6] sm:text-5xl">{BRAND.name}</div>
      <div className="mt-3 font-mono text-[10px] tracking-[0.5em] text-white/50">{BRAND.tag.toUpperCase()}</div>
      <div className="mt-12 h-px w-56 overflow-hidden bg-white/10 sm:w-72">
        <div className="h-full bg-[#3fd8d2] transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 flex w-56 justify-between font-mono text-[10px] tracking-[0.3em] text-white/50 sm:w-72">
        <span>PREPARING THE BAY</span>
        <span>{String(progress).padStart(3, "0")}</span>
      </div>
    </div>
  );
}
