#!/usr/bin/env python3
"""Turn the raw generated videos/images into the web assets the site uses.

  python3 tools/build_media.py <dir with ring_loop_v2.mp4, a_focus.mp4, ab_slide.mp4, a_interior.mp4,
                                b_interior.mp4, 04_a_closeup.mp4, 07_b_closeup.mp4 and the detail PNGs>
  python3 tools/build_media.py <dir> a_focus        # rebuild just one segment
  python3 tools/build_media.py --lite               # (re)make only the tiny preview frames

Re-run it after replacing any source clip; nothing in the code has to change.

Quality notes
- Frames are cut at the clip's NATIVE resolution (1920 wide) and encoded at WebP quality 88.
- Frames are chosen by MOTION: every frame of the clip is measured, and a frame is kept only once
  enough visual change has built up since the last kept one (or after MAXGAP frames of stillness).
  Fast camera moves therefore keep ~24 fps, near-still stretches keep a few, and the site blends
  neighbouring frames that are always visually close. manifest.json stores each kept frame's exact
  position in the clip (`ts`), so scrolling maps to the same moment of the video as before.
- The looping ring video (the hero) is re-encoded near-visually-lossless.
Needs ffmpeg, Pillow and numpy.
"""

import json
import os
import shutil
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")

SRC_FPS = 24

# name -> (source clip, start s, end s, frame width, webp quality, motion threshold, max gap in frames)
# Quality is prioritised over file size: native 1920 width everywhere, WebP quality 88, and a low motion
# threshold so that wherever the camera moves nearly every frame (up to the clip's 24 fps) is kept.
SEGMENTS = {
    # ring -> yacht A: one continuous descent that keeps the whole ring in view
    "a_focus": ("a_focus.mp4", 0.0, 8.0, 1920, 88, 2.0, 6),
    # yacht A -> yacht B: sideways slide along the ring (the clip dissolves into its end frame after ~4.9 s, so stop before)
    "ab_slide": ("ab_slide.mp4", 0.0, 4.7, 1920, 88, 2.0, 6),
    # interiors: slow dolly through the salon, the ring of yachts visible through the windows
    "a_interior": ("a_interior.mp4", 0.0, 6.0, 1920, 88, 2.5, 6),
    "b_interior": ("b_interior.mp4", 0.0, 6.0, 1920, 88, 2.5, 6),
    # cockpit glides shown in the detail windows
    "a_close": ("04_a_closeup.mp4", 0.0, 4.4, 1920, 88, 3.0, 6),
    "b_close": ("07_b_closeup.mp4", 0.0, 5.9, 1920, 88, 3.0, 6),
}

# ring idle loop (the hero): forward then reverse over a short window so it never jumps
RING = ("ring_loop_v2.mp4", 0.0, 3.2)
RING_CRF = 12  # lower = closer to the source; 12 is well above the source bitrate (visually lossless)

IMAGES = {
    "02_a_hero_aerial.png": "a-hero",
    "03_a_side.png": "a-side",
    "04_a_cockpit.png": "a-cockpit",
    "05_a_salon.png": "a-salon",
    "06_b_hero_aerial.png": "b-hero",
    "07_b_side.png": "b-side",
    "08_b_cockpit.png": "b-cockpit",
    "09_b_salon.png": "b-salon",
}


def run(cmd):
    subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)


def _encode(args):
    src, dst, quality = args
    Image.open(src).convert("RGB").save(dst, "WEBP", quality=quality, method=6)


def _gray(path):
    return np.asarray(Image.open(path).convert("L").resize((96, 54), Image.BILINEAR), dtype=np.float32)


def build_sequence(src_dir, name, clip, ss, to, width, quality, threshold, maxgap):
    out = os.path.join(PUBLIC, "frames", name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    tmp = os.path.join(out, "_all")
    os.makedirs(tmp)

    # every frame of the clip at its native frame rate and a high-quality scale
    run(["ffmpeg", "-y", "-v", "error", "-ss", str(ss), "-t", str(round(to - ss, 3)),
         "-i", os.path.join(src_dir, clip),
         "-vf", f"fps={SRC_FPS},scale={width}:-2:flags=lanczos", os.path.join(tmp, "a_%04d.png")])
    files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    n = len(files)

    # pick frames by accumulated motion
    prev = _gray(os.path.join(tmp, files[0]))
    keep = [0]
    acc = 0.0
    last = 0
    for i in range(1, n):
        cur = _gray(os.path.join(tmp, files[i]))
        acc += float(np.abs(cur - prev).mean())
        prev = cur
        if acc >= threshold or i - last >= maxgap or i == n - 1:
            keep.append(i)
            acc = 0.0
            last = i

    jobs = []
    for k, i in enumerate(keep):
        jobs.append((os.path.join(tmp, files[i]), os.path.join(out, f"f_{k + 1:03d}.webp"), quality))
    with Pool(max(1, (os.cpu_count() or 2))) as pool:
        pool.map(_encode, jobs)

    w, h = Image.open(os.path.join(out, "f_001.webp")).size
    denom = max(1, n - 1)
    manifest = {
        "count": len(keep),
        "pattern": f"frames/{name}/f_%03d.webp",
        "w": w,
        "h": h,
        "fps": SRC_FPS,
        "ts": [round(i / denom, 5) for i in keep],
    }
    shutil.rmtree(tmp)
    with open(os.path.join(out, "manifest.json"), "w") as fh:
        json.dump(manifest, fh)
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6
    print(f"{name}: kept {len(keep)} of {n} frames ({len(keep) / (n / SRC_FPS):.1f} fps avg), {w}x{h}, {size:.1f} MB")
    return manifest


LITE_WIDTH = 512
LITE_QUALITY = 38


def _lite(args):
    src, dst = args
    im = Image.open(src).convert("RGB")
    im = im.resize((LITE_WIDTH, round(LITE_WIDTH * im.height / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=LITE_QUALITY, method=6)


def build_lite(name):
    """Tiny previews of the exact frames already chosen for `name` (same manifest order and timing)."""
    d = os.path.join(PUBLIC, "frames", name)
    mp = os.path.join(d, "manifest.json")
    m = json.load(open(mp))
    out = os.path.join(d, "lite")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    jobs = [(os.path.join(d, f"f_{k + 1:03d}.webp"), os.path.join(out, f"f_{k + 1:03d}.webp")) for k in range(m["count"])]
    with Pool(max(1, (os.cpu_count() or 2))) as pool:
        pool.map(_lite, jobs)
    m["lite"] = f"frames/{name}/lite/f_%03d.webp"
    with open(mp, "w") as fh:
        json.dump(m, fh)
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6
    print(f"{name} lite: {m['count']} frames, {size:.1f} MB")


def main():
    if sys.argv[1] == "--lite":
        for name in SEGMENTS:
            build_lite(name)
        return
    src = sys.argv[1]
    os.makedirs(os.path.join(PUBLIC, "video"), exist_ok=True)
    os.makedirs(os.path.join(PUBLIC, "img"), exist_ok=True)
    only = set(sys.argv[2:])  # optional: rebuild just these segments, e.g. `a_focus`

    if not only:
        clip, ss, to = RING
        out = os.path.join(PUBLIC, "video", "ring.mp4")
        d = round(to - ss, 3)
        run(["ffmpeg", "-y", "-v", "error", "-ss", str(ss), "-t", str(d), "-i", os.path.join(src, clip),
             "-filter_complex",
             "[0:v]setpts=PTS-STARTPTS,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]",
             "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slower", "-tune", "film",
             "-crf", str(RING_CRF), "-profile:v", "high", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", out])
        print("ring.mp4", round(os.path.getsize(out) / 1e6, 1), "MB")
        run(["ffmpeg", "-y", "-v", "error", "-ss", str(ss), "-i", os.path.join(src, clip),
             "-frames:v", "1", "-vf", "scale=1920:-2:flags=lanczos", os.path.join(PUBLIC, "img", "ring-poster.png")])
        p = os.path.join(PUBLIC, "img", "ring-poster.png")
        Image.open(p).convert("RGB").save(p[:-4] + ".webp", "WEBP", quality=88, method=6)
        os.remove(p)

    for name, cfg in SEGMENTS.items():
        if only and name not in only:
            continue
        build_sequence(src, name, *cfg)
        build_lite(name)

    if only:
        return
    for fname, short in IMAGES.items():
        im = Image.open(os.path.join(src, fname)).convert("RGB")
        im.save(os.path.join(PUBLIC, "img", short + ".webp"), "WEBP", quality=88, method=6)
    print("images done")


if __name__ == "__main__":
    main()
