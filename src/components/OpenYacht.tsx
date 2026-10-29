"use client";

import type { YachtId } from "@/data/site";
import { hintYacht } from "@/lib/seqs";
import { openYacht, prefetchViewer } from "@/lib/viewer";

/** A button that opens a yacht in the full-screen viewer (a small client island inside server-rendered sections). */
export default function OpenYacht({ id, className, style, label, children }: { id: YachtId; className?: string; style?: React.CSSProperties; label?: string; children: React.ReactNode }) {
  const warm = () => {
    prefetchViewer();
    hintYacht(id);
  };
  return (
    <button type="button" onClick={() => openYacht(id)} onPointerEnter={warm} onFocus={warm} className={className} style={style} aria-label={label}>
      {children}
    </button>
  );
}
