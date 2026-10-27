/**
 * Scroll-scrubbed WebP frame sequence with progressive quality.
 *
 * Every clip exists in two tiers: the full-HD frames and a tiny "lite" preview of each frame.
 *  - The site preloads ALL full-HD frames before it opens (see Story), so everything is sharp from the start.
 *  - Lite previews are only an emergency fallback: if the visitor's connection is too slow and the site opens
 *    before the HD frames are in, enableLite() fetches them so no clip is ever an empty layer; each HD frame
 *    replaces its preview as soon as it arrives.
 *
 * Frames are NOT evenly spaced: the build keeps many frames where the camera moves fast and few where
 * the shot is nearly still (manifest.ts = each frame's position 0..1 in the original clip).
 * Only a small window of frames around the playhead is decoded to bitmaps (full-HD bitmaps are ~8 MB each).
 * draw(canvas, t) cover-fits the frame at position t and cross-blends the two neighbours; once scrolling
 * settles, draw(..., settle) snaps to a single pristine frame.
 */

type Bitmap = ImageBitmap | HTMLImageElement;

type Manifest = { count: number; pattern: string; lite?: string; w: number; h: number; fps: number; ts?: number[]; sizes?: number[] };

const WINDOW_SIDE = 6;
const WINDOW_EXTRA = 5;
const WINDOW_KEEP = 12;
const DECODE_PARALLEL = 3;
/** downloads running at once, across ALL clips */
const FETCH_PARALLEL = 16;

/* ---------- one shared download scheduler: lowest priority number goes first ---------- */

type Job = { prio: () => number; run: () => Promise<void> };
const jobs: Job[] = [];
let activeFetches = 0;

function pumpFetches() {
  while (activeFetches < FETCH_PARALLEL && jobs.length) {
    let best = 0;
    let bestP = Infinity;
    for (let i = 0; i < jobs.length; i++) {
      const p = jobs[i].prio();
      if (p < bestP) {
        bestP = p;
        best = i;
      }
    }
    const [job] = jobs.splice(best, 1);
    activeFetches++;
    job
      .run()
      .catch(() => {})
      .finally(() => {
        activeFetches--;
        pumpFetches();
      });
  }
}

/** queue any download; `prio` is re-read every time a slot frees up, so priorities can change live */
export function scheduleFetch(prio: () => number, run: () => Promise<void>) {
  jobs.push({ prio, run });
  pumpFetches();
}

/** 0 = the clip the visitor is at (or heading to next), 1 = the one after it, ... */
const rank: Record<string, number> = {};
export function setSequenceRank(order: string[]) {
  order.forEach((name, i) => (rank[name] = i));
}

async function decode(blob: Blob): Promise<{ bmp: Bitmap; url?: string }> {
  try {
    return { bmp: await createImageBitmap(blob) };
  } catch {
    // createImageBitmap fails in some hidden-tab / webview cases; <img> always works
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("decode failed"));
      img.src = url;
    });
    return { bmp: img, url };
  }
}

type Decoded = { bmp: Bitmap; url?: string; hd: boolean };

export class Sequence {
  count = 0;
  w = 16;
  h = 9;
  /** preview frames fetched / full-HD frames fetched */
  loadedLite = 0;
  loadedHd = 0;
  /** full-HD bytes fetched so far / in total (total is known once the manifest has loaded) */
  bytesLoaded = 0;
  bytesTotal = 0;
  private liteScheduled = false;
  /** performance.now() of the last draw, used to free memory of sequences that are no longer on screen */
  lastDrawAt = 0;
  /** true once at least one frame has been painted into a canvas (so the layer is no longer empty) */
  hasPicture = false;
  private lite: (Blob | null)[] = [];
  private hd: (Blob | null)[] = [];
  private bitmaps = new Map<number, Decoded>();
  private decoding = new Set<number>();
  /** frames we would like decoded, nearest to the playhead first */
  private want: number[] = [];
  /** the (one or two) frames the current picture is made of */
  private needed = new Set<number>();
  private lastKey = "";
  private manifest: Manifest | null = null;
  private started = false;
  private center = 0;
  lastT = 0;

  constructor(private name: string) {}

  /** Fetch the manifest, then queue every full-HD frame with the shared scheduler. */
  start() {
    if (this.started) return;
    this.started = true;
    (async () => {
      try {
        const m: Manifest = await fetch(`frames/${this.name}/manifest.json`).then((r) => r.json());
        this.manifest = m;
        this.count = m.count;
        this.w = m.w;
        this.h = m.h;
        this.lite = new Array(m.count).fill(null);
        this.hd = new Array(m.count).fill(null);
        this.bytesTotal = m.sizes ? m.sizes.reduce((n, b) => n + b, 0) : m.count * 300000;
        const url = (pattern: string, i: number) => pattern.replace("%03d", String(i + 1).padStart(3, "0"));
        // full HD: the clip nearest the visitor first, nearest frames first
        for (let i = 0; i < m.count; i++) {
          scheduleFetch(
            () => 10 + (rank[this.name] ?? 9) * 100 + Math.abs(i - this.center) / 1000,
            async () => {
              const blob = await fetch(url(m.pattern, i)).then((r) => r.blob());
              this.hd[i] = blob;
              this.loadedHd += 1;
              this.bytesLoaded += blob.size;
              this.afterArrival(i);
            },
          );
        }
      } catch {
        /* sequence stays empty; callers check .count */
      }
    })();
  }

  /** emergency fallback: fetch the tiny preview frames too (used only if the site had to open before the HD frames were in) */
  enableLite() {
    const m = this.manifest;
    if (this.liteScheduled || !m || !m.lite) return;
    this.liteScheduled = true;
    const url = (i: number) => m.lite!.replace("%03d", String(i + 1).padStart(3, "0"));
    for (let i = 0; i < m.count; i++) {
      scheduleFetch(
        () => 0 + (rank[this.name] ?? 9) * 0.01 + i * 1e-5,
        async () => {
          this.lite[i] = await fetch(url(i)).then((r) => r.blob());
          this.loadedLite += 1;
          this.afterArrival(i);
        },
      );
    }
  }

  /** a frame just arrived: if it is near the playhead, decode it now (and let a preview be upgraded) */
  private afterArrival(i: number) {
    if (Math.abs(i - this.center) <= WINDOW_SIDE + WINDOW_EXTRA) {
      if (!this.want.includes(i)) this.want.push(i);
      this.pump();
    }
  }

  /** resolves once the first n preview frames have been fetched */
  async whenLiteLoaded(n: number) {
    while (!(this.count > 0 && this.loadedLite >= Math.min(n, this.count))) await new Promise((r) => setTimeout(r, 60));
  }

  /** how much of this clip's full-HD frames have arrived, 0..1 */
  get hdFraction() {
    return this.count ? this.loadedHd / this.count : 0;
  }

  /** a frame is worth decoding if it has no picture yet, or only a preview while its HD frame has arrived */
  private needsDecode(k: number) {
    if (k < 0 || k >= this.count || this.decoding.has(k)) return false;
    const have = this.bitmaps.get(k);
    if (!have) return !!(this.hd[k] || this.lite[k]);
    return !have.hd && !!this.hd[k];
  }

  /** start decodes (nearest first) until DECODE_PARALLEL are running */
  private pump() {
    while (this.decoding.size < DECODE_PARALLEL) {
      const i = this.want.find((k) => this.needsDecode(k));
      if (i === undefined) return;
      const useHd = !!this.hd[i];
      const blob = (useHd ? this.hd[i] : this.lite[i])!;
      this.decoding.add(i);
      decode(blob)
        .then((d) => {
          const old = this.bitmaps.get(i);
          this.bitmaps.set(i, { ...d, hd: useHd });
          if (old) {
            if (old.bmp instanceof ImageBitmap) old.bmp.close();
            if (old.url) URL.revokeObjectURL(old.url);
          }
          if (this.needed.has(i)) {
            this.lastKey = ""; // the picture on screen can now be made of a better frame
            this.onDecoded?.();
          }
        })
        .catch(() => {})
        .finally(() => {
          this.decoding.delete(i);
          this.pump();
        });
    }
  }

  /** forget what was last drawn, so the next draw() repaints (after a resize, for example) */
  invalidate() {
    this.lastKey = "";
  }

  /** called whenever a new frame finishes decoding (so the caller can redraw) */
  onDecoded?: () => void;

  private closeBitmap(idx: number) {
    const d = this.bitmaps.get(idx);
    if (!d) return;
    if (d.bmp instanceof ImageBitmap) d.bmp.close();
    if (d.url) URL.revokeObjectURL(d.url);
    this.bitmaps.delete(idx);
  }

  private manageWindow(center: number, dir: number) {
    this.center = center;
    const want: number[] = [];
    for (let d = 0; d <= WINDOW_SIDE; d++) {
      want.push(center + d);
      if (d > 0) want.push(center - d);
    }
    for (let d = WINDOW_SIDE + 1; d <= WINDOW_SIDE + WINDOW_EXTRA; d++) want.push(center + (dir >= 0 ? d : -d));
    this.want = want;
    this.pump();
    if (this.bitmaps.size > WINDOW_KEEP * 2 + 1) {
      for (const idx of Array.from(this.bitmaps.keys())) {
        if (Math.abs(idx - center) > WINDOW_KEEP) this.closeBitmap(idx);
      }
    }
  }

  /** free every decoded frame (compressed frames stay); decoding restarts on the next draw */
  releaseBitmaps() {
    for (const idx of Array.from(this.bitmaps.keys())) this.closeBitmap(idx);
  }

  private nearest(i: number): Bitmap | null {
    const hit = this.bitmaps.get(i);
    if (hit) return hit.bmp;
    for (let d = 1; d < this.count; d++) {
      const a = this.bitmaps.get(i - d);
      if (a) return a.bmp;
      const b = this.bitmaps.get(i + d);
      if (b) return b.bmp;
    }
    return null;
  }

  /** position t (0..1 of the original clip) -> the two neighbouring frames and the blend between them */
  private locate(t: number) {
    const p = Math.min(1, Math.max(0, t));
    const ts = this.manifest?.ts;
    if (!ts || ts.length !== this.count) {
      const pos = p * (this.count - 1);
      const i0 = Math.floor(pos);
      return { i0, i1: Math.min(this.count - 1, i0 + 1), a: pos - i0 };
    }
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= p) lo = mid;
      else hi = mid;
    }
    const span = ts[hi] - ts[lo];
    return { i0: lo, i1: hi, a: span > 0 ? Math.min(1, Math.max(0, (p - ts[lo]) / span)) : 0 };
  }

  /**
   * Draw the frame at position t (0..1) into the canvas, cover-fit.
   * fx/fy pick which part of the frame stays visible when the viewport crops it.
   * settle = true draws one single frame (the nearest) instead of a blend.
   */
  draw(canvas: HTMLCanvasElement | null, t: number, fx = 0.5, fy = 0.5, settle = false) {
    if (!canvas || this.count === 0) return;
    this.lastDrawAt = performance.now();
    const dir = t >= this.lastT ? 1 : -1;
    this.lastT = t;
    const loc = this.locate(t);
    const i0 = loc.i0;
    const i1 = loc.i1;
    let a = loc.a;
    if (settle) a = a < 0.5 ? 0 : 1;
    this.manageWindow(a < 0.5 ? i0 : i1, dir);
    const first = a >= 1 ? i1 : i0;
    this.needed = new Set(a > 0.02 && a < 1 && i1 !== i0 ? [first, i1] : [first]);
    const f0 = this.nearest(first);
    if (!f0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(2880, Math.round(canvas.clientWidth * dpr));
    const ch = Math.round(cw * (canvas.clientHeight / Math.max(1, canvas.clientWidth)));
    // nothing changed since the last paint (same frames, blend, crop, size): don't repaint
    const key = `${first}|${i1}|${a.toFixed(3)}|${fx.toFixed(3)}|${fy}|${cw}x${ch}|${settle ? 1 : 0}`;
    if (key === this.lastKey) return;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // best scaler when the picture is at rest (what the visitor looks at); a cheaper one while it is moving
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = settle ? "high" : "medium";

    const place = (src: Bitmap) => {
      const sw = (src as HTMLImageElement).width;
      const sh = (src as HTMLImageElement).height;
      // previews are smaller than the HD frames: always scale by the clip's real frame size
      const s = Math.max(cw / this.w, ch / this.h) * (this.w / sw);
      const dw = sw * s;
      const dh = sh * s;
      const dx = (cw - dw) * fx;
      const dy = (ch - dh) * fy;
      return [dx, dy, dw, dh] as const;
    };

    ctx.globalAlpha = 1;
    ctx.drawImage(f0, ...place(f0));
    this.hasPicture = true;
    let complete = true;
    if (a > 0.02 && a < 1 && i1 !== i0) {
      const f1 = this.bitmaps.get(i1)?.bmp;
      if (f1) {
        ctx.globalAlpha = a;
        ctx.drawImage(f1, ...place(f1));
        ctx.globalAlpha = 1;
      } else {
        complete = false; // repaint when the second frame has decoded
      }
    }
    // only remember this paint once it is made of the best frames available (otherwise repaint when they arrive)
    const have = this.bitmaps.get(first);
    if (complete && have && (have.hd || !this.hd[first])) this.lastKey = key;
  }

  dispose() {
    this.want = [];
    this.releaseBitmaps();
    this.bitmaps.clear();
  }
}
