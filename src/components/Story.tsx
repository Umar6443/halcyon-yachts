"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ArrowDown } from "lucide-react";
import { BRAND, YACHTS, type Yacht } from "@/data/yachts";
import { CHAPTERS } from "@/data/chapters";
import { Sequence, setSequenceRank } from "@/lib/sequence";
import Loader from "./Loader";
import Nav from "./Nav";
import Footer from "./Footer";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ limitCallbacks: true });

/* ---------- tuning ---------- */

/** Total timeline length in "units". One unit of scroll = UNIT viewport heights. */
const D = 21.2;
const UNIT = 0.66;
/** Where each yacht's salon sits in its exterior shot (0..1): the point the "dive in" zooms toward. */
const SALON = { a: { x: 0.62, y: 0.52 }, b: { x: 0.34, y: 0.5 } };

type SeqName = "a_focus" | "ab_slide" | "a_interior" | "b_interior" | "a_close" | "b_close";
type Seqs = Record<SeqName, Sequence>;

/**
 * Everything GSAP animates, as plain numbers; render() turns them into pixels.
 *  ringOp   opening ring loop          fOp/fProg   ring -> yacht A descent
 *  sOp/sProg  A -> B slide             iaProg/ibProg  interior films
 *  dA/dB    "dive in" 0 = exterior, 1 = interior        fin  closing return to the ring
 */
const S = {
  ringOp: 1, fOp: 0, fProg: 0, sOp: 0, sProg: 0, iaProg: 0, ibProg: 0, dA: 0, dB: 0, fin: 0,
  cam: 0, pb: 0, ps: 0, hero: 1, a_close: 0, b_close: 0,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** exterior and interior layer looks during the "dive in" (d: 0 exterior .. 1 interior) */
const extLook = (d: number) => {
  const e = smooth(0, 1, d);
  return { op: 1 - smooth(0.35, 0.8, d), scale: 1 + 0.5 * e, blur: 12 * Math.pow(e, 1.5) };
};
const intLook = (d: number) => {
  const e = smooth(0, 1, d);
  return { op: smooth(0.3, 0.75, d), scale: 1 + 0.18 * (1 - e), blur: 12 * Math.pow(1 - e, 1.5) };
};

export default function Story() {
  const root = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const jump = useRef<(t: number) => void>(() => {});

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;

    const ringWrap = q("[data-ringwrap]");
    const ringVideo = q<HTMLVideoElement>("[data-ringvideo]");
    const cvF = q<HTMLCanvasElement>("[data-cv='focus']");
    const cvS = q<HTMLCanvasElement>("[data-cv='slide']");
    const cvIA = q<HTMLCanvasElement>("[data-cv='int-a']");
    const cvIB = q<HTMLCanvasElement>("[data-cv='int-b']");
    const camEl = q("[data-cam]");
    const shadeHero = q("[data-shade='hero']");
    const shadeFrame = q("[data-shade='frame']");
    const shadeSide = q("[data-shade='side']");
    const bar = q("[data-bar]");

    /* ---------- sequences ---------- */
    const seqs: Seqs = {
      a_focus: new Sequence("a_focus"),
      ab_slide: new Sequence("ab_slide"),
      a_interior: new Sequence("a_interior"),
      b_interior: new Sequence("b_interior"),
      a_close: new Sequence("a_close"),
      b_close: new Sequence("b_close"),
    };
    const winCanvas: Record<string, HTMLCanvasElement> = {
      a_close: q("[data-wcv='a_close']"),
      b_close: q("[data-wcv='b_close']"),
    };

    /* ---------- geometry ---------- */
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let mobile = vw < 768;
    /** frame fraction (0..1) of a 16:9 source -> stage pixels, for a cover-fitted layer */
    const coverPt = (fx: number, fy: number) => {
      const k = Math.max(vw / 16, vh / 9);
      const fw = 16 * k;
      const fh = 9 * k;
      return [(vw - fw) / 2 + fx * fw, (vh - fh) / 2 + fy * fh] as const;
    };
    let salonA = coverPt(SALON.a.x, SALON.a.y);
    let salonB = coverPt(SALON.b.x, SALON.b.y);
    const measure = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      mobile = vw < 768;
      salonA = coverPt(SALON.a.x, SALON.a.y);
      salonB = coverPt(SALON.b.x, SALON.b.y);
    };

    /* ---------- render: numbers -> pixels ---------- */
    let queued = false;
    /** last value written to each style property, so unchanged values never touch the DOM */
    const written = new WeakMap<HTMLElement, Record<string, string>>();
    const css = (el: HTMLElement, prop: "opacity" | "transform" | "filter" | "transformOrigin", value: string) => {
      let w = written.get(el);
      if (!w) written.set(el, (w = {}));
      if (w[prop] === value) return;
      w[prop] = value;
      el.style[prop] = value;
    };
    const place = (c: HTMLCanvasElement, op: number, scale: number, blur: number, origin?: readonly [number, number]) => {
      css(c, "opacity", String(op));
      if (origin) css(c, "transformOrigin", `${origin[0]}px ${origin[1]}px`);
      css(c, "transform", scale !== 1 ? `scale(${scale})` : "");
      css(c, "filter", blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : "");
    };
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const render = (settle = false) => {
      queued = false;

      // a clip whose first frames have not arrived yet must never show as an empty layer:
      // until it has a picture, the layer before it stays on screen
      const rF = seqs.a_focus.hasPicture;
      const rS = seqs.ab_slide.hasPicture;
      const dA = seqs.a_interior.hasPicture ? S.dA : 0;
      const dB = seqs.b_interior.hasPicture ? S.dB : 0;

      // opening: the ring loop hands over to the descent (their first frames are the same picture)
      const finBlur = 6 * Math.sin(Math.PI * S.fin);
      const ringOp = Math.max(S.ringOp, S.fin, S.fOp > 0.01 && !rF ? 1 : 0);
      css(ringWrap, "opacity", String(ringOp));
      css(ringWrap, "filter", finBlur > 0.2 && S.fin > 0 ? `blur(${finBlur.toFixed(1)}px)` : "");
      // the hero loop is hidden for most of the page: stop decoding it while it can't be seen
      if (!reduced) {
        if (ringOp < 0.01 && !ringVideo.paused) ringVideo.pause();
        else if (ringOp >= 0.01 && ringVideo.paused) ringVideo.play().catch(() => {});
      }

      // exterior layers + interior layers, linked by the "dive in" value of each yacht
      const xa = extLook(dA);
      const xb = extLook(dB);
      const ia = intLook(dA);
      const ib = intLook(dB);
      const slideWaiting = S.sOp > 0.01 && !rS; // slide not loaded yet: keep yacht A's view (it is the slide's first frame)
      const fE = rF ? Math.max(S.fOp * xa.op, slideWaiting ? xa.op : 0) : 0;
      const sE = rS ? S.sOp * xb.op * (1 - S.fin) : 0;
      place(cvF, fE, xa.scale, xa.blur, salonA);
      place(cvS, sE, xb.scale, Math.max(xb.blur, S.sOp > 0 && S.fin > 0 ? finBlur : 0), salonB);
      place(cvIA, ia.op, ia.scale, ia.blur, salonA);
      place(cvIB, ib.op, ib.scale, ib.blur, salonB);

      // global camera shift: lifts the exterior shot so the text strip sits below the yachts
      css(
        camEl,
        "transform",
        mobile
          ? `translate3d(0, ${-5 * S.cam}%, 0) scale(${1 + 0.1 * S.cam})`
          : `translate3d(0, ${-9 * S.cam}%, 0) scale(${1 + 0.2 * S.cam})`,
      );
      css(shadeHero, "opacity", String(S.hero));
      css(shadeFrame, "opacity", String(S.pb));
      css(shadeSide, "opacity", String(S.ps));

      // portrait screens crop a 16:9 frame to a narrow slice: pan that slice with the action (A, then B)
      const fxF = mobile ? 0.5 + 0.12 * smooth(0, 1, S.fProg) : 0.5;
      const fxS = mobile ? 0.62 - 0.26 * smooth(0, 1, S.sProg) : 0.5;
      if (fE > 0.01 || S.fOp > 0.01) seqs.a_focus.draw(cvF, S.fProg, fxF, 0.5, settle);
      if (sE > 0.01 || S.sOp > 0.01) seqs.ab_slide.draw(cvS, S.sProg, fxS, 0.5, settle);
      if (ia.op > 0.01 || S.dA > 0.001) seqs.a_interior.draw(cvIA, S.iaProg, 0.5, 0.5, settle);
      if (ib.op > 0.01 || S.dB > 0.001) seqs.b_interior.draw(cvIB, S.ibProg, 0.5, 0.5, settle);
      for (const key of ["a_close", "b_close"] as const) {
        if (S[key] > 0) seqs[key].draw(winCanvas[key], S[key], 0.5, 0.5, settle);
      }
      // once scrolling pauses, redraw with one pristine frame (no half-blend left on screen)
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
    Object.values(seqs).forEach((s) => (s.onDecoded = requestRender));

    /* ---------- smooth scroll ---------- */
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.16, smoothWheel: !reduced });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenis.stop();

    /* ---------- the timeline ---------- */
    const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    const set = (props: gsap.TweenVars, at: number, dur: number, vars: gsap.TweenVars = {}) =>
      tl.to(S, { ...props, duration: dur, ...vars }, at);

    // hero text out
    tl.to("[data-hero]", { autoAlpha: 0, y: -48, duration: 0.55, ease: "power2.in" }, 0.1);
    set({ hero: 0 }, 0.1, 0.8);

    // ---- ring -> yacht A: one continuous descent; the ring stays in view the whole way
    set({ ringOp: 0 }, 0.25, 0.3);
    set({ fOp: 1 }, 0.25, 0.3);
    set({ fProg: 1 }, 0.25, 1.75, { ease: "power1.inOut" });

    /**
     * One yacht's chapter: title, spec strip, dive into the interior film, detail windows, back out.
     * Returns the time at which the exterior view is back.
     */
    const chapter = (y: Yacht, t0: number, keys: { dive: "dA" | "dB"; prog: "iaProg" | "ibProg" }) => {
      const id = y.id;
      const gsel = (s: string) => `[data-${s}="${id}"]`;

      // title + frame shade + camera lift
      tl.fromTo(`${gsel("title")} > *`, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, stagger: 0.09, duration: 0.5, ease: "power3.out" }, t0 - 0.3);
      set({ pb: 1 }, t0 - 0.3, 0.6);
      set({ cam: 1 }, t0, 0.7, { ease: "power2.inOut" });

      // spec strip along the bottom
      tl.fromTo(gsel("specs"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, t0 + 0.25);
      tl.fromTo(`${gsel("specs")} [data-s]`, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, stagger: 0.07, duration: 0.45, ease: "power3.out" }, t0 + 0.25);

      // dive in: the exterior pushes toward the salon and defocuses into the interior film
      const ds = t0 + 1.9;
      tl.to(gsel("specs"), { autoAlpha: 0, y: 20, duration: 0.3, ease: "power2.in" }, ds);
      tl.to(gsel("title"), { autoAlpha: 0, y: -16, duration: 0.3, ease: "power2.in" }, ds + 0.05);
      set({ cam: 0 }, ds, 0.7, { ease: "power2.inOut" });
      set({ [keys.dive]: 1 }, ds, 0.85, { ease: "power2.inOut" });

      // interior: slow dolly through the salon, captions step in one at a time
      const is = ds + 0.85;
      set({ [keys.prog]: 1 }, is, 2.1);
      tl.fromTo(gsel("ilabel"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, is);
      y.interiorNotes.forEach((_, i) => {
        const nt = is + 0.1 + i * 0.72;
        tl.fromTo(`[data-note="${id}-${i}"]`, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }, nt);
        tl.to(`[data-note="${id}-${i}"]`, { autoAlpha: 0, y: -14, duration: 0.22, ease: "power2.in" }, nt + 0.45);
      });

      // detail windows (right): each wipes up over the last, in the same scene
      let t = is + 2.2;
      tl.to(gsel("ilabel"), { autoAlpha: 0, duration: 0.3 }, t);
      set({ ps: 1 }, t, 0.5);
      tl.fromTo(gsel("win"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, t + 0.1);
      y.windows.forEach((w, i) => {
        const layer = `[data-layer="${id}-${i}"]`;
        const cap = `[data-cap="${id}-${i}"]`;
        const hold = w.kind === "seq" ? 1.3 : 0.9;
        tl.fromTo(layer, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.45, ease: "power3.inOut" }, t + 0.1);
        tl.fromTo(`${layer} [data-media]`, { scale: 1.18 }, { scale: 1, duration: 0.9, ease: "power2.out" }, t + 0.1);
        tl.fromTo(cap, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, t + 0.35);
        if (i > 0) tl.to(`[data-cap="${id}-${i - 1}"]`, { autoAlpha: 0, duration: 0.25 }, t + 0.1);
        if (w.kind === "seq") set({ [w.seq]: 1 }, t + 0.35, hold - 0.2);
        t += hold + 0.1;
      });

      // back out: windows fold away and the interior defocuses back into the exterior view
      tl.to(gsel("win"), { autoAlpha: 0, y: -20, duration: 0.45, ease: "power2.in" }, t);
      tl.to(`[data-cap^="${id}-"]`, { autoAlpha: 0, duration: 0.2 }, t);
      set({ ps: 0 }, t, 0.5);
      set({ [keys.dive]: 0 }, t + 0.2, 0.85, { ease: "power2.inOut" });
      return t + 1.05;
    };

    // ---- yacht A
    const aBack = chapter(YACHTS[0], 1.9, { dive: "dA", prog: "iaProg" });

    // ---- slide from A to B along the ring (its first frame is A's exterior view, so the swap is invisible)
    const slideAt = aBack + 0.1;
    set({ sOp: 1 }, slideAt, 0.06);
    set({ fOp: 0 }, slideAt + 0.1, 0.02);
    set({ sProg: 1 }, slideAt, 1.3, { ease: "power1.inOut" });

    // ---- yacht B
    const bBack = chapter(YACHTS[1], slideAt + 1.1, { dive: "dB", prog: "ibProg" });

    // ---- closing: B's view defocuses back into the ring loop, then the call to action
    set({ fin: 1 }, bBack + 0.1, 0.8, { ease: "power1.inOut" });
    set({ pb: 0 }, bBack + 0.1, 0.6);
    set({ hero: 1 }, bBack + 0.3, 0.4);
    tl.fromTo("[data-end]", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" }, bBack + 0.7);
    tl.to({}, { duration: Math.max(0, D - tl.duration()) });
    tl.eventCallback("onUpdate", () => render());

    // initial hidden states (content stays visible if JS never runs)
    gsap.set(["[data-title] > *", "[data-specs]", "[data-win]", "[data-end]", "[data-cap]", "[data-note]", "[data-ilabel]"], { autoAlpha: 0 });
    gsap.set("[data-layer]", { clipPath: "inset(100% 0 0 0)" });

    const st = ScrollTrigger.create({
      trigger: "[data-story]",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      animation: tl,
      onUpdate: (self) => {
        const t = self.progress * D;
        updateRank(t);
        let a = 0;
        CHAPTERS.forEach((c, i) => {
          if (t >= (i === 0 ? 0 : c.t - 0.5)) a = i;
        });
        setActive(a);
        bar.style.transform = `scaleX(${self.progress})`;
      },
    });

    jump.current = (unit: number) => {
      const px = (st.start ?? 0) + (unit / D) * ((st.end ?? 0) - (st.start ?? 0));
      lenis.scrollTo(px, { duration: 2.2 });
    };

    /* ---------- ring idle loop ---------- */
    ringVideo.muted = true;
    ringVideo.playbackRate = 0.8;
    if (!reduced) ringVideo.play().catch(() => {});

    /* ---------- memory: full-HD frames are large, so release clips that have scrolled out of view ---------- */
    const memory = setInterval(() => {
      const now = performance.now();
      Object.values(seqs).forEach((sq) => {
        if (sq.lastDrawAt && now - sq.lastDrawAt > 4000) sq.releaseBitmaps();
      });
    }, 3000);

    /* ---------- loading: open fast, then stream everything behind the scenes ---------- */
    let alive = true;
    const all = Object.values(seqs);
    setSequenceRank(["a_focus", "a_interior", "a_close", "ab_slide", "b_interior", "b_close"]);
    // tiny previews of EVERY clip first (~12 MB), then the full-HD frames nearest-first around the visitor
    all.forEach((sq) => sq.start());

    // the page opens as soon as the poster and the first preview frames are in (about a second)
    let posterReady = false;
    const poster = new Image();
    poster.onload = poster.onerror = () => {
      posterReady = true;
    };
    poster.src = "img/ring-poster.webp";

    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      setProgress(100);
      setTimeout(() => {
        if (!alive) return;
        setReady(true);
        lenis.start();
        render();
        // the big hero loop starts streaming only now, so it never slows down the opening
        ringVideo.src = "video/ring.mp4";
        ringVideo.load();
        if (!reduced) ringVideo.play().catch(() => {});
      }, 350);
    };
    const NEED = 8;
    const poll = setInterval(() => {
      if (!alive || opened) return;
      const f = Math.min(1, seqs.a_focus.loadedLite / NEED);
      setProgress(Math.min(99, Math.round((posterReady ? 25 : 0) + 75 * f)));
      if (posterReady && seqs.a_focus.loadedLite >= NEED) open();
    }, 80);
    // safety: never trap the visitor behind the loader
    const failsafe = setTimeout(open, 8000);

    // keep the shared download queue pointed at where the visitor is: nearest clip first, ahead before behind
    const RANGES: [SeqName, number, number][] = [
      ["a_focus", 0.25, 2.0],
      ["a_interior", 3.8, 6.9],
      ["a_close", 6.9, 9.3],
      ["ab_slide", 10.4, 11.7],
      ["b_interior", 13.4, 16.3],
      ["b_close", 16.4, 18.8],
    ];
    let rankKey = "";
    const updateRank = (t: number) => {
      const order = RANGES.map(([n, a0, b0]) => [n, t >= a0 && t <= b0 ? 0 : t < a0 ? (a0 - t) * 0.9 : (t - b0) * 1.2] as const)
        .sort((x, y) => x[1] - y[1])
        .map((x) => x[0]);
      const key = order.join();
      if (key !== rankKey) {
        rankKey = key;
        setSequenceRank(order);
      }
    };

    // browser cache: after the first visit every frame is stored locally, so later visits are instant and fully sharp
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    const onResize = () => {
      measure();
      ScrollTrigger.refresh();
      Object.values(seqs).forEach((sq) => sq.invalidate());
      requestRender();
    };
    window.addEventListener("resize", onResize);
    render();

    return () => {
      alive = false;
      clearTimeout(failsafe);
      clearTimeout(settleTimer);
      clearInterval(poll);
      clearInterval(memory);
      window.removeEventListener("resize", onResize);
      st.kill();
      tl.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
      Object.values(seqs).forEach((s) => s.dispose());
    };
  }, []);

  const goto = (t: number) => jump.current(t);

  return (
    <div ref={root}>
      <Loader progress={progress} done={ready} />

      {/* ---------- the stage: one fixed scene, layers cross-fade ---------- */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#06182a]" aria-hidden>
        {/* exterior layers: shifted together by the camera lift */}
        <div data-cam className="absolute inset-0 will-change-transform">
          <div data-ringwrap className="absolute inset-0">
            <video
              data-ringvideo
              className="h-full w-full object-cover"
              poster="img/ring-poster.webp"
              muted
              loop
              playsInline
              preload="none"
            />
          </div>
          <canvas data-cv="focus" className="absolute inset-0 h-full w-full opacity-0 will-change-transform" />
          <canvas data-cv="slide" className="absolute inset-0 h-full w-full opacity-0 will-change-transform" />
        </div>
        {/* interior films: full-bleed, outside the camera lift */}
        <canvas data-cv="int-a" className="absolute inset-0 h-full w-full opacity-0 will-change-transform" />
        <canvas data-cv="int-b" className="absolute inset-0 h-full w-full opacity-0 will-change-transform" />
        {/* legibility gradients */}
        <div data-shade="hero" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,16,30,.62)_0%,rgba(4,16,30,.2)_42%,transparent_70%),linear-gradient(0deg,rgba(4,16,30,.55)_0%,transparent_35%),linear-gradient(180deg,rgba(4,16,30,.6)_0%,transparent_20%)]" />
        <div data-shade="frame" className="pointer-events-none absolute inset-0 opacity-0 bg-[linear-gradient(180deg,rgba(4,16,30,.72)_0%,rgba(4,16,30,.3)_22%,transparent_38%),linear-gradient(0deg,rgba(4,16,30,.92)_0%,rgba(4,16,30,.62)_20%,transparent_44%)]" />
        <div data-shade="side" className="pointer-events-none absolute inset-0 opacity-0 bg-[linear-gradient(270deg,rgba(4,16,30,.94)_0%,rgba(4,16,30,.86)_36%,rgba(4,16,30,.5)_58%,transparent_80%)] max-md:bg-[linear-gradient(0deg,rgba(4,16,30,.95)_0%,rgba(4,16,30,.8)_36%,transparent_62%)]" />
        <div className="grain pointer-events-none absolute inset-0" />
      </div>

      <Nav active={active} onJump={goto} visible={ready} />

      {/* progress hairline + chapter dots */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-white/10">
        <div data-bar className="h-full origin-left bg-[#3fd8d2]" style={{ transform: "scaleX(0)" }} />
      </div>
      <ul className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-4 md:flex" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button onClick={() => goto(c.t + (c.id === "intro" ? 0 : 0.2))} aria-label={c.label} className="group flex items-center gap-3">
              <span className={`block h-2 w-2 rounded-full border border-white/70 transition-all ${active === i ? "scale-125 border-[#3fd8d2] bg-[#3fd8d2]" : "bg-transparent"}`} />
              <span className={`font-mono text-[10px] tracking-[0.3em] transition-opacity ${active === i ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`}>
                {c.label.toUpperCase()}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ---------- content overlay ---------- */}
      <div className="pointer-events-none fixed inset-0 z-30">
        {/* hero */}
        <div data-hero className="absolute left-5 top-[19vh] max-w-[90vw] sm:left-10 md:left-[6vw] md:top-[22vh]">
          <p className="mb-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.4em] text-white/80 sm:text-[11px]">
            <span className="h-px w-8 bg-[#3fd8d2]" /> {BRAND.name} — {BRAND.tag.toUpperCase()}
          </p>
          <h1 className="font-serif text-[16vw] font-medium leading-[0.9] tracking-[-0.02em] sm:text-[9vw] md:text-[7vw]">
            {BRAND.headline[0]}
            <br />
            <em className="font-normal italic text-[#9fe9e4]">{BRAND.headline[1]}</em>
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/80">{BRAND.intro}</p>
        </div>
        <div data-hero className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
          <span className="font-mono text-[10px] tracking-[0.4em] text-white/70">SCROLL</span>
          <ArrowDown size={16} className="mx-auto mt-2 animate-bounce text-[#3fd8d2]" />
        </div>

        {YACHTS.map((y) => (
          <YachtLayer key={y.id} y={y} count={YACHTS.length} />
        ))}

        {/* closing */}
        <div data-end className="pointer-events-auto absolute left-5 top-[20vh] max-w-[90vw] sm:left-10 md:left-[6vw]">
          <p className="mb-4 font-mono text-[10px] tracking-[0.4em] text-[#3fd8d2]">YOUR MOVE</p>
          <h2 className="font-serif text-[13vw] leading-[0.92] sm:text-[8vw] md:text-[6vw]">
            One bay.
            <br />
            <em className="italic text-[#9fe9e4]">Your fleet.</em>
          </h2>
          <button onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })} className="btn mt-8">
            Plan your charter
          </button>
        </div>
      </div>

      {/* scroll distance for the whole story */}
      <div data-story style={{ height: `${(D * UNIT + 1) * 100}vh` }} />

      <Footer />
    </div>
  );
}

/** Title, spec strip, interior captions and detail windows for one yacht. Animated by the timeline in Story. */
function YachtLayer({ y, count }: { y: Yacht; count: number }) {
  return (
    <>
      {/* title: top-left, over the island, so the yachts below stay clear */}
      <div data-title={y.id} className="absolute left-5 top-[11vh] max-w-[88vw] sm:left-10 md:left-[6vw] md:top-[12vh]">
        <p className="font-mono text-[10px] tracking-[0.4em] text-[#3fd8d2] sm:text-[11px]">
          {y.index} / {String(count).padStart(2, "0")} — {y.type.toUpperCase()}
        </p>
        <h2 className="mt-2 font-serif text-[14vw] font-medium leading-[0.88] tracking-[-0.02em] sm:text-[9vw] md:text-[5.6vw]">{y.name}</h2>
        <p className="mt-2 font-serif text-lg italic text-white/85 sm:text-xl">{y.tagline}</p>
      </div>

      {/* spec strip: along the bottom */}
      <div data-specs={y.id} className="absolute inset-x-5 bottom-[4.5vh] sm:inset-x-10 md:inset-x-[6vw] md:bottom-[6vh]">
        <div className="grid items-end gap-6 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-10">
          <p data-s className="hidden text-[15px] leading-relaxed text-white/85 md:block">
            {y.description}
          </p>
          <div>
            <dl className="grid grid-cols-3 gap-x-5 gap-y-4 border-t border-white/25 pt-4 md:grid-cols-6 md:gap-x-6">
              {y.specs.map((s) => (
                <div key={s.label} data-s>
                  <dt className="font-mono text-[9px] tracking-[0.3em] text-white/60 md:text-[10px]">{s.label.toUpperCase()}</dt>
                  <dd className="mt-1 font-serif text-2xl md:text-[1.9rem]">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p data-s className="mt-4 font-mono text-[10px] tracking-[0.3em] text-[#9fe9e4] md:text-[11px]">
              {y.price.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* interior captions */}
      <div data-ilabel={y.id} className="absolute left-5 top-[11vh] sm:left-10 md:left-[6vw] md:top-[12vh]">
        <p className="font-mono text-[10px] tracking-[0.4em] text-[#3fd8d2] sm:text-[11px]">
          {y.name} — {y.interiorLabel.toUpperCase()}
        </p>
      </div>
      <div className="absolute inset-x-5 bottom-[7vh] sm:inset-x-10 md:inset-x-[6vw] md:bottom-[9vh]">
        <div className="relative h-24">
          {y.interiorNotes.map((n, i) => (
            <p key={n} data-note={`${y.id}-${i}`} className="absolute bottom-0 left-0 max-w-[90vw] font-serif text-[9vw] italic leading-none sm:text-5xl md:text-6xl">
              <span className="mb-3 block font-mono text-[10px] not-italic tracking-[0.4em] text-[#3fd8d2]">0{i + 1} / 0{y.interiorNotes.length}</span>
              {n}
            </p>
          ))}
        </div>
      </div>

      {/* detail windows (right on desktop, lower half on mobile) */}
      <div className="absolute inset-x-5 bottom-[6vh] top-[44vh] sm:inset-x-10 md:bottom-[14vh] md:left-auto md:right-[5vw] md:top-[16vh] md:w-[42vw] md:max-w-[640px]">
        <div data-win={y.id} className="absolute inset-0 flex flex-col">
          <div className="relative min-h-0 flex-1">
            {y.windows.map((w, i) => (
              <div
                key={i}
                data-layer={`${y.id}-${i}`}
                className="absolute inset-0 overflow-hidden rounded-[3px] border border-white/15 bg-[#06182a] shadow-[0_30px_80px_rgba(0,0,0,.45)]"
                style={{ zIndex: i + 1 }}
              >
                <div data-media className="absolute inset-0 will-change-transform">
                  {w.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.src} alt={w.alt} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.poster} alt={w.alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      <canvas data-wcv={w.seq} className="absolute inset-0 h-full w-full" role="img" aria-label={w.alt} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="relative mt-4 h-9 shrink-0">
            {y.windows.map((w, i) => (
              <p key={i} data-cap={`${y.id}-${i}`} className="absolute inset-x-0 flex items-baseline justify-between font-mono text-[10px] tracking-[0.3em] text-white/80">
                <span>{w.caption.toUpperCase()}</span>
                <span className="text-white/45">
                  {String(i + 1).padStart(2, "0")} / {String(y.windows.length).padStart(2, "0")}
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
