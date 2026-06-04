import type { Layer } from "@navara/three";

import { type Dataset, TILES_3D_DATASETS } from "./constants";

/**
 * Attribution UI state
 */
let attributionWrapper: HTMLDivElement | null = null;
let isCollapsed = true;

/**
 * Unique attribution with optional URL
 */
type UniqueAttribution = {
  attribution: string;
  attributionUrl?: string;
};

/**
 * Create the fixed-position wrapper that holds the logo (left) and the
 * attributions container (right).
 */
function createWrapper(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.id = "navara-attributions-wrapper";
  wrapper.style.position = "fixed";
  wrapper.style.bottom = "8px";
  wrapper.style.left = "8px";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "flex-end";
  wrapper.style.gap = "8px";
  wrapper.style.zIndex = "1000";
  return wrapper;
}

/**
 * Create the Google Maps logo image element. Per Google Photorealistic 3D
 * Tiles attribution guidelines, the logo must always be visible.
 */
function createGoogleLogo(): HTMLImageElement {
  const img = document.createElement("img");
  img.src = "/credits/GoogleMaps.png";
  img.alt = "Google Maps";
  img.style.height = "22px";
  img.style.width = "auto";
  img.style.display = "block";
  img.style.userSelect = "none";
  img.draggable = false;
  return img;
}

/**
 * Create and style the attribution container
 */
function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.id = "navara-attributions";

  container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  container.style.color = "#ffffff";
  container.style.padding = "4px";
  container.style.borderRadius = "8px";
  container.style.border = "2px solid #999999";
  container.style.boxSizing = "border-box";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.6";
  container.style.maxWidth = "140px";
  container.style.minWidth = "140px";
  container.style.maxHeight = "28px";
  container.style.overflow = "hidden";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.style.transition = "all 0.2s ease";

  return container;
}

/**
 * Create the toggle button
 */
function createToggleButton(container: HTMLDivElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "Data attributions";
  button.title = "Toggle attributions";

  const div = document.createElement("div");
  div.style.display = "inline-block";
  div.style.flex = "1";
  div.style.textAlign = "right";
  const icon = document.createElement("span");
  icon.textContent = "▼";
  icon.style.display = "inline-block";
  icon.style.transition = "transform 0.2s ease";
  icon.style.transform = "rotate(90deg)";
  div.appendChild(icon);

  button.appendChild(div);

  button.style.display = "flex";
  button.style.width = "100%";
  button.style.background = "transparent";
  button.style.border = "none";
  button.style.color = "#ffffff";
  button.style.cursor = "pointer";
  button.style.fontSize = "12px";
  button.style.padding = "2px";
  button.style.lineHeight = "1";

  button.addEventListener("click", () => {
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      icon.style.transform = "rotate(90deg)";
      container.style.maxHeight = "28px";
      container.style.maxWidth = "140px";
      container.style.overflow = "hidden";
    } else {
      icon.style.transform = "rotate(0deg)";
      container.style.maxHeight = "400px";
      container.style.maxWidth = "400px";
      container.style.overflow = "auto";
    }
  });

  return button;
}

/**
 * Build an attribution list item with the standard bordered style. Renders an
 * anchor when a URL is provided, otherwise plain text.
 */
function createAttributionItem(attr: UniqueAttribution): HTMLDivElement {
  const item = document.createElement("div");
  item.style.paddingLeft = "8px";
  item.style.borderLeft = "2px solid rgba(255, 255, 255, 0.3)";

  if (attr.attributionUrl) {
    const link = document.createElement("a");
    link.href = attr.attributionUrl;
    link.textContent = attr.attribution;
    link.target = "_blank";
    link.style.color = "#60a5fa";
    link.style.textDecoration = "none";
    link.style.transition = "color 0.2s";

    link.addEventListener("mouseenter", () => {
      link.style.color = "#93c5fd";
      link.style.textDecoration = "underline";
    });

    link.addEventListener("mouseleave", () => {
      link.style.color = "#60a5fa";
      link.style.textDecoration = "none";
    });

    item.appendChild(link);
  } else {
    item.textContent = attr.attribution;
    item.style.color = "rgba(255, 255, 255, 0.9)";
  }

  return item;
}

/**
 * Create attribution content. Returns the outer content div together with the
 * inner list element so callers can append additional (dynamic) items later
 * using the same layout and item styling.
 */
function createContent(attributions: UniqueAttribution[]): {
  content: HTMLDivElement;
  list: HTMLDivElement;
} {
  const content = document.createElement("div");
  content.id = "navara-attributions-content";
  content.style.padding = "8px 10px";

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "6px";

  attributions.forEach((attr) => {
    list.appendChild(createAttributionItem(attr));
  });

  content.appendChild(list);
  return { content, list };
}

/**
 * Display dataset attributions in a collapsible UI at bottom left.
 *
 * When `layers` are provided, per-tile credits emitted by those layers are
 * automatically tracked and merged into the attribution list as features
 * become visible or are removed. This is what Google Photorealistic 3D Tiles
 * requires for compliance.
 *
 * When the Google Photorealistic 3D Tiles dataset is included, the Google Maps
 * logo is shown to the left of the container and remains visible regardless of
 * the collapsed state, as required by Google's attribution guidelines.
 *
 * @param datasets - Datasets to display attributions for
 * @param layers - Optional layers whose per-feature credits should be tracked
 *
 * @example
 * ```ts
 * const layer = view.addLayer({ ... });
 * showAttributions([TILES_3D_DATASETS.googlePhotorealTiles], [layer]);
 * ```
 */
export function showAttributions(
  datasets: Dataset[],
  layers: Layer[] = [],
): void {
  // Remove existing wrapper if present
  if (attributionWrapper) {
    attributionWrapper.remove();
    attributionWrapper = null;
  }

  // Return early if no datasets
  if (datasets.length === 0) {
    return;
  }

  // Extract unique attributions
  const uniqueAttributions: UniqueAttribution[] = [];
  const seen = new Set<string>();

  for (const dataset of datasets) {
    if (!dataset.attribution) continue;

    const key = `${dataset.attribution}|${dataset.attributionUrl || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAttributions.push({
        attribution: dataset.attribution,
        attributionUrl: dataset.attributionUrl,
      });
    }
  }

  // Create and populate container
  const container = createContainer();
  const toggleButton = createToggleButton(container);
  const { content: staticContent, list } = createContent(uniqueAttributions);

  container.appendChild(toggleButton);
  container.appendChild(staticContent);

  // Track per-feature credits for each provided layer and merge them into the
  // same list, after the static dataset entries. Kept distinct from the static
  // entries so removed or hidden features don't drop dataset-level attribution.
  const dynamicCredits = new Map<bigint, string>();
  const visibleFeatures = new Set<bigint>();
  const dynamicItems: HTMLDivElement[] = [];

  const refreshDynamic = () => {
    for (const item of dynamicItems) {
      item.remove();
    }
    dynamicItems.length = 0;

    const counts = new Map<string, number>();
    for (const id of visibleFeatures) {
      const credit = dynamicCredits.get(id);
      if (!credit) continue;
      credit.split(";").forEach((raw) => {
        const c = raw.trim();
        if (!c) return;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      });
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [credit] of sorted) {
      const item = createAttributionItem({ attribution: credit });
      list.appendChild(item);
      dynamicItems.push(item);
    }
  };

  const trackAttributions = (layer: Layer) => {
    layer.on("featureCreated", ({ featureSetId, credit }) => {
      if (credit) {
        dynamicCredits.set(featureSetId, credit);
      }
      visibleFeatures.add(featureSetId);
      refreshDynamic();
    });

    layer.on("featureRemoved", ({ featureSetId }) => {
      dynamicCredits.delete(featureSetId);
      visibleFeatures.delete(featureSetId);
      refreshDynamic();
    });

    layer.on("featureVisibilityChanged", ({ featureSetId, visible }) => {
      if (visible) {
        visibleFeatures.add(featureSetId);
      } else {
        visibleFeatures.delete(featureSetId);
      }
      refreshDynamic();
    });
  };

  // Build wrapper. The Google logo sits outside the collapsible container, to
  // its left, so it stays visible even when attributions are collapsed.
  const wrapper = createWrapper();
  const includesGooglePhotoreal = datasets.some(
    (d) => d.url === TILES_3D_DATASETS.googlePhotorealTiles.url,
  );
  if (includesGooglePhotoreal) {
    wrapper.appendChild(createGoogleLogo());
  }
  wrapper.appendChild(container);

  // Add to document
  document.body.appendChild(wrapper);
  attributionWrapper = wrapper;

  for (const layer of layers) {
    trackAttributions(layer);
  }
}

/**
 * Remove the attributions UI from the page
 */
export function hideAttributions(): void {
  if (attributionWrapper) {
    attributionWrapper.remove();
    attributionWrapper = null;
  }
  isCollapsed = false;
}
