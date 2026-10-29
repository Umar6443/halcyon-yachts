#!/usr/bin/env python3
"""Turn the generated clips and stills into the web assets the site streams.

  python3 tools/build_site_media.py <source dir>            # everything
  python3 tools/build_site_media.py <source dir> hero       # just the hero journey
  python3 tools/build_site_media.py <source dir> meme nft   # just some yacht loops
  python3 tools/build_site_media.py <source dir> images ring

Source dir layout (file names, not paths):
  video/hero_ring_loop.mp4 hero_descent.mp4 hero_orbit_1a.mp4 hero_orbit_1b.mp4 hero_orbit_bow.mp4
        hero_approach.mp4 hero_interior.mp4
        {meme,nft,exchange,media}_orbit_{a,b,c,d}.mp4
  img/  the stills listed in IMAGES below

What it makes (all under public/):
  frames/hero/            one scroll-scrubbed journey: ring -> descent -> full 360 orbit -> boarding -> salon
  frames/<yacht>/         one seamless 360 degree loop per yacht (drag to rotate)
  video/ring-loop.mp4          the idle loop of the opening scene (forward + reverse = endless)
  img/                    web stills

How the sequences are made
- The AI clips contain a few dissolves and hard cuts. Those spans are cut out here and replaced with short
  cross-dissolves between two moving shots (PIECES below), baked into the frames, so the browser never has to
  blend live and no ghost double-exposure is ever shown.
- Frames are kept by MOTION, not by time: the whole assembled timeline is measured and frames are picked so
  that every kept frame is the same amount of visual change apart. Fast camera moves keep many frames, slow
  stretches few. The hero maps scroll to real time (manifest `ts`); the yacht loops map a drag to frame index,
  which makes a drag rotate the yacht at an even speed.
- The site loads each sequence progressively (every 8th frame first, then every 4th, 2nd, the rest), so the
  frame order here only has to be a clean timeline; `manifest.json` carries each frame's byte size and a content
  version used to key the browser cache.
Needs ffmpeg, Pillow and numpy.
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
FPS = 24
GRAY = (96, 54)

# (clip, first frame, last frame, crossfade frames with the previous piece)
# Frame ranges skip the dissolves / hard cuts the video generator put in each clip.
HERO_PIECES = [
    ("hero_descent", 0, 191, 0),            # ring overview -> behind the stern of the featured yacht
    ("hero_orbit_1a", 0, 70, 0),            # stern -> port stern quarter (rotating, ring still around it)
    ("hero_orbit_1a", 100, 190, 10),        # ... (the generator's own dissolve sits between 70 and 100)
    ("hero_orbit_1b", 0, 191, 4),           # ... port stern quarter -> the whole port side
    ("hero_orbit_bow", 0, 190, 4),          # ... around the bow to the starboard bow quarter
    ("meme_orbit_d", 0, 120, 8),            # ... along the starboard side (neighbouring yachts fade out: same pose)
    ("meme_orbit_d", 129, 190, 6),          # ... to the starboard stern quarter
    ("hero_approach", 73, 190, 16, 1.5),    # ... pushes in behind the stern, over the swim platform, onto the deck
    ("hero_interior", 0, 190, 4),           # ... through the salon
]

# the clips of each yacht, in rotation order: a = stern, b = port side, c = bow, d = starboard side
# (trimmed where the generator put a dissolve or a hard cut into a clip)
YACHT_PIECES = {
    "meme": [
        # meme_orbit_a is a quarter view, a dissolve, a long static hold behind the stern, a second dissolve and a
        # static hold at the port stern quarter: keep the moving start, a few stern frames and the end
        ("meme_orbit_a", 0, 54, 0), ("meme_orbit_a", 92, 112, 8), ("meme_orbit_a", 156, 190, 8), ("meme_orbit_b", 0, 191, 6),
        ("meme_orbit_c", 0, 166, 6), ("meme_orbit_d", 0, 120, 6), ("meme_orbit_d", 129, 190, 6),
    ],
    "nft": [
        ("nft_orbit_a", 0, 120, 0), ("nft_orbit_a", 140, 158, 6), ("nft_orbit_b", 0, 191, 10), ("nft_orbit_c", 0, 190, 6), ("nft_orbit_d", 0, 184, 6),
    ],
    "exchange": [
        ("exchange_orbit_a", 0, 190, 0), ("exchange_orbit_b", 0, 191, 6),
        ("exchange_orbit_c", 0, 190, 6), ("exchange_orbit_d", 0, 190, 6),
    ],
    "media": [
        ("media_orbit_a", 0, 190, 0), ("media_orbit_b", 0, 191, 6),
        ("media_orbit_c", 0, 190, 6), ("media_orbit_d", 0, 190, 6),
    ],
}
LOOP_WRAP = 8  # frames blended so the last frame of a loop leads straight back into the first

HERO = dict(width=1920, quality=75, target=400)
YACHT = dict(width=1600, quality=78, target=180)

# source still -> (output name, width, quality)
IMAGES = {
    "1 m_ext_090.png": ("meme-beam", 1672, 86),
    "2 n_ext_090.png": ("nft-beam", 1672, 86),
    "4 e_ext_090.png": ("exchange-beam", 1672, 86),
    "3 t_ext_090.png": ("media-beam", 1672, 86),
    "meme_banner_closeup.png": ("meme-banner", 1672, 84),
    "meme_flybridge_lounge.png": ("meme-flybridge", 1672, 84),
    "9 hero_int_salon.png": ("meme-salon", 1672, 84),
    "meme_event.png": ("meme-event", 1672, 82),
    "nft_banner_closeup.png": ("nft-banner", 1672, 84),
    "nft_flybridge_lounge.png": ("nft-flybridge", 1672, 84),
    "nft_interior_salon.png": ("nft-salon", 1672, 84),
    "nft_event.png": ("nft-event", 1672, 82),
    "exchange_banner_closeup.png": ("exchange-banner", 1672, 84),
    "exchange_flybridge_lounge.png": ("exchange-flybridge", 1672, 84),
    "exchange_interior_salon.png": ("exchange-salon", 1672, 84),
    "exchange_event.png": ("exchange-event", 1672, 82),
    "media_banner_closeup.png": ("media-banner", 1672, 84),
    "media_flybridge_lounge.png": ("media-flybridge", 1672, 84),
    "media_interior_salon.png": ("media-salon", 1672, 84),
    "media_event.png": ("media-event", 1672, 82),
    "8 hero_int_door.png": ("meme-deck", 1672, 84),
    "5 hero_ring.png": ("hero-poster", 1920, 86),
}


def run(cmd):
    subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)


def clip_path(src, name):
    return os.path.join(src, "video", name + ".mp4")


def small_gray(src, name):
    """every frame of a clip as a tiny grayscale array (for measuring motion and choosing frames)"""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", clip_path(src, name), "-vf", f"scale={GRAY[0]}:{GRAY[1]}:flags=area,format=gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.uint8).reshape(-1, GRAY[1], GRAY[0]).astype(np.float32)


def nframes(src, name):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", clip_path(src, name)],
                         capture_output=True, text=True, check=True).stdout.strip()
    return int(out)


def assemble(pieces, wrap=0):
    """pieces -> a flat timeline of entries. An entry is one plain source frame, or a blend of two (cross-dissolve)."""
    entries = []
    for piece in pieces:
        clip, f0, f1, xf = piece[:4]
        zoom = piece[4] if len(piece) > 4 else 1.0
        frames = list(range(f0, f1 + 1))
        if xf and entries:
            for j in range(xf):
                prev = entries[-xf + j]
                assert prev["b"] is None, "crossfade over an already blended frame"
                t = (j + 1) / (xf + 1)
                entries[-xf + j] = {"a": prev["a"], "b": (clip, f0 + j), "w": t, "z": 1 + (zoom - 1) * t}
            frames = frames[xf:]
        for f in frames:
            entries.append({"a": (clip, f), "b": None, "w": 0.0, "z": 1.0})
    if wrap:
        n = len(entries)
        for j in range(wrap):
            tail = entries[n - wrap + j]
            assert tail["b"] is None
            entries[n - wrap + j] = {"a": tail["a"], "b": entries[j]["a"], "w": (j + 1) / (wrap + 1), "z": 1.0}
        entries = entries[wrap:]
    return entries


def owners_for(pieces, entries, wrap=0):
    """piece index of every entry (by the clip/frame it is primarily made of)"""
    idx = {}
    for pi, (clip, f0, f1, *_) in enumerate(pieces):
        for f in range(f0, f1 + 1):
            idx.setdefault((clip, f), pi)
    res = []
    for e in entries:
        res.append(idx.get(e["a"], 0))
    return res


def entry_gray(e, grays):
    a = grays[e["a"][0]][e["a"][1]]
    if e["b"] is None:
        return a
    b = grays[e["b"][0]][e["b"][1]]
    return a * (1 - e["w"]) + b * e["w"]


def choose_frames(entries, grays, target, maxgap=10, uniform=False):
    """indices of the entries to keep: equal amounts of visual change apart (or equal time apart when `uniform`,
    which is what a turntable wants: every kept frame is the same angle further round)"""
    n = len(entries)
    if uniform:
        return sorted({round(k * (n - 1) / (target - 1)) for k in range(target)})
    g = [entry_gray(e, grays) for e in entries]
    motion = np.zeros(n)
    for i in range(1, n):
        motion[i] = motion[i - 1] + float(np.abs(g[i] - g[i - 1]).mean())
    total = motion[-1]
    keep = {0, n - 1}
    for k in range(1, target - 1):
        keep.add(int(np.searchsorted(motion, total * k / (target - 1))))
    ks = sorted(keep)
    out = [ks[0]]
    for i in ks[1:]:
        while i - out[-1] > maxgap:
            out.append(out[-1] + maxgap)
        if i != out[-1]:
            out.append(i)
    return out


def extract_needed(src, name, frames, width, tmp):
    """decode only the listed frame numbers of a clip to PNG files; returns {frame: path}"""
    frames = sorted(set(frames))
    if not frames:
        return {}
    expr = "+".join(f"eq(n\\,{f})" for f in frames)
    out = os.path.join(tmp, name)
    os.makedirs(out, exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-i", clip_path(src, name), "-vf", f"select='{expr}',scale={width}:-2:flags=lanczos",
         "-fps_mode", "passthrough", "-f", "image2", os.path.join(out, "f_%04d.png")])
    files = sorted(os.listdir(out))
    assert len(files) == len(frames), f"{name}: expected {len(frames)} frames, got {len(files)}"
    return {f: os.path.join(out, p) for f, p in zip(frames, files)}


def _zoom(im, z, fx=0.5, fy=0.58):
    """crop in by factor z around (fx, fy) and scale back up (a push-in baked into the dissolve)"""
    cw, ch = im.width / z, im.height / z
    x = min(max(fx * im.width - cw / 2, 0), im.width - cw)
    y = min(max(fy * im.height - ch / 2, 0), im.height - ch)
    return im.resize(im.size, Image.LANCZOS, box=(x, y, x + cw, y + ch))


def _write(args):
    paths_a, paths_b, w, dst, quality, z = args
    a = Image.open(paths_a).convert("RGB")
    if z != 1.0:
        a = _zoom(a, z)
    if paths_b:
        b = Image.open(paths_b).convert("RGB")
        a = Image.blend(a, b, w)
    a.save(dst, "WEBP", quality=quality, method=5)


def build_sequence(src, name, pieces, cfg, time_based, wrap=0, marks_from=None):
    print(f"[{name}] assembling...")
    counts = {c: nframes(src, c) for c in {p[0] for p in pieces}}
    pieces = [(p[0], p[1], min(p[2], counts[p[0]] - 1), *p[3:]) for p in pieces]
    entries = assemble(pieces, wrap=wrap)
    owner = owners_for(pieces, entries, wrap=wrap)
    clips = sorted({e["a"][0] for e in entries} | {e["b"][0] for e in entries if e["b"]})
    grays = {c: small_gray(src, c) for c in clips}
    keep = choose_frames(entries, grays, cfg["target"], uniform=not time_based)
    n_entries = len(entries)
    print(f"[{name}] timeline {n_entries} frames -> keeping {len(keep)}")

    out = os.path.join(PUBLIC, "frames", name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    tmp = tempfile.mkdtemp(prefix=f"seq_{name}_")
    try:
        need = {}
        for i in keep:
            e = entries[i]
            need.setdefault(e["a"][0], set()).add(e["a"][1])
            if e["b"]:
                need.setdefault(e["b"][0], set()).add(e["b"][1])
        paths = {}
        for c, fr in need.items():
            for f, p in extract_needed(src, c, fr, cfg["width"], tmp).items():
                paths[(c, f)] = p
        jobs = []
        for k, i in enumerate(keep):
            e = entries[i]
            jobs.append((paths[e["a"]], paths[e["b"]] if e["b"] else None, e["w"], os.path.join(out, f"f_{k + 1:03d}.webp"), cfg["quality"], e.get("z", 1.0)))
        with Pool(max(1, os.cpu_count() or 2)) as pool:
            pool.map(_write, jobs, chunksize=4)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    w, h = Image.open(os.path.join(out, "f_001.webp")).size
    manifest = {"count": len(keep), "pattern": f"frames/{name}/f_%03d.webp", "w": w, "h": h, "fps": FPS}
    if time_based:
        manifest["ts"] = [round(i / max(1, n_entries - 1), 5) for i in keep]

    # named positions along the sequence (0..1 on the same scale the site scrubs with)
    def pos(entry_idx):
        if time_based:
            return round(entry_idx / max(1, n_entries - 1), 5)
        j = int(np.searchsorted(keep, entry_idx))
        return round(min(j, len(keep) - 1) / max(1, len(keep) - 1), 5)

    marks = {}
    for pi, (clip, f0, f1, *_) in enumerate(pieces):
        idxs = [i for i, o in enumerate(owner) if o == pi]
        if not idxs:
            continue
        key = clip if marks_from is None else marks_from(pi, clip)
        marks.setdefault(key, []).append([pos(idxs[0]), pos(idxs[-1])])
    manifest["marks"] = {k: [min(a for a, _ in v), max(b for _, b in v)] for k, v in marks.items()}

    finalize(name)


def finalize(name):
    """exact byte size of every frame (the loader's progress is real) + a content version the site puts on frame
    URLs, so a rebuilt sequence can never be served from an old cache entry"""
    d = os.path.join(PUBLIC, "frames", name)
    mp = os.path.join(d, "manifest.json")
    m = json.load(open(mp))
    m.pop("lite", None)
    shutil.rmtree(os.path.join(d, "lite"), ignore_errors=True)
    m["sizes"] = [os.path.getsize(os.path.join(d, f"f_{k + 1:03d}.webp")) for k in range(m["count"])]
    h = hashlib.sha1()
    for k in range(m["count"]):
        with open(os.path.join(d, f"f_{k + 1:03d}.webp"), "rb") as fh:
            h.update(fh.read(4096))
    m["v"] = h.hexdigest()[:8]
    with open(mp, "w") as fh:
        json.dump(m, fh)
    print(f"[{name}] {m['count']} frames {m['w']}x{m['h']}: {sum(m['sizes']) / 1e6:.1f} MB, version {m['v']}, marks {m.get('marks')}")


def build_ring(src):
    """the opening scene's idle loop: forward then reverse so it never jumps"""
    out = os.path.join(PUBLIC, "video", "ring-loop.mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-t", "5", "-i", clip_path(src, "hero_ring_loop"), "-filter_complex",
         "[0:v]setpts=PTS-STARTPTS,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]", "-map", "[v]", "-an",
         "-c:v", "libx264", "-preset", "slow", "-tune", "film", "-crf", "25", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", out])
    print(f"[ring] ring-loop.mp4 {os.path.getsize(out) / 1e6:.1f} MB")


def build_images(src):
    out = os.path.join(PUBLIC, "img")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for fname, (short, width, quality) in IMAGES.items():
        im = Image.open(os.path.join(src, "img", fname)).convert("RGB")
        if im.width != width:
            im = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
        im.save(os.path.join(out, short + ".webp"), "WEBP", quality=quality, method=6)
    # social preview
    im = Image.open(os.path.join(src, "img", "5 hero_ring.png")).convert("RGB")
    w, h = 1200, 630
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2
    im.crop((l, t, l + w, t + h)).save(os.path.join(out, "og.jpg"), "JPEG", quality=88)
    print(f"[images] {len(IMAGES)} stills, {sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6:.1f} MB")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    only = set(sys.argv[2:])
    want = lambda k: not only or k in only  # noqa: E731
    if want("ring"):
        build_ring(src)
    if want("finalize"):
        for n in ["hero", *YACHT_PIECES]:
            finalize(n)
    if want("images"):
        build_images(src)
    if want("hero"):
        build_sequence(src, "hero", HERO_PIECES, HERO, time_based=True)
    for yacht, pieces in YACHT_PIECES.items():
        if want(yacht):
            # name each piece by its clip letter (a/b/c/d) so the site can jump to "stern / port / bow / starboard"
            build_sequence(src, yacht, pieces, YACHT, time_based=False, wrap=LOOP_WRAP, marks_from=lambda pi, clip: clip.rsplit("_", 1)[-1])


if __name__ == "__main__":
    main()
