"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { destroyScroll, initScroll, stopScroll } from "@/lib/scroll";
import { closeYacht, openYacht, useOpenYacht } from "@/lib/viewer";
import Loader from "./Loader";
import Nav from "./Nav";

/** the viewer (rotator, rooms, booking) is its own chunk: fetched when a visitor points at or opens a yacht */
const YachtViewer = dynamic(() => import("./YachtViewer"), { ssr: false });

/** The client shell around the server-rendered page: smooth scroll, reveals, the loader, the nav and the viewer. */
export default function App({ children }: { children: React.ReactNode }) {
  const open = useOpenYacht();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    initScroll(reduced);
    stopScroll(); // the page stays still for the moment the first pass of the film loads (the film starts it)
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
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    document.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Loader />
      <Nav />
      {children}
      {open && <YachtViewer id={open} onClose={closeYacht} onSwitch={openYacht} />}
    </>
  );
}
