"use client";

import { memo, useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { BRAND, YACHTS, type YachtId } from "@/data/site";
import { loadState } from "@/lib/loadstate";
import { onScroll, scrollToTarget, scrollY, startScroll } from "@/lib/scroll";
import { heroSeq, hintYacht, setHeroVisible, startBackgroundLoad } from "@/lib/seqs";

/**
 * The opening film: eight themed yachts at anchor in a ring, the camera drops to one of them, circles it once
 * all the way round (stern, port, bow, starboard), steps aboard over the swim platform and walks through the salon.
 *
 * It is ONE sequence of pre-assembled frames drawn on ONE canvas (the dissolves between the generated clips are
 * baked into the frames by tools/build_site_media.py), so nothing is blended or blurred live while scrolling.
 * Scroll position -> "u" (scroll units) -> position in the film; overlays are plain elements whose opacity and
 * offset are written directly each frame (no animation library, no layout, no filters).
 */

/** scroll length in "units"; one unit of scroll = UNIT viewport heights */
const D = 14;
const UNIT = 0.62;
/** phase boundaries in scroll units */
const U = { hold: 0.55, descent: 2.6, orbit: 8.3, approach: 10.5, interior: 13.4 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const FEATURED = YACHTS[0];

function Hero({ onOpenYacht }: { onOpenYacht: (id: YachtId) => void }) {
  const wrap = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cv = el.querySelector<HTMLCanvasElement>("[data-cv]")!;
    const ringWrap = el.querySelector<HTMLElement>("[data-ringwrap]")!;
    const ringVideo = el.querySelector<HTMLVideoElement>("[data-ringvideo]")!;
    const bar = el.querySelector<HTMLElement>("[data-bar]")!;
    const compass = el.querySelector<HTMLElement>("[data-compass]")!;
    const compassLabel = el.querySelector<HTMLElement>("[data-compass-label]")!;
    const compassDeg = el.querySelector<HTMLElement>("[data-compass-deg]")!;
    const pill = el.querySelector<HTMLElement>("[data-hdpill]")!;
    const fades = Array.from(el.querySelectorAll<HTMLElement>("[data-fade]")).map((node) => {
      const [a, b, c, d] = node.dataset.fade!.split(",").map(Number);
      return { node, a, b, c, d, dy: Number(node.dataset.dy ?? 24) };
    });

    /* ---------- the film ---------- */
    const seq = heroSeq();
    let dEnd = 0.2;
    let aStart = 0.8;
    let iStart = 0.9;
    seq.manifestReady.then(() => {
      const m = seq.marks;
      if (m.hero_descent) dEnd = m.hero_descent[1];
      if (m.hero_approach) aStart = m.hero_approach[0];
      if (m.hero_interior) iStart = m.hero_interior[0];
      requestRender();
    });

    /** scroll units -> position in the film (0..1) */
    const filmAt = (u: number) => {
      if (u <= U.hold) return 0;
      if (u < U.descent) return dEnd * smooth(U.hold, U.descent, u);
      if (u < U.orbit) return lerp(dEnd, aStart, (u - U.descent) / (U.orbit - U.descent));
      if (u < U.approach) return lerp(aStart, iStart, (u - U.orbit) / (U.approach - U.orbit));
      if (u < U.interior) return lerp(iStart, 1, (u - U.approach) / (U.interior - U.approach));
      return 1;
    };

    /* ---------- geometry ---------- */
    let vh = window.innerHeight;
    let top = 0;
    let height = 1;
    let span = 1;
    const measure = () => {
      vh = window.innerHeight;
      top = el.getBoundingClientRect().top + window.scrollY;
      height = el.offsetHeight;
      span = Math.max(1, height - vh);
    };

    /* ---------- render: numbers -> pixels ---------- */
    const written = new WeakMap<HTMLElement, Record<string, string>>();
    const css = (node: HTMLElement, prop: "opacity" | "transform" | "visibility", value: string) => {
      let w = written.get(node);
      if (!w) written.set(node, (w = {}));
      if (w[prop] === value) return;
      w[prop] = value;
      node.style[prop] = value;
    };
    let u = 0;
    let queued = false;
    let visible = true;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let compassText = "";

    const render = (settle = false) => {
      queued = false;
      if (!visible) return;

      // opening ring loop sits on top until the descent begins
      // (and for as long as the film has no picture of its own, so there is never an empty frame)
      const ringOp = seq.hasPicture ? 1 - smooth(U.hold - 0.05, U.hold + 0.3, u) : 1;
      css(ringWrap, "opacity", ringOp.toFixed(3));
      if (!reduced) {
        if (ringOp < 0.01 && !ringVideo.paused) ringVideo.pause();
        else if (ringOp >= 0.01 && ringVideo.paused && opened) ringVideo.play().catch(() => {});
      }

      seq.draw(cv, filmAt(u), 0.5, 0.5, settle);

      for (const f of fades) {
        const op = smooth(f.a, f.b, u) * (1 - smooth(f.c, f.d, u));
        css(f.node, "opacity", op.toFixed(3));
        css(f.node, "visibility", op < 0.01 ? "hidden" : "visible");
        css(f.node, "transform", op < 0.995 ? `translate3d(0, ${((1 - op) * f.dy).toFixed(1)}px, 0)` : "");
      }

      // compass: where the camera is on its way round the yacht
      const of = clamp01((u - U.descent) / (U.orbit - U.descent));
      const deg = Math.round(of * 360);
      css(compass, "transform", `rotate(${deg}deg)`);
      const label = of < 0.1 ? "STERN" : of < 0.38 ? "PORT SIDE" : of < 0.62 ? "BOW" : of < 0.9 ? "STARBOARD" : "STERN";
      const text = `${label}|${deg}`;
      if (text !== compassText) {
        compassText = text;
        compassLabel.textContent = label;
        compassDeg.textContent = `${String(deg).padStart(3, "0")}°`;
      }

      css(bar, "transform", `scaleX(${(u / D).toFixed(4)})`);

      // once the picture is at rest, redraw with one pristine frame (no half-blend left on screen)
      if (!settle) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => render(true), 140);
      }
    };
    const requestRender = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => render());
    };
    seq.onDecoded = requestRender;

    const update = (y: number) => {
      const next = clamp01((y - top) / span) * D;
      const inView = y + vh > top - 50 && y < top + height + 50;
      if (inView !== visible) {
        visible = inView;
        setHeroVisible(inView);
        if (!inView) {
          if (!ringVideo.paused) ringVideo.pause();
          setTimeout(() => !visible && seq.releaseBitmaps(), 3000);
        } else {
          seq.invalidate();
          requestRender();
        }
      }
      if (next !== u && visible) {
        u = next;
        // draw straight away: this runs inside the scroll tick, so the picture follows the scroll in the same frame
        render();
      } else if (next !== u) u = next;
    };
    const offScroll = onScroll(update);

    /* ---------- loading ----------
     * The site opens as soon as the first, coarse pass of the film (level 0: every 8th frame, a few MB) and the
     * opening loop are in. Everything else keeps arriving behind it, nearest the visitor first, and never blocks. */
    let alive = true;
    let opened = false;
    const t0 = performance.now();
    seq.start();

    let posterReady = false;
    const poster = new Image();
    poster.onload = poster.onerror = () => (posterReady = true);
    poster.src = "img/hero-poster.webp";

    ringVideo.muted = true;
    ringVideo.playbackRate = 0.8;

    const open = () => {
      if (opened) return;
      opened = true;
      loadState.set({ progress: 100, note: "" });
      setTimeout(() => {
        if (!alive) return;
        measure();
        update(scrollY());
        render();
        // the opening loop starts streaming now (its poster, the same picture, is on screen until it plays)
        ringVideo.src = "video/ring-loop.mp4";
        if (!reduced) ringVideo.play().catch(() => {});
        loadState.set({ ready: true });
        startScroll();
        startBackgroundLoad();
      }, 300);
    };
    const poll = setInterval(() => {
      if (!alive) return;
      const sec = (performance.now() - t0) / 1000;
      if (!opened) {
        const known = seq.count > 0;
        // the gate: the first quarter of the film at its coarse level (a couple of MB). The opening loop never gates
        // it: until the video can play, its poster (the same picture) is on screen.
        const g = known ? seq.gate(0, 0.26) : { done: false, fraction: 0 };
        loadState.set({
          progress: Math.min(99, Math.round(known ? 8 + g.fraction * 90 : 3)),
          note: sec > 12 && !known ? "Still connecting…" : sec > 7 ? "Slow connection: the rest keeps loading in the background" : "",
        });
        if (posterReady && g.done) open();
        else if (sec > 9 && posterReady && seq.loaded >= 3) open(); // slow link: start with what has arrived
        else if (sec > 40) open();
        return;
      }
      // after opening: a small, quiet indicator while the film is still refining
      if (seq.count > 0) {
        const pct = Math.round(seq.fraction * 100);
        const done = seq.complete;
        css(pill, "opacity", done ? "0" : "1");
        if (!done && pill.dataset.pct !== String(pct)) {
          pill.dataset.pct = String(pct);
          pill.lastElementChild!.textContent = `${pct}%`;
        }
      }
    }, 120);

    // free decoded frames when the film has been out of view for a while (full-quality bitmaps are large)
    const memory = setInterval(() => {
      if (!visible && seq.lastDrawAt && performance.now() - seq.lastDrawAt > 4000) seq.releaseBitmaps();
    }, 3000);

    const onResize = () => {
      measure();
      seq.invalidate();
      update(scrollY());
      requestRender();
    };
    window.addEventListener("resize", onResize);
    measure();
    render();

    return () => {
      alive = false;
      clearTimeout(settleTimer);
      clearInterval(poll);
      clearInterval(memory);
      offScroll();
      window.removeEventListener("resize", onResize);
      seq.dispose();
    };
  }, []);

  const notes = FEATURED.rooms.map((r) => r.note);

  return (
    <section ref={wrap} id="top" className="relative" style={{ height: `${(D * UNIT + 1) * 100}svh` }} aria-label="Opening film">
      <div className="sticky top-0 h-svh overflow-hidden bg-[#050b16]">
        {/* the film */}
        <canvas data-cv className="absolute inset-0 h-full w-full" role="img" aria-label="Eight themed yachts at anchor in an Adriatic bay; the camera circles one of them and steps aboard" />
        <div data-ringwrap className="absolute inset-0">
          <video data-ringvideo className="h-full w-full object-cover" poster="img/hero-poster.webp" muted loop playsInline preload="none" aria-hidden />
        </div>

        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,10,22,.66)_0%,rgba(4,10,22,.22)_42%,transparent_70%),linear-gradient(0deg,rgba(4,10,22,.7)_0%,transparent_34%),linear-gradient(180deg,rgba(4,10,22,.62)_0%,transparent_22%)]" />

        {/* quiet "still refining" indicator while the rest of the film arrives */}
        <div data-hdpill className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 font-mono text-[9px] tracking-[0.25em] text-white/70 opacity-0 transition-opacity duration-700 md:bottom-5 md:right-6" aria-hidden>
          <span>OPTIMISING QUALITY</span>
          <span>0%</span>
        </div>

        {/* progress hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] bg-white/10">
          <div data-bar className="h-full origin-left bg-[var(--accent)]" style={{ transform: "scaleX(0)" }} />
        </div>

        <div className="pointer-events-none absolute inset-0 z-20">
          {/* intro */}
          <div data-fade="0,0,0.35,0.9" data-dy="-40" className="absolute left-5 top-[20svh] max-w-[90vw] sm:left-10 md:left-[6vw] md:top-[22svh]">
            <p className="mb-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.4em] text-white/80 sm:text-[11px]">
              <span className="h-px w-8 bg-[var(--accent)]" /> {BRAND.name} — {BRAND.tag.toUpperCase()}
            </p>
            <h1 className="font-serif text-[15vw] font-medium leading-[0.9] tracking-[-0.02em] sm:text-[9vw] md:text-[6.6vw]">
              {BRAND.headline[0]}
              <br />
              <em className="font-normal italic text-[var(--accent)]">{BRAND.headline[1]}</em>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/80">{BRAND.intro}</p>
          </div>

          {/* the four worlds */}
          <ul data-fade="0,0,0.3,0.8" data-dy="30" className="pointer-events-auto absolute inset-x-5 bottom-[11svh] flex flex-wrap gap-2 sm:inset-x-10 md:inset-x-[6vw] md:bottom-[12svh]">
            {YACHTS.map((y) => (
              <li key={y.id}>
                <button
                  onClick={() => onOpenYacht(y.id)}
                  onPointerEnter={() => hintYacht(y.id)}
                  className="group flex items-center gap-2.5 rounded-full border border-white/20 bg-black/30 px-4 py-2.5 backdrop-blur-sm transition-colors hover:border-white/60"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: y.accent, boxShadow: `0 0 10px ${y.accent}` }} />
                  <span className="font-mono text-[10px] tracking-[0.25em] text-white/85 group-hover:text-white">{y.short.toUpperCase()}</span>
                </button>
              </li>
            ))}
          </ul>
          <div data-fade="0,0,0.3,0.8" data-dy="20" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <span className="font-mono text-[10px] tracking-[0.4em] text-white/70">SCROLL</span>
            <ArrowDown size={16} className="mx-auto mt-2 animate-bounce text-[var(--accent)]" />
          </div>

          {/* descent */}
          <div data-fade="1.0,1.5,2.3,2.7" className="absolute bottom-[8svh] left-5 max-w-[88vw] sm:left-10 md:left-[6vw]">
            <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">EIGHT YACHTS · FOUR WORLDS</p>
            <p className="mt-3 font-serif text-[9vw] italic leading-none sm:text-5xl md:text-6xl">Every yacht, its own party.</p>
          </div>

          {/* the featured yacht, all the way round */}
          <div data-fade="2.7,3.3,8.0,8.4" className="absolute left-5 top-[11svh] max-w-[88vw] sm:left-10 md:left-[6vw] md:top-[12svh]">
            <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)] sm:text-[11px]">
              {FEATURED.index} / {String(YACHTS.length).padStart(2, "0")} — {FEATURED.theme.toUpperCase()}
            </p>
            <h2 className="mt-2 font-serif text-[14vw] font-medium leading-[0.88] tracking-[-0.02em] sm:text-[9vw] md:text-[5.6vw]">{FEATURED.name}</h2>
            <p className="mt-2 font-serif text-lg italic text-white/85 sm:text-xl">{FEATURED.tagline}</p>
          </div>
          <div data-fade="2.8,3.3,8.0,8.4" className="absolute bottom-[7svh] left-5 flex items-center gap-4 sm:left-10 md:left-[6vw]">
            <svg viewBox="0 0 64 64" className="h-16 w-16 md:h-20 md:w-20" aria-hidden>
              <circle cx="32" cy="32" r="29" fill="rgba(4,10,22,.45)" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
              <circle cx="32" cy="32" r="3" fill="var(--accent)" />
              <g data-compass style={{ transformOrigin: "32px 32px" }}>
                <line x1="32" y1="32" x2="32" y2="6" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="32" cy="6" r="3.5" fill="var(--accent)" />
              </g>
            </svg>
            <div>
              <p className="font-mono text-[10px] tracking-[0.35em] text-white/60">360° EXTERIOR</p>
              <p data-compass-label className="mt-1 font-serif text-2xl md:text-3xl">STERN</p>
              <p data-compass-deg className="font-mono text-[11px] tracking-[0.3em] text-[var(--accent)]">000°</p>
            </div>
          </div>
          {FEATURED.amenities.slice(0, 3).map((a, i) => (
            <p
              key={a}
              data-fade={`${3.4 + i * 1.7},${3.8 + i * 1.7},${5.0 + i * 1.7},${5.4 + i * 1.7}`}
              className="absolute bottom-[7svh] right-5 max-w-[60vw] text-right font-serif text-2xl italic sm:right-10 md:right-[6vw] md:text-4xl"
            >
              <span className="mb-1 block font-mono text-[10px] not-italic tracking-[0.4em] text-[var(--accent)]">0{i + 1} / 03</span>
              {a}
            </p>
          ))}

          {/* boarding */}
          <div data-fade="8.5,8.9,10.0,10.4" className="absolute left-5 top-[34svh] max-w-[88vw] sm:left-10 md:left-[6vw]">
            <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">THE SWIM PLATFORM</p>
            <p className="mt-3 font-serif text-[13vw] leading-[0.92] sm:text-[8vw] md:text-[5.6vw]">
              Step <em className="italic text-[var(--accent)]">aboard.</em>
            </p>
          </div>

          {/* interior */}
          <div data-fade="10.6,11.0,13.1,13.4" className="absolute left-5 top-[11svh] sm:left-10 md:left-[6vw] md:top-[12svh]">
            <p className="font-mono text-[10px] tracking-[0.4em] text-[var(--accent)] sm:text-[11px]">{FEATURED.name} — MAIN SALON</p>
          </div>
          {notes.map((n, i) => {
            const s = 10.8 + i * 0.85;
            return (
              <p
                key={n}
                data-fade={`${s},${s + 0.35},${s + 0.8},${s + 1.1}`}
                className="absolute bottom-[8svh] left-5 max-w-[88vw] font-serif text-[8vw] italic leading-[1.05] sm:left-10 sm:text-4xl md:left-[6vw] md:text-5xl"
              >
                <span className="mb-3 block font-mono text-[10px] not-italic tracking-[0.4em] text-[var(--accent)]">
                  0{i + 1} / 0{notes.length}
                </span>
                {n}
              </p>
            );
          })}

          {/* the way on: a soft shade behind the text, over the bright salon windows */}
          <div data-fade="12.8,13.5,99,100" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,10,22,.82)_0%,rgba(4,10,22,.5)_45%,transparent_75%)]" />
          {/* the way on */}
          <div data-fade="13.0,13.5,99,100" className="pointer-events-auto absolute left-5 top-[22svh] max-w-[90vw] sm:left-10 md:left-[6vw]">
            <p className="mb-4 font-mono text-[10px] tracking-[0.4em] text-[var(--accent)]">YOUR MOVE</p>
            <h2 className="font-serif text-[12vw] leading-[0.92] sm:text-[7vw] md:text-[5.2vw]">
              Four yachts.
              <br />
              <em className="italic text-[var(--accent)]">Pick your world.</em>
            </h2>
            <button onClick={() => scrollToTarget("#fleet")} className="btn mt-8">
              Explore the fleet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(Hero);
