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

/**
 * A data source shown at the top level. It may carry zoom-banded `children`, a
 * mandated `logo`, and dynamic per-layer credits linked via `creditLayerId`.
 */
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
  /**
   * Optional id (`layer.id`) of the tracked layer whose per-feature credits are
   * nested under this source (instead of listed flat). Named `creditLayerId`
   * rather than `layerId` because "layer" alone is ambiguous in this project.
   * A plain string (not a `Layer`) keeps `attribution.ts` engine-free.
   */
  creditLayerId?: string;
};

/**
 * Customizable colors for the attribution UI. Every field is optional; an unset
 * field keeps the built-in default. Applied as CSS custom properties, so
 * {@link AttributionPlugin.setStyle} can re-theme live (e.g. light ⇄ dark)
 * without rebuilding the DOM.
 */
export type AttributionStyle = {
  /** Source title text color. */
  titleColor?: string;
  /** Link (`<a>`) and info-icon color. */
  linkColor?: string;
  /** Bullet (list marker) color. */
  listStyleColor?: string;
  /** Body text color. */
  textColor?: string;
  /** Nested sub-credit text color. */
  nestedTextColor?: string;
  /** Popover and trigger background color. */
  backgroundColor?: string;
  /** Header divider (border) color — useful for dark themes. */
  borderColor?: string;
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
 *
 * The `;` split is **HTML-aware** (see {@link splitCredits}): a `;` inside an
 * `<a href>` or an HTML entity is never treated as a delimiter, so attribution
 * URLs and links are preserved verbatim — a license notice must not be altered.
 */
export function aggregateCredits(creditStrings: Iterable<string>): string[] {
  const counts = new Map<string, number>();
  for (const raw of creditStrings) {
    for (const credit of splitCredits(raw)) {
      counts.set(credit, (counts.get(credit) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([credit]) => credit);
}

/** Escape text so it round-trips faithfully back through HTML parsing. */
function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Split a raw credit on the `;` delimiter (the glTF / Cesium `asset.copyright`
 * convention) **without breaking HTML**. The string is parsed first, so a `;`
 * inside an `<a href>` or an HTML entity is not a delimiter and links / URLs
 * stay intact. Each returned segment is a trimmed HTML string (empties
 * dropped); plain-text segments are escaped so they survive re-parsing.
 *
 * Note: a literal `;` in plain (non-HTML) text is still a delimiter — the
 * convention can't represent a credit that itself contains an unescaped `;`.
 */
function splitCredits(raw: string): string[] {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const segments: string[] = [];
  let current = "";
  const flush = (): void => {
    const trimmed = current.trim();
    if (trimmed) segments.push(trimmed);
    current = "";
  };
  const walk = (parent: Node): void => {
    parent.childNodes.forEach((node) => {
      if (node instanceof Text) {
        const parts = (node.textContent ?? "").split(";");
        parts.forEach((part, i) => {
          if (i > 0) flush();
          current += escapeHtmlText(part);
        });
        return;
      }
      if (node instanceof HTMLAnchorElement) {
        // Keep `<a>` atomic so a `;` inside its href/text isn't a delimiter.
        current += node.outerHTML;
        return;
      }
      if (node instanceof Element) {
        // Other tags are dropped by the sanitizer anyway — recurse into their
        // children so a `;` inside still splits and the tag doesn't end up in
        // the dedup key.
        walk(node);
      }
    });
  };
  walk(doc.body);
  flush();
  return segments;
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
 * Create an `<a>` for an already-validated safe href with the standard
 * external-link attributes. Centralizes `target`/`rel` so no call site forgets
 * them. Pass `text` to set the visible label (omit to fill children manually).
 */
export function createSafeAnchor(
  href: string,
  text?: string,
): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  if (text !== undefined) anchor.textContent = text;
  return anchor;
}

/**
 * Append a credit HTML string to `target`, allowing only `<a href>` elements
 * with a safe scheme. Other tags (and unsafe links) are dropped while keeping
 * their (sanitized) text content. Surviving links get `target="_blank"` and
 * `rel="noopener noreferrer"`. Bare `http(s)` URLs in text are auto-linked too,
 * so an official notice can be pasted verbatim without hand-wrapping its URL.
 */
export function appendSanitizedHtml(target: Node, html: string): void {
  // Parse without a wrapper element: a wrapper would be closed early by a
  // stray `</span>` in the input, dropping the nodes parsed after it (and thus
  // silently omitting credits). Sanitizing the whole body keeps every node.
  const doc = new DOMParser().parseFromString(html, "text/html");
  appendSanitizedChildren(target, doc.body);
}

function appendSanitizedChildren(
  target: Node,
  source: Node,
  autolink = true,
): void {
  source.childNodes.forEach((node) => {
    if (node instanceof Text) {
      // Inside an existing `<a>`, emit plain text — never nest a link.
      if (autolink) appendTextWithLinks(target, node.textContent ?? "");
      else target.appendChild(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (node instanceof HTMLAnchorElement) {
      const raw = node.getAttribute("href");
      const href = raw ? safeHref(raw) : undefined;
      if (!href) {
        // Unsafe / missing href: drop the link, keep its text.
        appendSanitizedChildren(target, node, autolink);
        return;
      }
      const anchor = createSafeAnchor(href);
      appendSanitizedChildren(anchor, node, false);
      target.appendChild(anchor);
      return;
    }
    if (node instanceof Element) {
      // Drop the tag, keep its sanitized contents.
      appendSanitizedChildren(target, node, autolink);
    }
  });
}

/** Matches an explicit http(s) URL, used to auto-link bare URLs in credit text. */
const BARE_URL_PATTERN = /https?:\/\/[^\s]+/g;
/** Trailing punctuation kept outside an auto-linked URL (e.g. a closing paren). */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * Append `text` to `target`, turning bare http(s) URLs into links. This lets an
 * attribution be pasted verbatim (no hand-inserted `<a>`, which would itself
 * edit the notice) while its URL stays both faithful and clickable: the URL
 * text is preserved exactly and only trailing sentence punctuation is left out.
 */
function appendTextWithLinks(target: Node, text: string): void {
  let lastIndex = 0;
  for (const match of text.matchAll(BARE_URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION);
    if (trailing) url = url.slice(0, url.length - trailing[0].length);
    if (start > lastIndex) {
      target.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }
    const href = safeHref(url);
    if (href) {
      target.appendChild(createSafeAnchor(href, url));
    } else {
      target.appendChild(document.createTextNode(url));
    }
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) {
    target.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}
