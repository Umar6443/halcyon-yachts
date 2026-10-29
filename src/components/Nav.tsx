"use client";

import { useEffect, useRef } from "react";
import { BRAND } from "@/data/site";
import { onScroll, scrollToTarget } from "@/lib/scroll";

const LINKS = [
  { label: "Fleet", href: "#fleet" },
  { label: "Events", href: "#events" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Nav({ visible }: { visible: boolean }) {
  const bar = useRef<HTMLElement>(null);

  // a solid bar once the page has left the top (plain background, no blur over the moving film)
  useEffect(() => {
    let solid = false;
    return onScroll((y) => {
      const s = y > 60;
      if (s !== solid) {
        solid = s;
        if (bar.current) bar.current.dataset.solid = String(s);
      }
    });
  }, []);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToTarget(href);
  };

  return (
    <header
      ref={bar}
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 transition-[opacity,transform,background-color] duration-700 data-[solid=true]:bg-[#050b16]/90 data-[solid=true]:shadow-[0_1px_0_rgba(255,255,255,.08)] sm:px-10 sm:py-5 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <a href="#top" onClick={go("#top")} className="flex items-baseline gap-3" aria-label={`${BRAND.name} — back to top`}>
        <span className="font-serif text-xl tracking-[0.3em] sm:text-2xl sm:tracking-[0.35em]">{BRAND.name}</span>
        <span className="hidden font-mono text-[9px] tracking-[0.4em] text-white/60 lg:inline">{BRAND.tag.toUpperCase()}</span>
      </a>
      <nav className="flex items-center gap-7" aria-label="Primary">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            onClick={go(l.href)}
            className="hidden font-mono text-[11px] tracking-[0.3em] text-white/75 transition-colors hover:text-white md:block"
          >
            {l.label.toUpperCase()}
          </a>
        ))}
        <a href="#fleet" onClick={go("#fleet")} className="btn !px-5 !py-3">
          <span className="sm:hidden">Book</span>
          <span className="hidden sm:inline">Book a yacht</span>
        </a>
      </nav>
    </header>
  );
}
