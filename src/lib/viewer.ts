import { useSyncExternalStore } from "react";
import type { YachtId } from "@/data/site";
import { hintYacht } from "./seqs";

/**
 * Which yacht (if any) is open in the full-screen viewer. A tiny external store, so any button anywhere on the page
 * (including the server-rendered sections, through the small <OpenYacht> island) can open it without the whole page
 * being one client component.
 */
let open: YachtId | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export function openYacht(id: YachtId) {
  hintYacht(id);
  open = id;
  emit();
}
export function closeYacht() {
  open = null;
  emit();
}
function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
export function useOpenYacht() {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );
}

/** the viewer's code (rotator, booking...) is fetched the first time a visitor shows interest */
let prefetched = false;
export function prefetchViewer() {
  if (prefetched) return;
  prefetched = true;
  import("@/components/YachtViewer").catch(() => {
    prefetched = false;
  });
}
