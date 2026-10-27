# HALCYON — scroll-driven yacht charter site

Next.js 15 · TypeScript · Tailwind 4 · GSAP + ScrollTrigger · Lenis · Lucide.
Built only from the supplied images and videos (no 3D model, no stock).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

## The experience
1. **Load:** the fleet sits in a ring in the bay (looping video).
2. **Scroll:** the camera descends toward yacht A in one continuous move; the rest of the ring stays in view around it. Title and specs appear along the bottom.
3. **Dive in:** the view pushes toward the salon and defocuses into the interior film; the ring and the other yachts are visible through the windows. Captions step in, then detail windows (photo, video) wipe up on the right.
4. **Next yacht:** the interior defocuses back out, and the camera slides sideways along the ring to yacht B and repeats.
5. **End:** B's view defocuses back to the ring with a booking call to action, then the enquiry footer.

One master GSAP timeline (`src/components/Story.tsx`) drives everything; scroll progress scrubs it.
Scroll-scrubbed clips are WebP frame sequences (`src/lib/sequence.ts`) that cross-blend neighbouring frames, so slow scrolling looks smooth.

## Where things are
| What | File |
|---|---|
| All copy, names, specs, which windows each yacht shows | `src/data/yachts.ts` (**placeholders: replace with the client's content**) |
| Timeline, layers, cross-zoom, layout | `src/components/Story.tsx` |
| Frame-sequence engine | `src/lib/sequence.ts` |
| Chapter start times for nav and dots | `src/data/chapters.ts` |
| Turn the raw videos/images into web assets | `tools/build_media.py` |

## Replacing a video
Put the new clip next to the others using the same file name, then:
```bash
python3 tools/build_media.py <folder with the clips + detail PNGs>      # everything
python3 tools/build_media.py <folder> a_focus                           # one segment
```
`SEGMENTS` at the top of that script chooses the clean part (start/end seconds) of each clip.
Needs `ffmpeg` and `pip install pillow`. No code changes are needed.

## Video quality
Quality is prioritised over file size (about 230 MB of media, each part loading only as you scroll toward it).
- The hero loop (`public/video/ring.mp4`) is full 1920x1080 at ~25 Mbps (the source is ~14 Mbps): PSNR 49.5 dB / SSIM 0.9965 vs the original, i.e. visually lossless.
- Scroll clips are cut at the clips' native 1920x1080 at WebP quality 88, keeping nearly every frame wherever the camera moves (up to the original 24 fps).
- The canvas scales with the browser's highest-quality filter, snaps to a single pristine frame when scrolling pauses, and releases clips that have scrolled out of view.

## Scroll performance
- Lenis glide is light (`lerp: 0.16`) and the timeline is tied directly to it (`scrub: true`), so there is no second catch-up delay on top of the glide.
- Drawing happens in the same frame as the scroll update, repaints are skipped when nothing changed, frames decode nearest-first a few at a time, and style writes only happen when a value changed.
- The hero loop video is paused while it is hidden; clips are downloaded in the order they are reached.

## Notes
- Clips used: `ring_loop_v2`, `a_focus`, `ab_slide` (first 4.7 s; it dissolves into its end frame after that), `a_interior`, `b_interior`, plus the two cockpit glides for the detail windows.
- Portrait screens pan the cropped slice to follow yacht A, then B.
- Respects `prefers-reduced-motion` (no smoothing); the loader never traps the visitor if a video cannot play.

## Live site
https://umar6443.github.io/halcyon-yachts/ (deployed by `.github/workflows/deploy.yml` on every push to `main`).
