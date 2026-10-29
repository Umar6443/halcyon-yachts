"use client";

import { useCallback, useEffect, useState } from "react";
import type { YachtId } from "@/data/site";
import { destroyScroll, initScroll, startScroll, stopScroll } from "@/lib/scroll";
import { startBackgroundLoad } from "@/lib/seqs";
import Loader from "./Loader";
import Nav from "./Nav";
import Hero from "./Hero";
import YachtViewer from "./YachtViewer";
import { About, Contact, Events, Fleet } from "./Sections";

export default function App() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<YachtId | null>(null);
  const [, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    initScroll(reduced);
    stopScroll(); // the page stays still until the film has loaded
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // media cache: after the first visit every frame comes from the browser, so later visits open instantly
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    return destroyScroll;
  }, []);

  // reveal-on-scroll for everything marked data-reveal (transform + opacity only)
  useEffect(() => {
    document.body.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const onReady = useCallback(() => {
    setReady(true);
    startScroll();
    // the yacht loops come in quietly once the film is in
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (idle) idle(startBackgroundLoad);
    else setTimeout(startBackgroundLoad, 800);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <Loader progress={progress} done={ready} />
      <Nav visible={ready} />
      <main>
        <Hero onProgress={setProgress} onReady={onReady} onOpenYacht={setOpen} onActive={setActive} />
        <Fleet onOpen={setOpen} />
        <Events onOpen={setOpen} />
        <About />
      </main>
      <Contact />
      {open && <YachtViewer id={open} onClose={close} onSwitch={setOpen} />}
    </>
  );
}
