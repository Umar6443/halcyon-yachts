import Lenis from "lenis";

/**
 * One smooth-scroll instance for the whole page (touch devices keep their native, already-smooth scrolling).
 * Lenis is driven by a single requestAnimationFrame loop; nothing else smooths the scroll, so the picture
 * follows the visitor's input directly with no stacked easing.
 */
let lenis: Lenis | null = null;
let raf = 0;
const listeners = new Set<(y: number) => void>();

export function initScroll(reduced: boolean) {
  if (lenis) return lenis;
  lenis = new Lenis({ lerp: reduced ? 1 : 0.11, smoothWheel: !reduced, wheelMultiplier: 1, touchMultiplier: 1.4 });
  lenis.on("scroll", (l: Lenis) => listeners.forEach((fn) => fn(l.scroll)));
  const tick = (t: number) => {
    lenis?.raf(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return lenis;
}

export function destroyScroll() {
  cancelAnimationFrame(raf);
  lenis?.destroy();
  lenis = null;
  listeners.clear();
}

export function onScroll(fn: (y: number) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function scrollY() {
  return lenis ? lenis.scroll : window.scrollY;
}

export function stopScroll() {
  lenis?.stop();
}
export function startScroll() {
  lenis?.start();
}

export function scrollToTarget(target: string | number, duration = 1.8) {
  if (lenis) lenis.scrollTo(target, { duration, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
  else document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
}
