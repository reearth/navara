/**
 * Attribution data model and framework-agnostic helpers.
 *
 * This module has **no `@navara/three` dependency** so the pure logic (type
 * guards, zoom-band matching, HTML sanitization) is unit-testable without
 * loading the engine. The `AttributionPlugin` class composes these.
 */

/**
 * A single zoom-banded child credit. The band `[minZoom, maxZoom]` is matched
 * against the current camera zoom to decide whether this credit is shown.
 * Omitting a bound means unbounded on that side.
 */
export type AttributionChild = {
  /** Credit text. May contain partial `<a>` links. */
  title: string;
  /** Inclusive lower zoom bound. Unbounded when omitted. */
  minZoom?: number;
  /** Inclusive upper zoom bound. Unbounded when omitted. */
  maxZoom?: number;
};

/** A data source shown at the top level, optionally with zoom-banded children. */
export type AttributionSource = {
  /** Data source / title text. */
  attribution: string;
  /** Optional URL. Rendered as an `<a>`. */
  url?: string;
  /**
   * Optional logo image URL. When set, the logo is shown in an always-visible
   * frame in the bottom-left corner, independent of the popover's open state —
   * as required for contractually-mandated marks (Google, Cesium ion, etc.).
   */
  logo?: string;
  /** Zoom-banded child credits, filtered by current camera zoom. */
  children?: AttributionChild[];
};

/** A raw HTML credit with partial links, rendered as-is (after sanitization). */
export type AttributionHtml = {
  /** Credit HTML containing partial `<a>` links. */
  attributionHtml: string;
};

/** An attribution entry: either a structured source or a raw HTML credit. */
export type AttributionItem = AttributionSource | AttributionHtml;

/** Type guard distinguishing a raw HTML credit from a structured source. */
export function isAttributionHtml(
  item: AttributionItem,
): item is AttributionHtml {
  return "attributionHtml" in item;
}

/**
 * Aggregate `;`-separated credit strings (e.g. a 3D-tile's `asset.copyright`)
 * into a deduplicated list, ordered by frequency (desc) with an alphabetical
 * tie-break for stable, flicker-free ordering across updates.
 */
export function aggregateCredits(creditStrings: Iterable<string>): string[] {
  const counts = new Map<string, number>();
  for (const raw of creditStrings) {
    for (const part of raw.split(";")) {
      const credit = part.trim();
      if (!credit) continue;
      counts.set(credit, (counts.get(credit) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([credit]) => credit);
}

/**
 * Whether a child credit applies at the given integer zoom level. A missing
 * bound is unbounded on that side; a missing level (undef) matches everything.
 */
export function matchesZoom(
  child: AttributionChild,
  level: number | undefined,
): boolean {
  if (level === undefined) return true;
  if (child.minZoom !== undefined && level < child.minZoom) return false;
  if (child.maxZoom !== undefined && level > child.maxZoom) return false;
  return true;
}

/**
 * Returns `href` if it points to a safe location (http / https / mailto, or a
 * relative URL), otherwise `undefined`. Blocks code-executing schemes such as
 * `javascript:` and `data:` to prevent XSS via attribution links.
 */
export function safeHref(href: string): string | undefined {
  let url: URL;
  try {
    // A fixed base resolves relative URLs; only the scheme matters here.
    url = new URL(href, "http://localhost/");
  } catch {
    return undefined;
  }
  if (
    url.protocol === "http:" ||
    url.protocol === "https:" ||
    url.protocol === "mailto:"
  ) {
    return href;
  }
  return undefined;
}

/**
 * Append a credit HTML string to `target`, allowing only `<a href>` elements
 * with a safe scheme. Other tags (and unsafe links) are dropped while keeping
 * their (sanitized) text content. Surviving links get `target="_blank"` and
 * `rel="noopener noreferrer"`.
 */
export function appendSanitizedHtml(target: Node, html: string): void {
  // Parse without a wrapper element: a wrapper would be closed early by a
  // stray `</span>` in the input, dropping the nodes parsed after it (and thus
  // silently omitting credits). Sanitizing the whole body keeps every node.
  const doc = new DOMParser().parseFromString(html, "text/html");
  appendSanitizedChildren(target, doc.body);
}

function appendSanitizedChildren(target: Node, source: Node): void {
  source.childNodes.forEach((node) => {
    if (node instanceof Text) {
      target.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (node instanceof HTMLAnchorElement) {
      const raw = node.getAttribute("href");
      const href = raw ? safeHref(raw) : undefined;
      if (!href) {
        // Unsafe / missing href: drop the link, keep its text.
        appendSanitizedChildren(target, node);
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      appendSanitizedChildren(anchor, node);
      target.appendChild(anchor);
      return;
    }
    if (node instanceof Element) {
      // Drop the tag, keep its sanitized contents.
      appendSanitizedChildren(target, node);
    }
  });
}
