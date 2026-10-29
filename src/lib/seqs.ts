import { Sequence, setSequenceRank } from "./sequence";
import type { YachtId } from "@/data/site";

/** The 360 degree loop of each yacht: created once, loaded on demand (or in the background after the hero) */
const loops = new Map<YachtId, Sequence>();
export const YACHT_ORDER: YachtId[] = ["meme", "nft", "exchange", "media"];

export function yachtSeq(id: YachtId) {
  let s = loops.get(id);
  if (!s) {
    s = new Sequence(id, true);
    loops.set(id, s);
  }
  return s;
}

let backgroundStarted = false;
/** after the hero is in, fetch the yacht loops quietly, one yacht at a time */
export function startBackgroundLoad() {
  if (backgroundStarted) return;
  backgroundStarted = true;
  setSequenceRank(["hero", ...YACHT_ORDER]);
  YACHT_ORDER.forEach((id) => yachtSeq(id).start());
}

/** the visitor is looking at (or about to open) this yacht: its frames jump the queue */
export function prioritiseYacht(id: YachtId) {
  const s = yachtSeq(id);
  s.start();
  setSequenceRank([id, "hero", ...YACHT_ORDER.filter((y) => y !== id)]);
}
