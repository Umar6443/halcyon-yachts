import { useSyncExternalStore } from "react";

/**
 * Loading state shared between the film (which does the loading) and the loader / nav (which show it).
 * A tiny external store, so progress ticks re-render only the loader, never the whole page.
 */
type State = { progress: number; ready: boolean; note: string };
let state: State = { progress: 0, ready: false, note: "" };
const subs = new Set<() => void>();

export const loadState = {
  set(patch: Partial<State>) {
    const next = { ...state, ...patch };
    if (next.progress === state.progress && next.ready === state.ready && next.note === state.note) return;
    state = next;
    subs.forEach((fn) => fn());
  },
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};

const initial: State = { progress: 0, ready: false, note: "" };
export function useLoadState() {
  return useSyncExternalStore(loadState.subscribe, loadState.get, () => initial);
}
