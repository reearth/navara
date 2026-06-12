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
 * import { DefaultPlugin } from "@navara/three_default_plugin";
 * import { AttributionPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container });
 * const attribution = new AttributionPlugin();
 *
 * view.addPlugin(attribution);
 * await view.init();
 *
 * const layer = view.addLayer({ ... });
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
 *     { attributionHtml: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a>' },
 *   ],
 *   [layer],
 * );
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
  isAttributionHtml,
  matchesZoom,
  safeHref,
  type AttributionItem,
} from "./attribution";

type View = ThreeView<DefaultDescriptions>;

const STYLE_ELEMENT_ID = "navara-attribution-styles";

/**
 * Number of live instances using the shared `<style>` element. The style is
 * injected once and removed only when the last instance tears down, so
 * multiple plugins don't duplicate the id or strip each other's styles.
 */
let styleRefCount = 0;

/** Earth circumference at the equator (meters) and tile size (px) for the
 * web-mercator zoom approximation. */
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE_PX = 256;

const STYLE_TEXT = `
.navara-attr-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  font-family: system-ui, -apple-system, "Hiragino Kaku Gothic ProN", sans-serif;
}
.navara-attr-logoframe {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}
.navara-attr-logo {
  height: 26px;
  width: auto;
  display: block;
  user-select: none;
}
.navara-attr-toggle {
  width: 38px;
  height: 38px;
  min-width: 38px;
  border-radius: 50%;
  cursor: pointer;
  background: rgba(252, 253, 254, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(20, 24, 28, 0.16);
  font-size: 18px;
  line-height: 1;
  color: #3a6595;
}
.navara-attr-card {
  width: min(300px, calc(100vw - 32px));
  max-height: 340px;
  overflow-y: auto;
  background: rgba(252, 253, 254, 0.96);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(20, 24, 28, 0.16);
  color: #1b1f24;
}
.navara-attr-card[hidden] {
  display: none;
}
.navara-attr-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.navara-attr-head h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}
.navara-attr-close {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  color: rgba(27, 31, 36, 0.64);
  padding: 2px 4px;
}
.navara-attr-list {
  list-style: none;
  margin: 0;
  padding: 8px 16px 14px;
}
.navara-attr-item + .navara-attr-item {
  margin-top: 15px;
}
.navara-attr-name {
  display: flex;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}
.navara-attr-bullet {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3a6595;
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
  color: rgba(27, 31, 36, 0.64);
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.navara-attr-card a {
  color: #3a6595;
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

  /** Per-feature credits tracked from layers (Phase 4). */
  private dynamicCredits = new Map<bigint, string>();
  private visibleFeatures = new Set<bigint>();
  private dynamicItems: HTMLElement[] = [];
  private layerCleanups: (() => void)[] = [];

  private boundKeydown: (event: KeyboardEvent) => void;
  private boundPreRender: () => void;

  constructor() {
    super();
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
   * Build / refresh the popover DOM from `this.items`, filtering zoom-banded
   * children by the current camera zoom.
   */
  private render(): void {
    if (!this.view) return;
    this.ensureDom();
    this.lastZoomLevel = this.currentZoomLevel();
    this.populateList();
    this.populateLogos();
    this.refreshDynamicCredits();
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
    close.setAttribute("aria-label", "閉じる");
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
    toggle.textContent = "ⓘ";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "出典を表示");
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

  /** Rebuild the static list contents from `this.items`. */
  private populateList(): void {
    if (!this.listEl) return;
    this.listEl.replaceChildren();

    for (const item of this.items) {
      const { li, text } = this.createItemShell();

      const url = isAttributionHtml(item) ? undefined : item.url;
      const href = url ? safeHref(url) : undefined;
      if (isAttributionHtml(item)) {
        appendSanitizedHtml(text, item.attributionHtml);
      } else if (href) {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = item.attribution;
        text.appendChild(anchor);
      } else {
        text.textContent = item.attribution;
      }

      if (!isAttributionHtml(item) && item.children) {
        const visible = item.children.filter((child) =>
          matchesZoom(child, this.lastZoomLevel),
        );
        if (visible.length > 0) {
          const sub = document.createElement("ul");
          sub.className = "navara-attr-related";
          for (const child of visible) {
            const childLi = document.createElement("li");
            appendSanitizedHtml(childLi, child.title);
            sub.appendChild(childLi);
          }
          li.appendChild(sub);
        }
      }

      this.listEl.appendChild(li);
    }
  }

  /**
   * Rebuild the flat, deduplicated dynamic credits from tracked layers,
   * appended after the static items. Rendered as **plain text** (never HTML)
   * because the credit originates from untrusted tile metadata.
   */
  private refreshDynamicCredits(): void {
    if (!this.listEl) return;
    for (const item of this.dynamicItems) item.remove();
    this.dynamicItems = [];

    const creditStrings: string[] = [];
    for (const id of this.visibleFeatures) {
      const credit = this.dynamicCredits.get(id);
      if (credit) creditStrings.push(credit);
    }

    for (const credit of aggregateCredits(creditStrings)) {
      const { li, text } = this.createItemShell();
      text.textContent = credit;
      this.listEl.appendChild(li);
      this.dynamicItems.push(li);
    }
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
    if (!this.dock) return;
    const level = this.currentZoomLevel();
    if (level === this.lastZoomLevel) return;
    this.lastZoomLevel = level;
    // populateList() rebuilds the whole list; re-append the dynamic items.
    this.populateList();
    this.refreshDynamicCredits();
  }

  /**
   * Derive the current integer web-mercator zoom level from the camera height
   * (provisional approximation — straight-down view, ignores pitch). Returns
   * `undefined` when it can't be computed, in which case all bands are shown.
   */
  private currentZoomLevel(): number | undefined {
    if (!this.view) return undefined;
    // `getCameraFOVY()` returns the vertical FOV in radians.
    const { fovy } = this.view.camera;
    const heightPx = this.view.screenSize.y;
    if (fovy === undefined || heightPx <= 0) return undefined;

    const { lat, height } = this.view.camera.positionGeographic;
    if (height <= 0) return undefined;

    const metersPerPixel = (2 * height * Math.tan(fovy / 2)) / heightPx;
    if (metersPerPixel <= 0) return undefined;

    const latRad = (lat * Math.PI) / 180;
    const metersPerPixelZ0 =
      (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / TILE_SIZE_PX;
    return Math.floor(Math.log2(metersPerPixelZ0 / metersPerPixel));
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

    this.dynamicItems = [];
    this.dynamicCredits.clear();
    this.visibleFeatures.clear();
  }

  /**
   * Subscribe to layer feature events and merge per-feature credits into the
   * rendered list as features appear / disappear. Detaches any previously
   * registered listeners first, so repeated `show()` calls don't leak.
   */
  private trackLayers(): void {
    for (const off of this.layerCleanups) off();
    this.layerCleanups = [];
    this.dynamicCredits.clear();
    this.visibleFeatures.clear();

    for (const layer of this.layers) {
      // Track this layer's feature IDs so they can be purged on `deleted`,
      // which fires once for the layer without a `featureRemoved` per feature.
      const layerFeatures = new Set<bigint>();

      const onCreated = ({ featureSetId, credit }: FeatureCreatedParams) => {
        if (credit) this.dynamicCredits.set(featureSetId, credit);
        this.visibleFeatures.add(featureSetId);
        layerFeatures.add(featureSetId);
        this.refreshDynamicCredits();
      };
      const onRemoved = ({ featureSetId }: FeatureRemovedParams) => {
        this.dynamicCredits.delete(featureSetId);
        this.visibleFeatures.delete(featureSetId);
        layerFeatures.delete(featureSetId);
        this.refreshDynamicCredits();
      };
      const onVisibility = ({
        featureSetId,
        visible,
      }: FeatureVisibilityChangedParams) => {
        if (visible) this.visibleFeatures.add(featureSetId);
        else this.visibleFeatures.delete(featureSetId);
        this.refreshDynamicCredits();
      };
      const onDeleted = () => {
        for (const id of layerFeatures) {
          this.dynamicCredits.delete(id);
          this.visibleFeatures.delete(id);
        }
        layerFeatures.clear();
        this.refreshDynamicCredits();
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
