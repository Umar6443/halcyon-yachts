import { Sequence } from "./sequence";
import type { YachtId } from "@/data/site";

/**
 * Every frame sequence of the site, and who gets the bandwidth.
 * Lanes: 0 = what the visitor is looking at; 500 = a yacht they are hovering; 1500 = the hero when it is off screen;
 * 2000+ = the yacht loops in the background (level 0 of all four before level 1 of any).
 */
export const YACHT_ORDER: YachtId[] = ["meme", "nft", "exchange", "media"];

let hero: Sequence | null = null;
export function heroSeq() {
  return (hero ??= new Sequence("hero"));
}

const loops = new Map<YachtId, Sequence>();
export function yachtSeq(id: YachtId) {
  let s = loops.get(id);
  if (!s) {
    s = new Sequence(id, true);
    loops.set(id, s);
  }
  return s;
}

let heroVisible = true;
let viewing: YachtId | null = null;
let hinted: YachtId | null = null;
let background = false;

function lanes() {
  const h = heroSeq();
  h.setLane(viewing ? 1500 : heroVisible ? 0 : 1500);
  YACHT_ORDER.forEach((id, i) => {
    const s = yachtSeq(id);
    s.setLane(viewing === id ? 0 : hinted === id ? 500 : 2000 + i * 10);
  });
}

export function setHeroVisible(v: boolean) {
  heroVisible = v;
  lanes();
}

/** after the hero is in, fetch the yacht loops quietly */
export function startBackgroundLoad() {
  if (background) return;
  background = true;
  lanes();
  YACHT_ORDER.forEach((id) => yachtSeq(id).start());
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
