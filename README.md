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
- **One canvas, one film.** The hero is a single pre-assembled WebP frame sequence drawn on one canvas. The dissolves between the generated clips are baked into the frames at build time, so nothing is blended, blurred or filtered live while scrolling.
- **Frames by motion.** The build keeps more frames where the camera moves fast and fewer where it is slow (`tools/build_site_media.py`), so quality is high where it matters and the download stays small. Only a small window of frames around the playhead is decoded (`src/lib/sequence.ts`), and decoded frames are freed when the film is out of view.
- **No animation library.** Scroll position maps straight to a film position; overlays are plain elements whose opacity/transform are written once per frame, only when they change. Lenis is the only thing smoothing the scroll (no stacked easing).
- **Loading in the right order.** The loader preloads the opening loop and every frame of the hero film in full quality, with a true byte-accurate progress figure. The four yacht 360° loops then download quietly in the background; hovering or opening a yacht moves its frames to the front of the queue.
- **Cached.** A small service worker (`public/sw.js`) stores the media, so later visits open instantly.
- Below-the-fold sections use `content-visibility: auto`; reveals use transform + opacity only; the 360° viewer renders only while something moves.

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
