/**
 * Live panel showing which font *face files* have actually been downloaded.
 *
 * This is instrumentation, not Navara API: `FontManager` fetches each face with
 * a plain main-thread `fetch()` (`_fetchAndLoad` in `@navaramap/font`), so a
 * `PerformanceObserver` on resource timings sees every face download without
 * patching or reaching into the engine. Because the caller passes the *declared*
 * face list (straight out of `fetchFontFamilyFromCss`), each observed request is
 * matched back to the exact face and unicode range that triggered it — so the
 * panel reads "3 of 68 declared faces fetched", not "some fonts loaded".
 */

import type { FontFamily } from "@navaramap/three";

/** A face declared by the registered families, before anything is fetched. */
type DeclaredFace = {
  url: string;
  /** Human family name, recovered from the gstatic URL slug. */
  family: string;
  weight: number;
  /** Google slices CJK families into ~100 numbered files; this is that index. */
  slice?: number;
  unicodeRanges: { from: number; to: number }[];
};

export type FontWorkerStats = {
  fontCount: number;
  glyphCount: number;
  atlasBytes: number;
  colorAtlasBytes: number;
  fontBytes: number;
};

const PANEL_STYLE = `
.face-monitor {
  position: fixed; left: 8px; bottom: 8px; z-index: 20;
  width: 340px; max-height: min(60vh, 520px);
  display: flex; flex-direction: column;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e8e8ea; background: rgba(20, 22, 26, 0.86);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px;
  overflow: hidden;
}
.face-monitor__head {
  padding: 8px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.face-monitor__title {
  font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
  font-size: 10px; color: #9aa0a6;
}
.face-monitor__count { font-size: 15px; font-weight: 600; margin-top: 2px; }
.face-monitor__count b { color: #7ee787; font-weight: 600; }
.face-monitor__worker { color: #9aa0a6; margin-top: 2px; font-size: 10px; }
.face-monitor__list { overflow-y: auto; padding: 4px 0; }
.face-monitor__row {
  display: grid; grid-template-columns: 1fr auto;
  gap: 0 8px; padding: 4px 10px;
  border-left: 2px solid transparent;
}
.face-monitor__row--new {
  animation: face-monitor-flash 1.8s ease-out;
  border-left-color: #7ee787;
}
@keyframes face-monitor-flash {
  0% { background: rgba(126, 231, 135, 0.32); }
  100% { background: transparent; }
}
.face-monitor__name { color: #e8e8ea; }
.face-monitor__name em { color: #8ab4f8; font-style: normal; }
.face-monitor__name i { color: #ffb26b; font-style: normal; }
.face-monitor__meta { color: #7a7f87; grid-column: 1; }
.face-monitor__size { color: #9aa0a6; text-align: right; white-space: nowrap; }
.face-monitor__empty { padding: 10px; color: #7a7f87; }
`;

/** "Noto Sans Arabic" -> "notosansarabic", the slug gstatic puts in face URLs. */
const slugify = (family: string) => family.toLowerCase().replace(/[^a-z]/g, "");

const formatCodepoint = (cp: number) =>
  `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * Unicode block starts → script name, used to label a face by what it covers.
 * A family like plain "Noto Sans" ships several subsets (Latin, Greek,
 * Devanagari…), so the family name alone does not identify a downloaded file;
 * naming the script is what makes a row readable at a glance.
 */
const SCRIPT_BLOCKS: [number, string][] = [
  [0x0000, "Latin"],
  [0x0370, "Greek"],
  [0x0400, "Cyrillic"],
  [0x0530, "Armenian"],
  [0x0590, "Hebrew"],
  [0x0600, "Arabic"],
  [0x0700, "Syriac"],
  [0x0780, "Thaana"],
  [0x07c0, "NKo"],
  [0x0900, "Devanagari"],
  [0x0980, "Bengali"],
  [0x0a00, "Gurmukhi"],
  [0x0a80, "Gujarati"],
  [0x0b00, "Oriya"],
  [0x0b80, "Tamil"],
  [0x0c00, "Telugu"],
  [0x0c80, "Kannada"],
  [0x0d00, "Malayalam"],
  [0x0d80, "Sinhala"],
  [0x0e00, "Thai"],
  [0x0e80, "Lao"],
  [0x0f00, "Tibetan"],
  [0x1000, "Myanmar"],
  [0x10a0, "Georgian"],
  [0x1200, "Ethiopic"],
  [0x13a0, "Cherokee"],
  [0x1400, "Canadian Aboriginal"],
  [0x1680, "Ogham"],
  [0x1780, "Khmer"],
  [0x1800, "Mongolian"],
  [0x2d30, "Tifinagh"],
  [0x3040, "Japanese"],
  [0x4e00, "Han"],
  [0xa000, "Yi"],
  [0xac00, "Hangul"],
];

/**
 * Best-guess script for a face, from the first range it declares that is not
 * generic punctuation. CJK slices declare dozens of scattered ranges, so scan
 * for the first one that lands in a named block.
 */
const scriptOf = (ranges: { from: number; to: number }[]) => {
  for (const { from } of ranges) {
    // Skip the shared punctuation/symbol blocks every subset declares.
    if (from >= 0x2000 && from < 0x2d30) continue;
    let name: string | undefined;
    for (const [start, label] of SCRIPT_BLOCKS) {
      if (from >= start) name = label;
      else break;
    }
    if (name) return name;
  }
  return undefined;
};

/**
 * Summarize a face's declared coverage. Latin subsets carry a handful of
 * disjoint ranges and CJK slices carry hundreds, so show the span plus a count
 * rather than the full list.
 */
const formatRanges = (ranges: { from: number; to: number }[]) => {
  if (ranges.length === 0) return "all codepoints";
  const first = ranges[0];
  const span =
    first.from === first.to
      ? formatCodepoint(first.from)
      : `${formatCodepoint(first.from)}–${formatCodepoint(first.to)}`;
  return ranges.length > 1 ? `${span} +${ranges.length - 1} more` : span;
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

/**
 * Build the panel over the declared families.
 *
 * @param families The registered families, paired with the weight each was
 *   requested at, and the plain family names in the order they were requested
 *   (used to turn a gstatic URL slug back into a readable name).
 */
export const createFaceMonitor = (
  families: { family: FontFamily; weight: number }[],
  familyNames: string[],
) => {
  const style = document.createElement("style");
  style.textContent = PANEL_STYLE;
  document.head.appendChild(style);

  const nameBySlug = new Map(familyNames.map((n) => [slugify(n), n]));

  // Declared faces, keyed by URL. Two families at different weights never share
  // a URL (the weight is baked into the file), so the key is unambiguous.
  const declared = new Map<string, DeclaredFace>();
  for (const { family, weight } of families) {
    for (const face of family.faces) {
      if (declared.has(face.url)) continue;
      // gstatic paths look like `/s/notosansarabic/v18/<hash>.119.woff2`.
      const slug = /\/s\/([a-z]+)\//.exec(face.url)?.[1] ?? "";
      const slice = /\.(\d+)\.woff2$/.exec(face.url)?.[1];
      declared.set(face.url, {
        url: face.url,
        family: nameBySlug.get(slug) ?? slug ?? "unknown",
        weight,
        slice: slice != null ? Number(slice) : undefined,
        unicodeRanges: face.unicodeRanges,
      });
    }
  }

  const root = document.createElement("div");
  root.className = "face-monitor";
  root.innerHTML = `
    <div class="face-monitor__head">
      <div class="face-monitor__title">Font faces fetched</div>
      <div class="face-monitor__count"><b>0</b> / ${declared.size} declared</div>
      <div class="face-monitor__worker">font worker: idle</div>
    </div>
    <div class="face-monitor__list">
      <div class="face-monitor__empty">No face downloaded yet.</div>
    </div>
  `;
  document.body.appendChild(root);

  /** Resolve one of the panel's own nodes, built from the markup just above. */
  const part = (selector: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`faceMonitor: missing ${selector}`);
    return el;
  };

  const countEl = part(".face-monitor__count");
  const workerEl = part(".face-monitor__worker");
  const listEl = part(".face-monitor__list");

  const seen = new Set<string>();
  const start = performance.now();

  const addRow = (face: DeclaredFace, bytes: number) => {
    if (seen.size === 1) listEl.innerHTML = "";

    const elapsed = (performance.now() - start) / 1000;
    const sliceLabel = face.slice != null ? ` <em>#${face.slice}</em>` : "";
    // `transferSize` is 0 for cross-origin responses without
    // `Timing-Allow-Origin` (and for cache hits); fall back to the elapsed-time
    // column alone rather than printing a misleading "0 KB".
    const sizeLabel = bytes > 0 ? formatBytes(bytes) : "cached";

    // Name the script the face covers: several subsets of one family look
    // identical otherwise (plain "Noto Sans" ships Latin *and* Devanagari).
    const script = scriptOf(face.unicodeRanges);
    const scriptLabel = script ? ` <i>${script}</i>` : "";

    const row = document.createElement("div");
    row.className = "face-monitor__row face-monitor__row--new";
    row.innerHTML = `
      <div class="face-monitor__name">${face.family} ${face.weight}${scriptLabel}${sliceLabel}</div>
      <div class="face-monitor__size">${sizeLabel}<br>+${elapsed.toFixed(1)}s</div>
      <div class="face-monitor__meta">${formatRanges(face.unicodeRanges)}</div>
    `;
    // Newest first: the face that just arrived is the one being talked about.
    listEl.prepend(row);

    countEl.innerHTML = `<b>${seen.size}</b> / ${declared.size} declared`;
  };

  // Resource entries are delivered to observers independently of the buffer
  // limit, but `buffered: true` replays only what is still in the buffer —
  // raise it so faces fetched before this call are not missed behind tile
  // traffic.
  performance.setResourceTimingBufferSize?.(2000);

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const face = declared.get(entry.name);
      if (!face || seen.has(entry.name)) continue;
      seen.add(entry.name);
      addRow(face, (entry as PerformanceResourceTiming).transferSize ?? 0);
    }
  });
  observer.observe({ type: "resource", buffered: true });

  return {
    /** Feed the engine's own view of the font worker, for a second opinion. */
    setWorkerStats(stats: FontWorkerStats | undefined) {
      workerEl.textContent = stats
        ? `font worker: ${stats.fontCount} files · ${stats.glyphCount} glyphs · ` +
          `${formatBytes(stats.atlasBytes + stats.colorAtlasBytes)} atlas · ` +
          `${formatBytes(stats.fontBytes)} font data`
        : "font worker: idle";
    },
    dispose() {
      observer.disconnect();
      root.remove();
      style.remove();
    },
  };
};
