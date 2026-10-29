# BLOCKTIDE — Web3 yacht events

A cinematic site for a Web3 / crypto / NFT event business that runs its events on themed luxury yachts.
Next.js 15 · TypeScript · Tailwind 4 · Lenis · Lucide. Built only from the supplied images and videos
(no 3D model, no stock). Brand name, yacht names, dates and prices are **placeholders** (`src/data/site.ts`).

```bash
npm install
npm run dev                         # http://localhost:3000
npm run build && npm start          # production build
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/halcyon-yachts npm run build   # static export (what the Pages workflow does)
```

## The experience
1. **Opening scene:** eight yachts at anchor in a ring (looping video). Four themes, each twice: meme coin, NFT, exchange, media.
2. **Scroll:** the camera drops to the featured yacht, circles it once all the way round (stern, port, bow, starboard), steps aboard over the swim platform and walks through the salon, in one continuous film.
3. **Explore our yachts:** four cards. Opening one gives a full-screen viewer:
   - **Exterior 360°**: drag to rotate (with inertia), wheel/pinch/buttons to zoom, buttons glide to stern / port / bow / starboard, arrow keys step.
   - **Interior**: look-around stills of the salon and flybridge.
   - **Gallery**, a **details panel** (specs, amenities, event types, next event, price) and a prominent **Book this yacht** button leading to the booking flow (date, guests, extras, running total, card form: *visual only, nothing is reserved or charged*).
4. **Upcoming events**, **About**, **Contact / event enquiries** (opens the visitor's email app).

## How it stays fast
- **Progressive loading (the main fix).** Every film is a sequence of full-quality WebP frames, loaded in passes: every 8th frame first (a couple of MB: enough to scrub or rotate anywhere), then every 4th, 2nd, and the rest, each pass nearest the visitor first. The site opens as soon as the first quarter of the film's coarse pass is in (about 1-3 s on a normal connection, ~6-10 s on a very slow one), never after the whole ~80 MB. Until a frame has arrived the nearest one that has is shown, so the picture is always sharp, only sparser, and a small "optimising quality" pill shows the rest arriving. (An earlier version waited for every frame before opening: 73 s at 12 Mbps, and on slower links it timed out into low-resolution previews.)
- **Robust downloads.** One scheduler runs 8 requests at a time (3 for background work), foreground strictly before background. Every request has a timeout and is retried with back-off; a frame that still fails is skipped and never blocks anything. With 10 % of requests deliberately dropped the site still loads and works.
- **Bandwidth goes where the visitor is.** Hero frames while the film is in view; the opened yacht's frames while the viewer is open; hovering a yacht moves it ahead of the other background loads; the four yacht loops fill in quietly after the hero. The opening loop (7 MB) starts streaming only when the site opens.
- **One canvas, one film.** The hero is a single pre-assembled frame sequence drawn on one canvas. The dissolves between the generated clips are baked into the frames at build time, so nothing is blended, blurred or filtered live while scrolling. The canvas never renders more pixels than the source has.
- **Frames by motion.** The build keeps more frames where the camera moves fast (`tools/build_site_media.py`); only a small window around the playhead is decoded to bitmaps, and phones keep fewer.
- **No animation library.** Scroll position maps straight to a film position; the picture is drawn inside the scroll tick (no extra frame of delay); overlays are plain elements whose opacity/transform are written only when they change. Lenis is the only thing smoothing the scroll. Loading progress lives in a tiny external store, so it never re-renders the page.
- **Cached.** A small service worker (`public/sw.js`) stores the media (frame URLs carry a content version, so a rebuild can never serve stale frames), so later visits open in about a second.
- Reveals use transform + opacity only; the 360° viewer renders only while something moves.

## Where things are
| What | File |
|---|---|
| All copy, yacht names, specs, prices, dates | `src/data/site.ts` (**placeholders: replace with the client's content**) |
| The scroll film (phases, overlays, loader logic) | `src/components/Hero.tsx` |
| Drag-to-rotate 360° | `src/components/Rotator.tsx` |
| Full-screen yacht viewer, details, interior, gallery | `src/components/YachtViewer.tsx` |
| Booking flow (visual only) | `src/components/Booking.tsx` |
| Fleet, events, about, contact | `src/components/Sections.tsx` |
| Frame-sequence engine (loops, marks, scheduler) | `src/lib/sequence.ts` |
| Smooth scroll | `src/lib/scroll.ts` |
| Turn the generated clips and stills into web assets | `tools/build_site_media.py` |

## Replacing media
`python3 tools/build_site_media.py <source dir>` rebuilds everything from the source clips and stills
(see the docstring for the expected file names); `... hero`, `... meme`, `... images` rebuild one part.
Each clip's usable frame range (it skips the dissolves / hard cuts the generator put into some clips) and the
cross-dissolves between clips are listed at the top of the script. Bump `CACHE` in `public/sw.js` after rebuilding.
It needs ffmpeg, Pillow and numpy.

## Notes for the client review
- The generated artwork carries abstract emblems only (no readable text), so real brand names and logos can be laid over it in code.
- The interior is shown as look-around stills, not full 360° panoramas (none were produced).
- Booking and payment are a visual flow only.

## GitHub Pages
`.github/workflows/deploy.yml` builds a static export and deploys it on every push to `main`
(Settings → Pages → Source: GitHub Actions).
