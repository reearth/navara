/**
 * AttributionPlugin — Navara Plugin for map data attribution (credit) UI.
 *
 * Renders a non-modal popover (bottom-right ⓘ trigger) listing data-source
 * attributions, with a separate always-visible logo frame in the bottom-left
 * corner. Each source can carry zoom-banded child credits that switch as the
 * camera zooms, and per-layer feature credits are tracked dynamically.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import { AttributionPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container });
 * const attribution = new AttributionPlugin();
 * view.addPlugin(attribution);
 * await view.init();
 *
 * // A 3D-tiles layer whose tiles embed their own copyright (tracked dynamically).
 * const photoreal = view.addLayer({ type: "cesium3dtiles", data: { url } });
 *
 * attribution.show(
 *   [
 *     {
 *       attribution: "国土地理院",
 *       url: "https://maps.gsi.go.jp/development/ichiran.html",
 *       children: [
 *         { title: "全国最新写真（シームレス）", minZoom: 14, maxZoom: 18 },
 *         { title: "全国ランドサットモザイク画像", minZoom: 9, maxZoom: 13 },
 *       ],
 *     },
 *     {
 *       attribution: "Google Maps Photorealistic 3D Tiles",
 *       creditLayerId: photoreal.id,
 *     },
 *     {
 *       attributionHtml:
 *         '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
 *     },
 *   ],
 *   [photoreal],
 * );
 *
 * // Re-theme at runtime (e.g. light / dark switch).
 * attribution.setStyle({ backgroundColor: "#14181c", textColor: "#e6e9ee" });
 *
 * attribution.hide();
 * attribution.dispose();
 * ```
 */
import ThreeView, {
  Plugin,
  type Layer,
  type FeatureCreatedParams,
  type FeatureRemovedParams,
  type FeatureVisibilityChangedParams,
  type ViewContext,
} from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

import {
  aggregateCredits,
  appendSanitizedHtml,
  createSafeAnchor,
  isAttributionHtml,
  matchesZoom,
  safeHref,
  type AttributionItem,
  type AttributionStyle,
} from "./attribution";

type View = ThreeView<DefaultDescriptions>;

/** Options for {@link AttributionPlugin}. */
export type AttributionPluginOptions = {
  /** Initial color overrides; tweak later with {@link AttributionPlugin.setStyle}. */
  style?: AttributionStyle;
};

/**
 * ⓘ trigger icon as a markup string, inserted via `innerHTML` so the icon can
 * be swapped in one place. `currentColor` makes it follow the button's color.
 */
const SVG_ICON_HTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="2" />
  <circle cx="12" cy="8" r="1" fill="currentColor" />
  <rect x="11" y="11" width="2" height="6" rx="1" fill="currentColor" />
</svg>`;

const STYLE_ELEMENT_ID = "navara-attribution-styles";

/**
 * Number of live instances using the shared `<style>` element. The style is
 * injected once and removed only when the last instance tears down, so
 * multiple plugins don't duplicate the id or strip each other's styles.
 */
let styleRefCount = 0;

const STYLE_TEXT = `
.navara-attr-dock {
  position: fixed;
  right: 8px;
  bottom: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  font-family: system-ui, sans-serif;
}
.navara-attr-logoframe {
  position: fixed;
  left: 8px;
  bottom: 8px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}
.navara-attr-logo {
  height: 24px;
  width: auto;
  display: block;
  user-select: none;
}
.navara-attr-toggle {
  width: 24px;
  height: 24px;
  min-width: 24px;
  padding: 0;
  border-radius: 50%;
  cursor: pointer;
  background: var(--nvr-attr-bg, rgba(252, 253, 254, 0.92));
  border: 1px solid var(--nvr-attr-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 2px 8px rgba(20, 24, 28, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nvr-attr-link, #3a6595);
}
.navara-attr-toggle svg {
  width: 16px;
  height: 16px;
  display: block;
}
.navara-attr-card {
  width: 280px;
  max-width: calc(100vw - 16px);
  max-height: 340px;
  overflow-y: auto;
  background: var(--nvr-attr-bg, rgba(252, 253, 254, 0.96));
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(20, 24, 28, 0.16);
  color: var(--nvr-attr-text, #1b1f24);
}
.navara-attr-card[hidden] {
  display: none;
}
.navara-attr-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--nvr-attr-border, rgba(0, 0, 0, 0.08));
}
.navara-attr-head h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--nvr-attr-title, inherit);
}
.navara-attr-close {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  color: var(--nvr-attr-nested, rgba(27, 31, 36, 0.64));
  padding: 2px 4px;
}
.navara-attr-list {
  list-style: none;
  margin: 0;
  padding: 12px;
}
.navara-attr-item + .navara-attr-item {
  margin-top: 15px;
}
.navara-attr-name {
  display: flex;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.navara-attr-bullet {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nvr-attr-bullet, #3a6595);
  flex: none;
  margin-top: 6px;
}
.navara-attr-related {
  list-style: none;
  margin: 5px 0 0 13px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.navara-attr-related li {
  font-size: 12px;
  color: var(--nvr-attr-nested, rgba(27, 31, 36, 0.64));
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.navara-attr-card a {
  color: var(--nvr-attr-link, #3a6595);
  text-decoration: none;
}
.navara-attr-card a:hover {
  text-decoration: underline;
}
`;

/**
 * Renders map data attributions as a non-modal popover (bottom-right ⓘ
 * trigger). Top-level sources can carry nested, optionally zoom-banded child
 * credits.
 *
 * Register via `view.addPlugin(plugin)` **before** `view.init()`.
 */
export class AttributionPlugin extends Plugin<View, ViewContext> {
  private view?: View;
  private items: AttributionItem[] = [];
  private layers: Layer[] = [];

  private styleEl?: HTMLStyleElement;
  private dock?: HTMLDivElement;
  private card?: HTMLDivElement;
  private listEl?: HTMLUListElement;
  private logosEl?: HTMLDivElement;
  private toggle?: HTMLButtonElement;
  private isOpen = false;

  /** Last computed integer zoom level. Used to skip no-op re-renders. */
  private lastZoomLevel?: number;
  /** Whether any source has zoom-banded children — gates the per-frame poll. */
  private hasZoomBands = false;

  /** Per-layer dynamic credits (Phase 4), keyed by `layer.id`. */
  private layerCredits = new Map<
    string,
    { credits: Map<bigint, string>; visible: Set<bigint> }
  >();
  private layerCleanups: (() => void)[] = [];

  /** Color overrides, applied as CSS custom properties on the dock. */
  private style: AttributionStyle;

  private boundKeydown: (event: KeyboardEvent) => void;
  private boundPreRender: () => void;

  constructor(options: AttributionPluginOptions = {}) {
    super();
    this.style = options.style ?? {};
    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundPreRender = this.handlePreRender.bind(this);
  }

  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;
    // Recompute the zoom level on render. `fovy` is undefined until the first
    // frame, so a camera `moveend` alone would miss the initial value on a
    // static map; `preRender` reliably fires while the scene renders. The
    // level-change gate in `handlePreRender` keeps this from churning the DOM.
    view.on("preRender", this.boundPreRender);
  }

  /**
   * Display the given attributions. Re-invoking replaces the current content
   * (supports dynamic license changes).
   *
   * @param items - Attribution entries (sources or raw HTML credits)
   * @param layers - Layers whose per-feature credits are tracked dynamically
   */
  show(items: AttributionItem[], layers: Layer[] = []): void {
    this.items = items;
    this.layers = layers;
    this.trackLayers();
    this.render();
  }

  /** Hide the attribution UI and clear tracked content. */
  hide(): void {
    this.teardownDom();
    this.items = [];
    this.layers = [];
  }

  /** Release all DOM nodes, camera listeners, and layer listeners. */
  dispose(): void {
    this.view?.off("preRender", this.boundPreRender);
    this.hide();
    this.view = undefined;
  }

  /**
   * Update the UI colors. Merges over the current style and re-themes the live
   * DOM in place (no rebuild), so it suits runtime switches like light ⇄ dark.
   */
  setStyle(style: AttributionStyle): void {
    this.style = { ...this.style, ...style };
    this.applyStyle();
  }

  /** Push the current style onto the dock as CSS custom properties. */
  private applyStyle(): void {
    const dock = this.dock;
    if (!dock) return;
    const set = (name: string, value: string | undefined): void => {
      if (value !== undefined) dock.style.setProperty(name, value);
    };
    set("--nvr-attr-title", this.style.titleColor);
    set("--nvr-attr-link", this.style.linkColor);
    set("--nvr-attr-bullet", this.style.listStyleColor);
    set("--nvr-attr-text", this.style.textColor);
    set("--nvr-attr-nested", this.style.nestedTextColor);
    set("--nvr-attr-bg", this.style.backgroundColor);
    set("--nvr-attr-border", this.style.borderColor);
  }

  /**
   * Build / refresh the popover DOM from `this.items`, filtering zoom-banded
   * children by the current camera zoom.
   */
  private render(): void {
    if (!this.view) return;
    this.ensureDom();
    this.hasZoomBands = this.items.some(
      (item) =>
        !isAttributionHtml(item) &&
        (item.children?.some(
          (c) => c.minZoom !== undefined || c.maxZoom !== undefined,
        ) ??
          false),
    );
    this.lastZoomLevel = this.currentZoomLevel();
    this.populateList();
    this.populateLogos();
  }

  /** Create the dock DOM and inject (or reuse) the shared styles. */
  private ensureDom(): void {
    if (!this.styleEl) {
      // Reuse a shared style element if another instance already injected it,
      // and count this instance as an owner (removed on the last teardown).
      const existing = document.getElementById(STYLE_ELEMENT_ID);
      if (existing instanceof HTMLStyleElement) {
        this.styleEl = existing;
      } else {
        const style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        style.textContent = STYLE_TEXT;
        document.head.appendChild(style);
        this.styleEl = style;
      }
      styleRefCount += 1;
    }
    if (this.dock) return;

    const dock = document.createElement("div");
    dock.className = "navara-attr-dock";

    const card = document.createElement("div");
    card.className = "navara-attr-card";
    card.hidden = true;

    const head = document.createElement("div");
    head.className = "navara-attr-head";
    const title = document.createElement("h3");
    title.textContent = "Attributions";
    const close = document.createElement("button");
    close.className = "navara-attr-close";
    close.type = "button";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => this.setOpen(false));
    head.appendChild(title);
    head.appendChild(close);

    const list = document.createElement("ul");
    list.className = "navara-attr-list";

    card.appendChild(head);
    card.appendChild(list);

    const toggle = document.createElement("button");
    toggle.className = "navara-attr-toggle";
    toggle.type = "button";
    toggle.innerHTML = SVG_ICON_HTML;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Show attributions");
    toggle.addEventListener("click", () => this.setOpen(this.card?.hidden));

    dock.appendChild(card);
    dock.appendChild(toggle);
    document.body.appendChild(dock);

    // Always-visible logo frame in the separate bottom-left corner, so
    // contractually-mandated marks stay visible independent of the popover.
    const logoFrame = document.createElement("div");
    logoFrame.className = "navara-attr-logoframe";
    document.body.appendChild(logoFrame);

    document.addEventListener("keydown", this.boundKeydown);

    this.dock = dock;
    this.card = card;
    this.listEl = list;
    this.logosEl = logoFrame;
    this.toggle = toggle;
    this.applyStyle();
  }

  /** Create a bullet list item, returning the `<li>` and its text `<span>`. */
  private createItemShell(): { li: HTMLLIElement; text: HTMLSpanElement } {
    const li = document.createElement("li");
    li.className = "navara-attr-item";
    const name = document.createElement("div");
    name.className = "navara-attr-name";
    const bullet = document.createElement("span");
    bullet.className = "navara-attr-bullet";
    name.appendChild(bullet);
    const text = document.createElement("span");
    name.appendChild(text);
    li.appendChild(name);
    return { li, text };
  }

  /**
   * Rebuild the list. Each source shows its sub-credits — zoom-filtered static
   * `children` plus any tracked layer's dynamic credits — as a nested list.
   * Layers whose id no source declared via `creditLayerId` fall back to flat
   * top-level credits.
   */
  private populateList(): void {
    if (!this.listEl) return;
    this.listEl.replaceChildren();
    const matchedLayerIds = new Set<string>();

    for (const item of this.items) {
      const { li, text } = this.createItemShell();

      if (isAttributionHtml(item)) {
        appendSanitizedHtml(text, item.attributionHtml);
        this.listEl.appendChild(li);
        continue;
      }

      const href = item.url ? safeHref(item.url) : undefined;
      if (href) {
        text.appendChild(createSafeAnchor(href, item.attribution));
      } else {
        text.textContent = item.attribution;
      }

      // Collect this source's sub-credits into one list: static zoom-banded
      // children followed by dynamic per-layer credits. Both go through the
      // sanitizer so embedded `<a>` links stay clickable — it allows only
      // safe-scheme anchors and drops everything else (incl. untrusted tile
      // metadata's scripts/handlers) to text, so it is safe for both sources.
      const sub = document.createElement("ul");
      sub.className = "navara-attr-related";
      if (item.children) {
        for (const child of item.children) {
          if (!matchesZoom(child, this.lastZoomLevel)) continue;
          const childLi = document.createElement("li");
          appendSanitizedHtml(childLi, child.title);
          sub.appendChild(childLi);
        }
      }
      if (item.creditLayerId) {
        matchedLayerIds.add(item.creditLayerId);
        for (const credit of this.layerCreditStrings(item.creditLayerId)) {
          const creditLi = document.createElement("li");
          appendSanitizedHtml(creditLi, credit);
          sub.appendChild(creditLi);
        }
      }

      if (sub.childElementCount > 0) li.appendChild(sub);

      this.listEl.appendChild(li);
    }

    // Unmatched layers (no source declared their `creditLayerId`) fall back to flat.
    for (const layerId of this.layerCredits.keys()) {
      if (matchedLayerIds.has(layerId)) continue;
      for (const credit of this.layerCreditStrings(layerId)) {
        const { li, text } = this.createItemShell();
        appendSanitizedHtml(text, credit);
        this.listEl.appendChild(li);
      }
    }
  }

  /** Aggregated, deduped credit strings for a tracked layer's visible features. */
  private layerCreditStrings(layerId: string): string[] {
    const state = this.layerCredits.get(layerId);
    if (!state) return [];
    const strings: string[] = [];
    for (const id of state.visible) {
      const credit = state.credits.get(id);
      if (credit) strings.push(credit);
    }
    return aggregateCredits(strings);
  }

  /**
   * Rebuild the list if the popover is open; while closed, do nothing —
   * `setOpen()` repopulates on open, so deferred updates are picked up then.
   */
  private requestRender(): void {
    if (this.dock && this.isOpen) this.populateList();
  }

  /** Rebuild the always-visible logo frame from sources that declare a `logo`. */
  private populateLogos(): void {
    if (!this.logosEl) return;
    this.logosEl.replaceChildren();

    for (const item of this.items) {
      if (isAttributionHtml(item) || !item.logo) continue;
      const img = document.createElement("img");
      img.src = item.logo;
      img.alt = item.attribution;
      img.className = "navara-attr-logo";
      img.draggable = false;
      this.logosEl.appendChild(img);
    }
  }

  /** Open / close the popover. Non-modal: no backdrop is added. */
  private setOpen(open?: boolean): void {
    if (!this.card || !this.toggle) return;
    this.isOpen = open ?? !this.isOpen;
    this.card.hidden = !this.isOpen;
    this.toggle.setAttribute("aria-expanded", String(this.isOpen));
    // Keep the accessible name in sync with what activating the button does.
    this.toggle.setAttribute(
      "aria-label",
      this.isOpen ? "Hide attributions" : "Show attributions",
    );
    // On open, refresh once: the per-frame zoom poll is skipped while closed, so
    // the zoom band (and any render deferred via `dirty`) may be stale.
    if (this.isOpen) {
      if (this.hasZoomBands) this.lastZoomLevel = this.currentZoomLevel();
      this.populateList();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isOpen) this.setOpen(false);
  }

  /**
   * Recompute the zoom and, only when the integer level changed, re-render the
   * list (a "quiet" update — no flicker, no animation). Called on every
   * `preRender`; the level-change gate makes it a no-op unless the band changes.
   */
  private handlePreRender(): void {
    // Poll only while the popover is open and a source has zoom bands. The
    // `camera.zoom` poll crosses the WASM boundary, so skipping it while closed
    // (or when nothing is zoom-banded) avoids per-frame overhead for users who
    // never open the UI; `setOpen()` refreshes the level on open.
    if (!this.dock || !this.hasZoomBands || !this.isOpen) return;
    const level = this.currentZoomLevel();
    if (level === this.lastZoomLevel) return;
    this.lastZoomLevel = level;
    this.requestRender();
  }

  /**
   * Current integer Web Mercator zoom level. The engine computes the fractional
   * zoom (altitude/FOV/viewport) in Rust via `camera.zoom`; floor it to a tile
   * level for band matching. `undefined` (e.g. before the first frame) shows all
   * bands.
   */
  private currentZoomLevel(): number | undefined {
    const z = this.view?.camera.zoom;
    return z === undefined ? undefined : Math.floor(z);
  }

  /**
   * Remove this instance's DOM nodes, document + layer listeners, and state.
   * The shared style element is removed only when the last instance tears down.
   */
  private teardownDom(): void {
    for (const off of this.layerCleanups) off();
    this.layerCleanups = [];

    if (this.dock) {
      document.removeEventListener("keydown", this.boundKeydown);
      this.dock.remove();
    }
    this.logosEl?.remove();
    if (this.styleEl) {
      // Only remove the shared style when the last owning instance tears down.
      styleRefCount = Math.max(0, styleRefCount - 1);
      if (styleRefCount === 0) this.styleEl.remove();
    }
    this.dock = undefined;
    this.card = undefined;
    this.listEl = undefined;
    this.logosEl = undefined;
    this.toggle = undefined;
    this.styleEl = undefined;
    this.isOpen = false;

    this.layerCredits.clear();
  }

  /**
   * Subscribe to layer feature events and merge per-feature credits into the
   * rendered list as features appear / disappear. Detaches any previously
   * registered listeners first, so repeated `show()` calls don't leak.
   */
  private trackLayers(): void {
    for (const off of this.layerCleanups) off();
    this.layerCleanups = [];
    this.layerCredits.clear();

    for (const layer of this.layers) {
      const state = {
        credits: new Map<bigint, string>(),
        visible: new Set<bigint>(),
      };
      this.layerCredits.set(layer.id, state);

      // Track only features that actually carry a credit: layers can emit many
      // credit-less features (e.g. PLATEAU), and tracking them would grow these
      // sets unbounded and churn the UI with no visible effect.
      const onCreated = ({ featureSetId, credit }: FeatureCreatedParams) => {
        if (!credit) return;
        state.credits.set(featureSetId, credit);
        state.visible.add(featureSetId);
        this.requestRender();
      };
      const onRemoved = ({ featureSetId }: FeatureRemovedParams) => {
        if (!state.credits.has(featureSetId)) return;
        state.credits.delete(featureSetId);
        state.visible.delete(featureSetId);
        this.requestRender();
      };
      const onVisibility = ({
        featureSetId,
        visible,
      }: FeatureVisibilityChangedParams) => {
        if (!state.credits.has(featureSetId)) return;
        if (visible) state.visible.add(featureSetId);
        else state.visible.delete(featureSetId);
        this.requestRender();
      };
      // `deleted` fires once for the layer (no per-feature `featureRemoved`),
      // so clear all of this layer's tracked credits.
      const onDeleted = () => {
        if (state.credits.size === 0) return;
        state.credits.clear();
        state.visible.clear();
        this.requestRender();
      };

      layer.on("featureCreated", onCreated);
      layer.on("featureRemoved", onRemoved);
      layer.on("featureVisibilityChanged", onVisibility);
      layer.on("deleted", onDeleted);
      this.layerCleanups.push(() => {
        layer.off("featureCreated", onCreated);
        layer.off("featureRemoved", onRemoved);
        layer.off("featureVisibilityChanged", onVisibility);
        layer.off("deleted", onDeleted);
      });
    }
  }
}
