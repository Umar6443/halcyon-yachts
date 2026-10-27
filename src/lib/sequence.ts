/**
 * Scroll-scrubbed WebP frame sequence.
 *
 * - compressed frames are fetched in order (a few at a time) and kept as blobs,
 * - only a small window of frames around the playhead is decoded to bitmaps
 *   (full-HD bitmaps are ~8 MB each, so the window is kept tight),
 * - frames are NOT evenly spaced: the build keeps many frames where the camera
 *   moves fast and few where the shot is nearly still (manifest.ts = each frame's
 *   position 0..1 in the original clip), so blending two neighbours never smears,
 * - draw(canvas, t) cover-fits the frame at position t and cross-blends the two
 *   neighbours; once scrolling settles, draw(..., settle) snaps to a single
 *   pristine frame instead of leaving a half-blend on screen.
 */

type Bitmap = ImageBitmap | HTMLImageElement;

type Manifest = { count: number; pattern: string; w: number; h: number; fps: number; ts?: number[] };

/** frames decoded on each side of the playhead, plus a few more in the direction of travel */
const WINDOW_SIDE = 6;
const WINDOW_EXTRA = 5;
const WINDOW_KEEP = 12;
/** decodes running at once: enough to keep up, few enough not to starve the main thread */
const DECODE_PARALLEL = 3;

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

export class Sequence {
  count = 0;
  w = 16;
  h = 9;
  loaded = 0;
  /** performance.now() of the last draw, used to free memory of sequences that are no longer on screen */
  lastDrawAt = 0;
  private blobs: (Blob | null)[] = [];
  private bitmaps = new Map<number, { bmp: Bitmap; url?: string }>();
  private decoding = new Set<number>();
  /** frames we would like decoded, nearest to the playhead first */
  private want: number[] = [];
  /** the (one or two) frames the current picture is made of */
  private needed = new Set<number>();
  private lastKey = "";
  private manifest: Manifest | null = null;
  private started = false;
  private waiters: { n: number; resolve: () => void }[] = [];
  lastT = 0;

  constructor(private name: string) {}

  /** Start fetching frames. Safe to call more than once. */
  start(concurrency = 4) {
    if (this.started) return;
    this.started = true;
    (async () => {
      try {
        const m: Manifest = await fetch(`frames/${this.name}/manifest.json`).then((r) => r.json());
        this.manifest = m;
        this.count = m.count;
        this.w = m.w;
        this.h = m.h;
        this.blobs = new Array(m.count).fill(null);
        let next = 0;
        const worker = async () => {
          while (next < m.count) {
            const i = next++;
            const url = m.pattern.replace("%03d", String(i + 1).padStart(3, "0"));
            try {
              const b = await fetch(url).then((r) => r.blob());
              this.blobs[i] = b;
              this.loaded += 1;
              if (i < 3) {
                this.want.push(i);
                this.pump();
              }
            } catch {
              /* a missing frame is covered by the nearest decoded one */
            }
            this.flushWaiters();
          }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));
      } catch {
        /* sequence stays empty; callers check .ready */
      }
    })();
  }

  get ready() {
    return this.count > 0 && this.bitmaps.size > 0;
  }

  /** resolves once the first n frames have been fetched */
  whenLoaded(n: number) {
    if (this.loaded >= n) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiters.push({ n, resolve }));
  }

  private flushWaiters() {
    this.waiters = this.waiters.filter((w) => {
      if (this.loaded >= w.n) {
        w.resolve();
        return false;
      }
      return true;
    });
  }

  /** start decodes (nearest first) until DECODE_PARALLEL are running */
  private pump() {
    while (this.decoding.size < DECODE_PARALLEL) {
      const i = this.want.find((k) => k >= 0 && k < this.count && !this.bitmaps.has(k) && !this.decoding.has(k) && this.blobs[k]);
      if (i === undefined) return;
      this.decoding.add(i);
      decode(this.blobs[i]!)
        .then((d) => {
          this.bitmaps.set(i, d);
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
    // a small symmetric window around the playhead (nearest first), plus a few extra frames in the direction of travel
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

  /** resolves once a fraction (0..1) of the compressed frames has been fetched */
  async whenFraction(f: number) {
    while (!(this.count > 0 && this.loaded >= Math.ceil(this.count * f))) await new Promise((r) => setTimeout(r, 80));
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

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.min(2200, Math.round(canvas.clientWidth * dpr));
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
      const s = Math.max(cw / sw, ch / sh);
      const dw = sw * s;
      const dh = sh * s;
      const dx = (cw - dw) * fx;
      const dy = (ch - dh) * fy;
      return [dx, dy, dw, dh] as const;
    };

    ctx.globalAlpha = 1;
    ctx.drawImage(f0, ...place(f0));
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
    if (complete && this.bitmaps.has(first)) this.lastKey = key;
  }

  dispose() {
    this.want = [];
    this.releaseBitmaps();
    this.bitmaps.clear();
  }
}
