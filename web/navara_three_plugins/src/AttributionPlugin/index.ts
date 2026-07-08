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
 *       attribution: "Geospatial Information Authority of Japan (GSI)",
 *       url: "https://maps.gsi.go.jp/development/ichiran.html",
 *       children: [
 *         { attribution: "Nationwide latest aerial photos (seamless)", minZoom: 14, maxZoom: 18 },
 *         { attribution: "GRUS画像（© Axelspace）", minZoom: 14, maxZoom: 18 },
 *       ],
 *     },
 *     {
 *       // Per-tile copyright is tracked dynamically by resolving this layer id.
 *       attribution: "Google Maps Photorealistic 3D Tiles",
 *       creditLayerId: photoreal.id,
 *     },
 *     {
 *       attributionHtml:
 *         '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
 *     },
 *   ],
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
  dedupeAttributionItems,
  isAttributionHtml,
  matchesZoom,
  safeHref,
  type AttributionItem,
  type AttributionStyle,
} from "./attribution";
import {
  STYLE_ELEMENT_ID,
  STYLE_TEXT,
  SVG_ICON_HTML,
} from "./attributionStyles";

type View = ThreeView<DefaultDescriptions>;

/** Which bottom corner the attribution UI anchors to. */
export type AttributionPosition = "bottom-left" | "bottom-right";

/** Options for {@link AttributionPlugin}. */
export type AttributionPluginOptions = {
  /** Initial color overrides; tweak later with {@link AttributionPlugin.setStyle}. */
  style?: AttributionStyle;
  /**
   * Bottom corner for the ⓘ trigger and its credit card. Defaults to
   * `"bottom-right"`; use `"bottom-left"` when the bottom-right corner is
   * occupied (e.g. a page with its own HUD there). The logo frame lives in the
   * bottom-left area in both modes; in `"bottom-left"` the ⓘ takes the far-left
   * corner and the logos shift right to sit beside it.
   */
  position?: AttributionPosition;
};

/**
 * Number of live instances using the shared `<style>` element. The style is
 * injected once and removed only when the last instance tears down, so
 * multiple plugins don't duplicate the id or strip each other's styles.
 */
let styleRefCount = 0;

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

  /** Per-layer dynamic credits, keyed by `layer.id`. */
  private layerCredits = new Map<
    string,
    { credits: Map<bigint, string>; visible: Set<bigint> }
  >();
  private layerCleanups: (() => void)[] = [];

  /** Color overrides, applied as CSS custom properties on the dock. */
  private style: AttributionStyle;

  /** Bottom corner for the ⓘ trigger / credit card. */
  private position: AttributionPosition;

  private boundKeydown: (event: KeyboardEvent) => void;
  private boundPreRender: () => void;

  constructor(options: AttributionPluginOptions = {}) {
    super();
    this.style = options.style ?? {};
    this.position = options.position ?? "bottom-right";
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
    // `show()` may have run before init (the plugin is created before
    // `view.init()`); apply any pending items now that the view exists, instead
    // of silently dropping them.
    if (this.items.length) this.apply();
  }

  /**
   * Display the given attributions. Re-invoking replaces the current content
   * (supports dynamic license changes).
   *
   * Sources that declare a `creditLayerId` have that layer's per-feature credits
   * tracked dynamically; the layer is resolved from the view by id, so callers
   * don't pass the `Layer` object separately.
   *
   * Exact-duplicate entries are dropped so several data sources that share one
   * credit (e.g. multiple Overture themes) render a single line, not one each.
   *
   * @param items - Attribution entries (sources or raw HTML credits)
   */
  show(items: AttributionItem[]): void {
    this.items = dedupeAttributionItems(items);
    this.apply();
  }

  /** Resolve/track the current items' credit layers and render. */
  private apply(): void {
    this.trackLayers(this.resolveCreditLayers(this.items));
    this.render();
  }

  /**
   * Resolve the `Layer` objects referenced by sources' `creditLayerId`, deduped
   * by id so a layer referenced by multiple sources is tracked only once.
   */
  private resolveCreditLayers(items: AttributionItem[]): Layer[] {
    const view = this.view;
    if (!view) return [];
    const seen = new Set<string>();
    const layers: Layer[] = [];
    for (const item of items) {
      if (isAttributionHtml(item) || !item.creditLayerId) continue;
      if (seen.has(item.creditLayerId)) continue;
      seen.add(item.creditLayerId);
      const layer = view.findLayerById(item.creditLayerId);
      if (layer) layers.push(layer);
    }
    return layers;
  }

  /** Hide the attribution UI and clear tracked content. */
  hide(): void {
    this.teardownDom();
    this.items = [];
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
    if (this.position === "bottom-left") {
      dock.classList.add("navara-attr-dock--left");
    }

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
    toggle.addEventListener("click", () => this.setOpen());

    dock.appendChild(card);
    dock.appendChild(toggle);
    document.body.appendChild(dock);

    // Always-visible logo frame in the separate bottom-left corner, so
    // contractually-mandated marks stay visible independent of the popover.
    const logoFrame = document.createElement("div");
    logoFrame.className = "navara-attr-logoframe";
    // In bottom-left mode the ⓘ trigger sits at the far left, so shift the logo
    // frame right of it to keep them in one row instead of overlapping.
    if (this.position === "bottom-left") {
      logoFrame.classList.add("navara-attr-logoframe--left");
    }
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
   * `children` plus the dynamic credits of the layer it links via
   * `creditLayerId` — as a nested list.
   */
  private populateList(): void {
    if (!this.listEl) return;
    this.listEl.replaceChildren();

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

      // Sub-credits: zoom-banded static children, then the linked layer's
      // dynamic credits. Both go through the sanitizer so embedded `<a>` links
      // stay clickable while scripts/handlers from untrusted tile metadata are
      // dropped to text.
      const sub = document.createElement("ul");
      sub.className = "navara-attr-related";
      if (item.children) {
        for (const child of item.children) {
          if (!matchesZoom(child, this.lastZoomLevel)) continue;
          const childLi = document.createElement("li");
          appendSanitizedHtml(childLi, child.attribution);
          sub.appendChild(childLi);
        }
      }
      if (item.creditLayerId) {
        for (const credit of this.layerCreditStrings(item.creditLayerId)) {
          const creditLi = document.createElement("li");
          appendSanitizedHtml(creditLi, credit);
          sub.appendChild(creditLi);
        }
      }

      if (sub.childElementCount > 0) li.appendChild(sub);

      this.listEl.appendChild(li);
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

      // Link the logo only when the source declares a (safe) `logoUrl`, opened in
      // a new tab. A mark that must be shown but not turned into a link omits
      // `logoUrl` and stays a plain `<img>`.
      const href = item.logoUrl ? safeHref(item.logoUrl) : undefined;
      let node: HTMLElement = img;
      if (href) {
        node = createSafeAnchor(href);
        node.appendChild(img);
      }
      this.logosEl.appendChild(node);
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
    // On open, refresh once: the per-frame zoom poll is skipped while closed,
    // so the zoom band may be stale.
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
   * Subscribe to the given layers' feature events and merge per-feature credits
   * into the rendered list as features appear / disappear. Detaches any
   * previously registered listeners first, so repeated `show()` calls don't leak.
   */
  private trackLayers(layers: Layer[]): void {
    for (const off of this.layerCleanups) off();
    this.layerCleanups = [];
    this.layerCredits.clear();

    for (const layer of layers) {
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
      // Assigned below; declared first so `onDeleted` can reference it.
      let detach = () => {};
      // `deleted` fires once for the layer (no per-feature `featureRemoved`).
      // Fully release the layer — drop its credits entry and detach its
      // listeners (and this cleanup) — so a deleted layer doesn't linger until
      // the next show()/hide()/dispose().
      const onDeleted = () => {
        detach();
        this.layerCleanups = this.layerCleanups.filter((c) => c !== detach);
        this.layerCredits.delete(layer.id);
        this.requestRender();
      };
      detach = () => {
        layer.off("featureCreated", onCreated);
        layer.off("featureRemoved", onRemoved);
        layer.off("featureVisibilityChanged", onVisibility);
        layer.off("deleted", onDeleted);
      };

      layer.on("featureCreated", onCreated);
      layer.on("featureRemoved", onRemoved);
      layer.on("featureVisibilityChanged", onVisibility);
      layer.on("deleted", onDeleted);
      this.layerCleanups.push(detach);
    }
  }
}
