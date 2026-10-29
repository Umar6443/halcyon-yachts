import { Sequence } from "./sequence";
import type { YachtId } from "@/data/site";

/**
 * Every frame sequence of the site, and who gets the bandwidth.
 * Lanes: 0 = what the visitor is looking at; 500 = a yacht they are hovering (its coarse pass only);
 * 1500 = the hero when it is off screen. Yacht loops are never fetched until a visitor shows interest in one.
 */
export const YACHT_ORDER: YachtId[] = ["meme", "nft", "exchange", "media"];

let hero: Sequence | null = null;
/** phones and portrait screens get the portrait crop of the film (the only part of it they can show) */
export function heroVariant() {
  return typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.05 ? "hero-p" : "hero";
}
export function heroSeq() {
  const name = heroVariant();
  if (!hero || hero.name !== name) {
    hero?.dispose();
    hero = new Sequence(name);
  }
  return hero;
}

const loops = new Map<YachtId, Sequence>();
/** small screens get the 1024 px loops */
const small = () => typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
export function yachtSeq(id: YachtId) {
  let s = loops.get(id);
  if (!s) {
    s = new Sequence(small() ? `${id}-s` : id, true);
    loops.set(id, s);
  }
  return s;
}

let heroVisible = true;
let viewing: YachtId | null = null;
let hinted: YachtId | null = null;

function lanes() {
  const h = heroSeq();
  h.setLane(viewing ? 1500 : heroVisible ? 0 : 1500);
  YACHT_ORDER.forEach((id, i) => {
    const s = yachtSeq(id);
    s.setLane(viewing === id ? 0 : hinted === id ? 500 : 2000 + i * 10);
    // only the open yacht loads in full; a hovered one fetches its coarse pass so it opens instantly
    s.setMaxLevel(viewing === id ? 3 : 0);
  });
}

export function setHeroVisible(v: boolean) {
  heroVisible = v;
  lanes();
}

/** the visitor points at a yacht: its frames go ahead of the other background ones */
export function hintYacht(id: YachtId) {
  hinted = id;
  yachtSeq(id).start();
  lanes();
}

/** a yacht is open full screen: everything goes to it */
export function viewYacht(id: YachtId | null) {
  viewing = id;
  if (id) yachtSeq(id).start();
  lanes();
}
