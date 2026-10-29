/**
 * Frame sequences drawn on a canvas: the engine behind the scroll-scrubbed hero film and the drag-to-rotate
 * 360 degree yacht viewer.
 *
 * LOADING IS PROGRESSIVE. Every frame is a full-quality WebP, but they are not all needed at once:
 *   level 0 = every 8th frame, level 1 = every 4th, level 2 = every 2nd, level 3 = the rest.
 * The scheduler downloads level 0 of the whole sequence first (a few MB: enough to scrub or rotate anywhere),
 * then refines, nearest-the-playhead first. Until a frame has arrived the nearest one that has is shown, so
 * the picture is always sharp (never a low-resolution preview), only sparser; it fills in within seconds.
 *
 * Downloads are robust: every request has a timeout and is retried with back-off, a permanently failed frame is
 * skipped (the neighbours cover it) and never blocks anything. One shared scheduler runs a handful of requests
 * at a time, foreground (what the visitor is looking at) strictly before background (everything else).
 *
 * Only a small window of frames around the playhead is decoded to bitmaps (a full-HD bitmap is ~8 MB).
 */

type Bitmap = ImageBitmap | HTMLImageElement;

export type Manifest = {
  count: number;
  pattern: string;
  w: number;
  h: number;
  fps: number;
  ts?: number[];
  sizes?: number[];
  marks?: Record<string, [number, number]>;
  v?: string;
};

const DECODE_PARALLEL = typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 4) <= 4 ? 2 : 3;
// decoded frames kept around the playhead (a full-HD bitmap is ~8 MB, so phones keep fewer)
const SMALL = typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches;
const WINDOW = SMALL ? 6 : 10;
const KEEP = SMALL ? 10 : 20;
const MAX_PARALLEL = 8;
const MAX_BACKGROUND = 3;
const FOREGROUND_LANE = 1000; // lanes below this are foreground

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with a timeout and retries; gives up after ~25 s of trying (the caller treats that as "skip") */
async function getWithRetry<T>(url: string, read: (r: Response) => Promise<T>, tries = 5): Promise<T> {
  let err: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000 + attempt * 10000);
    try {
      const r = await fetch(url, { signal: ac.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const out = await read(r);
      clearTimeout(timer);
      return out;
    } catch (e) {
      clearTimeout(timer);
      err = e;
      await sleep(350 * 2 ** attempt + Math.random() * 300);
    }
  }
  throw err;
}

/* ---------- one shared download scheduler: lowest priority number first ---------- */

type Job = { prio: () => number; run: () => Promise<void> };
const jobs: Job[] = [];
let active = 0;
let activeBackground = 0;

function pump() {
  while (active < MAX_PARALLEL && jobs.length) {
    let best = -1;
    let bestP = Infinity;
    for (let i = 0; i < jobs.length; i++) {
      const p = jobs[i].prio();
      if (p >= FOREGROUND_LANE && activeBackground >= MAX_BACKGROUND) continue;
      if (p < bestP) {
        bestP = p;
        best = i;
      }
    }
    if (best < 0) return;
    const [job] = jobs.splice(best, 1);
    const bg = bestP >= FOREGROUND_LANE;
    active++;
    if (bg) activeBackground++;
    job
      .run()
      .catch(() => {})
      .finally(() => {
        active--;
        if (bg) activeBackground--;
        pump();
      });
  }
}

export function schedule(prio: () => number, run: () => Promise<void>) {
  jobs.push({ prio, run });
  pump();
}

export const levelOf = (i: number, count: number) => (i % 8 === 0 || i === count - 1 ? 0 : i % 4 === 0 ? 1 : i % 2 === 0 ? 2 : 3);

/**
 * Decode a frame off the main thread. (Asking createImageBitmap to resize while it decodes was tried and removed:
 * the resize runs on the main thread and made scrolling stutter; the GPU scales the frame when it is drawn.)
 */
async function decode(blob: Blob): Promise<{ bmp: Bitmap; url?: string }> {
  try {
    return { bmp: await createImageBitmap(blob) };
  } catch {
    // createImageBitmap fails in some webviews; <img> always works
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

type Decoded = { bmp: Bitmap; url?: string };

export class Sequence {
  count = 0;
  w = 16;
  h = 9;
  marks: Record<string, [number, number]> = {};
  manifest: Manifest | null = null;
  /** 0..1 of every frame / of each level that has been downloaded (failed frames count as done) */
  bytesLoaded = 0;
  bytesTotal = 0;
  levelBytes = [0, 0, 0, 0];
  levelBytesLoaded = [0, 0, 0, 0];
  private levelFrames = [0, 0, 0, 0];
  private levelDoneFrames = [0, 0, 0, 0];
  failed = 0;
  loaded = 0;
  private failedSet = new Set<number>();
  /** performance.now() of the last draw, used to free memory of sequences that are no longer on screen */
  lastDrawAt = 0;
  hasPicture = false;
  /** lowest lane runs first. 0 = foreground; background lanes start at 1000 */
  lane = FOREGROUND_LANE + 1000;

  private blobs: (Blob | null)[] = [];
  private bitmaps = new Map<number, Decoded>();
  private decoding = new Set<number>();
  private want: number[] = [];
  private lastKey = "";
  private started = false;
  private center = 0;
  private fi = 0;
  private resolveManifest!: () => void;
  manifestReady = new Promise<void>((r) => (this.resolveManifest = r));
  lastT = 0;
  private dir = 1;
  private planFi = -99;

  constructor(
    private name: string,
    private loop = false,
  ) {}

  private idx(i: number) {
    return this.loop ? ((i % this.count) + this.count) % this.count : Math.min(this.count - 1, Math.max(0, i));
  }
  private dist(i: number, c: number) {
    const d = Math.abs(i - c);
    return this.loop ? Math.min(d, this.count - d) : d;
  }

  /** is level `n` (and every coarser one) completely downloaded? */
  levelReady(n: number) {
    for (let k = 0; k <= n; k++) if (this.levelFrames[k] === 0 || this.levelDoneFrames[k] < this.levelFrames[k]) return false;
    return true;
  }
  /**
   * The first `frac` of the sequence at levels 0..n: how much of it has arrived (failed frames count as done).
   * This is what the site waits for before opening: enough to start scrubbing, not the whole film.
   */
  gate(level: number, frac: number) {
    let total = 0;
    let got = 0;
    let done = this.count > 0;
    const sizes = this.manifest?.sizes;
    const last = Math.max(1, Math.floor(this.count * frac));
    for (let i = 0; i < last; i++) {
      if (levelOf(i, this.count) > level) continue;
      const b = sizes ? sizes[i] : 200000;
      total += b;
      if (this.blobs[i] || this.failedSet.has(i)) got += b;
      else done = false;
    }
    return { done, fraction: total ? got / total : 0 };
  }
  /** 0..1 progress of level `n` by bytes */
  levelFraction(n: number) {
    return this.levelBytes[n] ? Math.min(1, this.levelBytesLoaded[n] / this.levelBytes[n]) : 0;
  }
  get fraction() {
    return this.bytesTotal ? Math.min(1, this.bytesLoaded / this.bytesTotal) : 0;
  }
  get complete() {
    return this.count > 0 && this.loaded + this.failed >= this.count;
  }
  setLane(lane: number) {
    this.lane = lane;
  }

  /** Fetch the manifest (with retries), then queue every frame with the shared scheduler. */
  start(lane?: number) {
    if (lane !== undefined) this.lane = lane;
    if (this.started) return;
    this.started = true;
    (async () => {
      let m: Manifest;
      try {
        m = await getWithRetry(`frames/${this.name}/manifest.json`, (r) => r.json(), 6);
      } catch {
        return; // sequence stays empty; callers check .count
      }
      this.manifest = m;
      this.count = m.count;
      this.w = m.w;
      this.h = m.h;
      this.marks = m.marks ?? {};
      this.blobs = new Array(m.count).fill(null);
      const sizes = m.sizes ?? new Array(m.count).fill(200000);
      for (let i = 0; i < m.count; i++) {
        const l = levelOf(i, m.count);
        this.levelFrames[l]++;
        this.levelBytes[l] += sizes[i];
        this.bytesTotal += sizes[i];
      }
      this.resolveManifest();
      const q = m.v ? `?v=${m.v}` : "";
      for (let i = 0; i < m.count; i++) {
        const l = levelOf(i, m.count);
        const url = m.pattern.replace("%03d", String(i + 1).padStart(3, "0")) + q;
        schedule(
          // coarse frames everywhere first, then finer ones, each level nearest the playhead first
          () => this.lane + l * 50 + this.dist(i, this.center) * 0.25 + (this.loop ? 0 : 0),
          async () => {
            try {
              const blob = await getWithRetry(url, (r) => r.blob());
              this.blobs[i] = blob;
              this.loaded++;
              this.bytesLoaded += blob.size;
              this.levelBytesLoaded[l] += sizes[i];
              this.arrived(i);
            } catch {
              this.failed++;
              this.failedSet.add(i);
            }
            this.levelDoneFrames[l]++;
          },
        );
      }
    })();
  }

  /** a frame just arrived: decode it now if it sits near the playhead */
  private arrived(i: number) {
    if (this.dist(i, this.center) <= 12 || !this.hasPicture) {
      this.plan();
      this.onDecodedSoon();
    }
  }
  private onDecodedSoon() {
    this.pumpDecode();
  }

  /** the downloaded frames nearest the playhead, nearest first (plus a few ahead in the direction of travel) */
  private plan() {
    const want: number[] = [];
    const c = Math.round(this.fi);
    for (let d = 0; d < this.count && want.length < WINDOW; d++) {
      const a = this.loop ? ((c + d) % this.count) : c + d;
      const b = this.loop ? (((c - d) % this.count) + this.count) % this.count : c - d;
      if (a >= 0 && a < this.count && this.blobs[a] && !want.includes(a)) want.push(a);
      if (d > 0 && b >= 0 && b < this.count && this.blobs[b] && !want.includes(b)) want.push(b);
    }
    for (let d = 1; d <= 4; d++) {
      const f = this.idx(c + this.dir * (d + 6));
      if (this.blobs[f] && !want.includes(f)) want.push(f);
    }
    this.want = want;
    this.planFi = this.fi;
  }

  private pumpDecode() {
    while (this.decoding.size < DECODE_PARALLEL) {
      const i = this.want.find((k) => this.blobs[k] && !this.bitmaps.has(k) && !this.decoding.has(k));
      if (i === undefined) return;
      this.decoding.add(i);
      decode(this.blobs[i]!)
        .then((d) => {
          this.bitmaps.set(i, d);
          this.lastKey = "";
          this.onDecoded?.();
        })
        .catch(() => {})
        .finally(() => {
          this.decoding.delete(i);
          this.pumpDecode();
        });
    }
  }

  invalidate() {
    this.lastKey = "";
  }
  onDecoded?: () => void;

  private closeBitmap(idx: number) {
    const d = this.bitmaps.get(idx);
    if (!d) return;
    if (d.bmp instanceof ImageBitmap) d.bmp.close();
    if (d.url) URL.revokeObjectURL(d.url);
    this.bitmaps.delete(idx);
  }
  private evict() {
    if (this.bitmaps.size <= KEEP) return;
    const c = Math.round(this.fi);
    const keys = Array.from(this.bitmaps.keys()).sort((a, b) => this.dist(b, c) - this.dist(a, c));
    for (const k of keys) {
      if (this.bitmaps.size <= KEEP) break;
      this.closeBitmap(k);
    }
  }
  releaseBitmaps() {
    for (const idx of Array.from(this.bitmaps.keys())) this.closeBitmap(idx);
    this.lastKey = "";
  }

  /** position t (0..1) -> continuous frame index */
  private locate(t: number) {
    if (this.loop) {
      const p = ((t % 1) + 1) % 1;
      return p * this.count;
    }
    const p = Math.min(1, Math.max(0, t));
    const ts = this.manifest?.ts;
    if (!ts || ts.length !== this.count) return p * (this.count - 1);
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= p) lo = mid;
      else hi = mid;
    }
    const span = ts[hi] - ts[lo];
    return lo + (span > 0 ? Math.min(1, Math.max(0, (p - ts[lo]) / span)) : 0);
  }

  /** nearest downloaded frame at or before / after index i (searching at most `limit` steps) */
  private neighbour(i: number, step: 1 | -1, limit: number) {
    for (let d = 0; d <= limit; d++) {
      const k = this.loop ? (((i + step * d) % this.count) + this.count) % this.count : i + step * d;
      if (k < 0 || k >= this.count) return -1;
      if (this.blobs[k]) return k;
    }
    return -1;
  }

  /**
   * Draw position t (0..1) into the canvas, cover-fit; fx/fy pick which part of the frame stays visible when the
   * viewport crops it. settle = true draws one single frame instead of a blend of two.
   * Returns true when something was painted.
   */
  draw(canvas: HTMLCanvasElement | null, t: number, fx = 0.5, fy = 0.5, settle = false) {
    if (!canvas || this.count === 0) return false;
    this.lastDrawAt = performance.now();
    const fi = this.locate(t);
    let delta = fi - this.fi;
    if (this.loop) delta = delta > this.count / 2 ? delta - this.count : delta < -this.count / 2 ? delta + this.count : delta;
    if (Math.abs(delta) > 1e-6) this.dir = delta >= 0 ? 1 : -1;
    this.fi = fi;
    this.center = Math.round(fi) % this.count;
    this.lastT = t;
    if (Math.abs(fi - this.planFi) > 1 || this.want.length === 0) {
      this.planFi = fi;
      this.plan();
      this.pumpDecode();
    }

    // which frames make this picture? both neighbours when they are close enough, else the nearest one
    const lo = Math.floor(fi);
    const iLo = this.neighbour(this.idx(lo), -1, 6);
    const iHi = this.neighbour(this.idx(lo + 1), 1, 6);
    let first = -1;
    let second = -1;
    let a = 0;
    if (iLo >= 0 && iHi >= 0 && iLo !== iHi) {
      const gap = this.loop ? ((iHi - iLo + this.count) % this.count) : iHi - iLo;
      const pos = this.loop ? ((fi - iLo + this.count) % this.count) : fi - iLo;
      if (gap <= 3 && !settle) {
        first = iLo;
        second = iHi;
        a = Math.min(1, Math.max(0, pos / gap));
      } else first = pos / gap < 0.5 ? iLo : iHi;
    } else first = iLo >= 0 ? iLo : iHi;
    if (first < 0) return false;
    if (second >= 0 && (a < 0.03 || a > 0.97)) {
      if (a > 0.97) first = second;
      second = -1;
    }

    const bf = this.bitmaps.get(first)?.bmp ?? this.nearestBitmap(first);
    if (!bf) return false;
    const bs = second >= 0 ? this.bitmaps.get(second)?.bmp : undefined;

    // never render more pixels than the source has: the browser scales the canvas up for free
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(this.w, Math.round(canvas.clientWidth * dpr));
    const ch = Math.round(cw * (canvas.clientHeight / Math.max(1, canvas.clientWidth)));
    if (cw === 0 || ch === 0) return false;
    const exact = this.bitmaps.has(first) && (second < 0 || !!bs);
    const key = `${first}|${second}|${a.toFixed(3)}|${fx.toFixed(3)}|${fy}|${cw}x${ch}`;
    if (key === this.lastKey) return false;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = settle ? "high" : "medium";

    const place = (src: Bitmap) => {
      const sw = (src as HTMLImageElement).width;
      const sh = (src as HTMLImageElement).height;
      const s = Math.max(cw / sw, ch / sh);
      const dw = sw * s;
      const dh = sh * s;
      return [(cw - dw) * fx, (ch - dh) * fy, dw, dh] as const;
    };
    ctx.globalAlpha = 1;
    ctx.drawImage(bf, ...place(bf));
    if (bs) {
      ctx.globalAlpha = a;
      ctx.drawImage(bs, ...place(bs));
      ctx.globalAlpha = 1;
    }
    this.hasPicture = true;
    if (exact) this.lastKey = key; // an approximate picture is repainted once its frames have decoded
    this.evict();
    return true;
  }

  private nearestBitmap(i: number) {
    for (let d = 0; d < this.count; d++) {
      const a = this.bitmaps.get(this.idx(i - d));
      if (a) return a.bmp;
      const b = this.bitmaps.get(this.idx(i + d));
      if (b) return b.bmp;
    }
    return null;
  }

  dispose() {
    this.want = [];
    this.releaseBitmaps();
    this.bitmaps.clear();
  }
}
