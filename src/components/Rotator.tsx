"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import type { Yacht } from "@/data/site";
import { yachtSeq } from "@/lib/seqs";

/**
 * Drag-to-rotate 360 degree view of one yacht.
 * The yacht is a seamless loop of frames (see tools/build_site_media.py); dragging moves a position around that
 * loop, with inertia, so the yacht turns at an even speed. Wheel / pinch / buttons zoom, the view buttons glide
 * to stern / port / bow / starboard, arrow keys step. It keeps drawing only while something moves.
 */

const AUTO_SPEED = 1 / 42; // loops per second while idle
const DRAG_LOOPS_PER_WIDTH = 0.85;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

const wrap01 = (x: number) => ((x % 1) + 1) % 1;
/** signed shortest way from a to b around the loop */
const shortest = (a: number, b: number) => {
  let d = wrap01(b) - wrap01(a);
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function Rotator({ yacht, active }: { yacht: Yacht; active: boolean }) {
  const seq = yachtSeq(yacht.id);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const [pct, setPct] = useState(0);
  const [coarse, setCoarse] = useState(false);
  const [auto, setAuto] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hint, setHint] = useState(true);
  const [label, setLabel] = useState("STARBOARD");

  const st = useRef({
    pos: 0.75,
    vel: 0,
    auto: true,
    zoom: 1,
    dragging: false,
    lastX: 0,
    lastT: 0,
    anim: null as null | { from: number; delta: number; t0: number; dur: number },
    needsPaint: true,
    started: false,
    pointers: new Map<number, { x: number; y: number }>(),
    pinch: 0,
    pinchZoom: 1,
    label: "",
  });
  useEffect(() => {
    st.current.auto = auto;
  }, [auto]);

  const applyZoom = useCallback((z: number, ox = 50, oy = 50) => {
    const s = st.current;
    s.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    if (stage.current) {
      stage.current.style.transformOrigin = `${ox}% ${oy}%`;
      stage.current.style.transform = s.zoom > 1.001 ? `scale(${s.zoom.toFixed(3)})` : "";
    }
    setZoom(s.zoom);
    s.needsPaint = true;
  }, []);

  const glideTo = useCallback((target: number, dur = 1.1) => {
    const s = st.current;
    s.vel = 0;
    s.anim = { from: s.pos, delta: shortest(s.pos, target), t0: performance.now(), dur: dur * 1000 };
  }, []);

  // load + loop
  useEffect(() => {
    if (!active) return;
    const s = st.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let alive = true;
    let lastPct = -1;

    // opens on the starboard beam: the same view as the card photo
    seq.manifestReady.then(() => {
      if (!s.started) {
        if (seq.marks.d) s.pos = (seq.marks.d[0] + seq.marks.d[1]) / 2;
        s.started = true;
        s.needsPaint = true;
      }
    });
    const startTimer = setTimeout(() => (s.started = true), 1500);
    seq.onDecoded = () => {
      s.needsPaint = true;
    };

    const labelFor = (p: number) => {
      const m = seq.marks;
      let best = "";
      let bd = 9;
      const names: Record<string, string> = { a: "STERN", b: "PORT SIDE", c: "BOW", d: "STARBOARD" };
      for (const k of ["a", "b", "c", "d"]) {
        if (!m[k]) continue;
        const mid = (m[k][0] + m[k][1]) / 2;
        const d = Math.abs(shortest(p, mid));
        if (d < bd) {
          bd = d;
          best = names[k];
        }
      }
      return best;
    };

    const frame = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      let moving = false;
      if (s.anim) {
        const k = Math.min(1, (now - s.anim.t0) / s.anim.dur);
        s.pos = wrap01(s.anim.from + s.anim.delta * ease(k));
        if (k >= 1) s.anim = null;
        moving = true;
      } else if (!s.dragging) {
        if (Math.abs(s.vel) > 0.004) {
          s.pos = wrap01(s.pos + s.vel * dt);
          s.vel *= Math.exp(-dt * 3.4);
          moving = true;
        } else if (s.auto && !reduced && s.started) {
          s.pos = wrap01(s.pos + AUTO_SPEED * dt);
          moving = true;
        }
      } else moving = true;

      if (moving || s.needsPaint) {
        const painted = seq.draw(canvas.current, s.pos, 0.5, 0.5, !moving);
        s.needsPaint = false;
        if (painted && still.current && still.current.style.opacity !== "0" && seq.hasPicture) still.current.style.opacity = "0";
        if (moving && !s.anim && !s.dragging && Math.abs(s.vel) <= 0.004 && !s.auto) s.needsPaint = true; // settle on a single frame
        const l = labelFor(s.pos);
        if (l && l !== s.label) {
          s.label = l;
          setLabel(l);
        }
      }
      const p = Math.round(seq.fraction * 100);
      if (p !== lastPct) {
        lastPct = p;
        setPct(p);
        setCoarse(!seq.levelReady(0));
      }
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      seq.invalidate();
      s.needsPaint = true;
    };
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      seq.onDecoded = undefined;
      seq.releaseBitmaps();
    };
  }, [active, seq, yacht.id]);

  // wheel zoom (needs a non-passive listener to stop the page scrolling)
  useEffect(() => {
    const el = box.current;
    if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const ox = ((e.clientX - r.left) / r.width) * 100;
      const oy = ((e.clientY - r.top) / r.height) * 100;
      applyZoom(st.current.zoom * Math.exp(-e.deltaY * 0.0016), ox, oy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [active, applyZoom]);

  const stopAuto = () => {
    if (st.current.auto) {
      st.current.auto = false;
      setAuto(false);
    }
    setHint(false);
  };

  const down = (e: React.PointerEvent) => {
    const s = st.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 1) {
      s.dragging = true;
      s.anim = null;
      s.vel = 0;
      s.lastX = e.clientX;
      s.lastT = performance.now();
      stopAuto();
    } else if (s.pointers.size === 2) {
      const [a, b] = Array.from(s.pointers.values());
      s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      s.pinchZoom = s.zoom;
      s.dragging = false;
    }
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 2) {
      const [a, b] = Array.from(s.pointers.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (s.pinch > 0) applyZoom(s.pinchZoom * (d / s.pinch));
      return;
    }
    if (!s.dragging) return;
    const w = box.current?.clientWidth || 800;
    const dx = e.clientX - s.lastX;
    const now = performance.now();
    const dpos = (dx / w) * DRAG_LOOPS_PER_WIDTH / Math.max(1, s.zoom * 0.85);
    s.pos = wrap01(s.pos + dpos);
    const dt = Math.max(8, now - s.lastT) / 1000;
    s.vel = s.vel * 0.6 + (dpos / dt) * 0.4;
    s.lastX = e.clientX;
    s.lastT = now;
  };
  const up = (e: React.PointerEvent) => {
    const s = st.current;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size === 0) {
      s.dragging = false;
      if (performance.now() - s.lastT > 90) s.vel = 0; // finger rested before lifting: no fling
      s.vel = Math.max(-1.6, Math.min(1.6, s.vel));
    }
    if (s.pointers.size < 2) s.pinch = 0;
  };

  const key = (e: React.KeyboardEvent) => {
    const s = st.current;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      stopAuto();
      s.anim = null;
      s.vel += (e.key === "ArrowRight" ? 1 : -1) * 0.22;
    } else if (e.key === "+" || e.key === "=") applyZoom(s.zoom * 1.25);
    else if (e.key === "-") applyZoom(s.zoom / 1.25);
    else if (e.key === "0") applyZoom(1);
  };

  const goView = (mark: "a" | "b" | "c" | "d", at: number) => {
    const m = seq.marks[mark];
    if (!m) return;
    stopAuto();
    glideTo(m[0] + (m[1] - m[0]) * at);
  };

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={`${yacht.name} 360 degree view. Drag or use the left and right arrow keys to rotate.`}
        onKeyDown={key}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="grab absolute inset-0 overflow-hidden bg-[#06101e] outline-none"
      >
        <div ref={stage} className="absolute inset-0 will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={still} src={yacht.beam} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500" />
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
        </div>
      </div>

      {/* top-left readout */}
      <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-5">
        <p className="font-mono text-[10px] tracking-[0.35em] text-white/60">360° EXTERIOR</p>
        <p className="mt-1 font-serif text-xl md:text-2xl">{label}</p>
      </div>

      {/* view buttons */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 md:bottom-5">
        {hint && (
          <p className="pointer-events-none rounded-full bg-black/40 px-4 py-1.5 font-mono text-[10px] tracking-[0.3em] text-white/80">DRAG TO ROTATE · SCROLL TO ZOOM</p>
        )}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3">
          {yacht.views.map((v) => (
            <button
              key={v.label}
              onClick={() => goView(v.mark, v.at)}
              className={`rounded-full border px-3.5 py-2 font-mono text-[10px] tracking-[0.25em] transition-colors ${
                label === v.label.toUpperCase() || (v.label === "Port" && label === "PORT SIDE")
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#06120a]"
                  : "border-white/25 bg-black/35 text-white/85 hover:border-white/70"
              }`}
            >
              {v.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* tools */}
      <div className="absolute right-3 top-3 flex flex-col gap-2 md:right-5 md:top-5">
        <ToolButton label={auto ? "Pause rotation" : "Play rotation"} onClick={() => (auto ? stopAuto() : (setAuto(true), setHint(false)))}>
          {auto ? <Pause size={16} /> : <Play size={16} />}
        </ToolButton>
        <ToolButton label="Zoom in" onClick={() => applyZoom(st.current.zoom * 1.3)}>
          <Plus size={16} />
        </ToolButton>
        <ToolButton label="Zoom out" onClick={() => applyZoom(st.current.zoom / 1.3)}>
          <Minus size={16} />
        </ToolButton>
        {zoom > 1.01 && (
          <ToolButton label="Reset zoom" onClick={() => applyZoom(1)}>
            <RotateCcw size={16} />
          </ToolButton>
        )}
      </div>

      {pct < 100 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/10">
            <div className="h-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <p className="pointer-events-none absolute bottom-16 left-4 rounded-full bg-black/45 px-3 py-1.5 font-mono text-[9px] tracking-[0.25em] text-white/70 md:bottom-5 md:left-6">
            {coarse ? "LOADING 360° VIEW" : "OPTIMISING QUALITY"} {pct}%
          </p>
        </>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/40 text-white/90 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </button>
  );
}
