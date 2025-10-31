import type { Dataset } from "./constants";

/**
 * Attribution UI state
 */
let attributionContainer: HTMLDivElement | null = null;
let isCollapsed = true;

/**
 * Unique attribution with optional URL
 */
type UniqueAttribution = {
  attribution: string;
  attributionUrl?: string;
};

/**
 * Create and style the attribution container
 */
function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.id = "navara-attributions";

  container.style.position = "fixed";
  container.style.bottom = "8px";
  container.style.left = "8px";
  container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  container.style.color = "#ffffff";
  container.style.padding = "4px";
  container.style.borderRadius = "8px";
  container.style.border = "2px solid #999999";
  container.style.boxSizing = "border-box";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.6";
  container.style.maxWidth = "200px";
  container.style.minWidth = "200px";
  container.style.maxHeight = "34px";
  container.style.overflow = "auto";
  container.style.zIndex = "1000";
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
  button.style.fontSize = "14px";
  button.style.padding = "4px";
  button.style.lineHeight = "1";

  button.addEventListener("click", () => {
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      icon.style.transform = "rotate(90deg)";
      container.style.maxHeight = "34px";
      container.style.maxWidth = "200px";
    } else {
      icon.style.transform = "rotate(0deg)";
      container.style.maxHeight = "400px";
      container.style.maxWidth = "400px";
    }
  });

  return button;
}

/**
 * Create attribution content
 */
function createContent(attributions: UniqueAttribution[]): HTMLDivElement {
  const content = document.createElement("div");
  content.id = "navara-attributions-content";
  content.style.padding = "8px 10px";

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "6px";

  attributions.forEach((attr) => {
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

    list.appendChild(item);
  });

  content.appendChild(list);
  return content;
}

/**
 * Display dataset attributions in a collapsible UI at bottom right
 *
 * @param datasets - Array of datasets to display attributions for
 *
 * @example
 * ```ts
 * import { showAttributions } from "./helpers/attributions";
 * import { TILES_3D_DATASETS } from "./helpers/constants";
 *
 * showAttributions([TILES_3D_DATASETS.plateauChiyoda, TILES_3D_DATASETS.plateauChuo]);
 * ```
 */
export function showAttributions(datasets: Dataset[]): void {
  // Remove existing container if present
  if (attributionContainer) {
    attributionContainer.remove();
    attributionContainer = null;
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
  const content = createContent(uniqueAttributions);

  container.appendChild(toggleButton);
  container.appendChild(content);

  // Add to document
  document.body.appendChild(container);
  attributionContainer = container;
}

/**
 * Remove the attributions UI from the page
 */
export function hideAttributions(): void {
  if (attributionContainer) {
    attributionContainer.remove();
    attributionContainer = null;
  }
  isCollapsed = false;
}
