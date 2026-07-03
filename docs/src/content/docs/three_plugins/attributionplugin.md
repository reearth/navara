---
title: AttributionPlugin
description: Non-modal, zoom-aware data attribution (credit) UI plugin for navara_three.
sidebar:
  order: 4
---

## Overview

`AttributionPlugin` shows a credit UI for your map's data sources. A small ⓘ trigger sits in the bottom-right corner; clicking it opens a popover that lists the active sources. It is non-modal — the map stays interactive (pan / zoom / rotate) while the popover is open.

It covers the three things map attributions usually need:

- **Zoom-aware credits** — a source can carry child credits that apply only within a zoom range, so only the relevant ones are shown and they switch quietly as the user zooms.
- **Per-layer credits** — credits supplied by layers (such as a 3D tile's copyright) are tracked automatically and nested under the source you link with `creditLayerId`.
- **Always-visible logos** — logos that must always be shown (e.g. Google) sit in a separate bottom-left frame, independent of whether the popover is open.

Credits may contain inline `<a>` links; they are sanitized before display. The colors are themeable at runtime with [`setStyle()`](#setstylestyle).

## Usage

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container });
const defaultPlugin = new DefaultPlugin();
const attribution = new AttributionPlugin();

view.addPlugin(defaultPlugin);
view.addPlugin(attribution);
await view.init();

// Raster basemap: it carries no per-feature credit, so declare it statically.
const basemap = view.addSource({
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: basemap });

// 3D tiles whose tiles embed their own copyright (tracked dynamically).
const photorealSource = view.addSource({
  type: "3d-tiles",
  url: "https://tile.googleapis.com/v1/3dtiles/root.json?key=YOUR_KEY",
});
const photoreal = view.addLayer({ type: "3d-tiles", source: photorealSource });

attribution.show(
  [
    {
      attribution: "Geospatial Information Authority of Japan (GSI)",
      url: "https://maps.gsi.go.jp/development/ichiran.html",
      children: [
        { attribution: "Nationwide latest aerial photos (seamless)", minZoom: 14, maxZoom: 18 },
        { attribution: "GRUS画像（© Axelspace）", minZoom: 14, maxZoom: 18 },
      ],
    },
    {
      attribution: "Google Maps Photorealistic 3D Tiles",
      logo: "/credits/GoogleMaps.png",
      // Nest this layer's per-tile credits under this source. The layer is
      // resolved from the view by id, so you don't pass it separately.
      creditLayerId: photoreal.id,
    },
    {
      attributionHtml:
        '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
    },
  ],
);

attribution.hide();
attribution.dispose();
```

## Constructor

```typescript
new AttributionPlugin(options?: { style?: AttributionStyle });
```

`options.style` sets the initial colors (see [AttributionStyle](#attributionstyle)); omit it for the defaults. Register the plugin with `view.addPlugin()` **before** `view.init()`.

## Methods

### show(items)

```typescript
show(items: AttributionItem[]): void
```

Displays the given attributions. Calling it again replaces the content, so you can update credits when the displayed data changes. Sources that set `creditLayerId` have that layer's per-feature credits tracked dynamically — the layer is resolved from the view by id, so you don't pass it separately.

### hide()

```typescript
hide(): void
```

Hides the attribution UI and clears the tracked content.

### dispose()

```typescript
dispose(): void
```

Removes the UI and releases everything the plugin set up.

### setStyle(style)

```typescript
setStyle(style: AttributionStyle): void
```

Updates the UI colors at runtime. Merges over the current style and re-themes the live DOM in place (no rebuild), so it suits switching between light and dark modes.

```typescript
attribution.setStyle({
  backgroundColor: "rgba(20, 24, 28, 0.92)",
  textColor: "#e6e9ee",
  nestedTextColor: "rgba(230, 233, 238, 0.64)",
  linkColor: "#8ab4f8",
});
```

## Types

### AttributionItem

Each entry is either a structured source or a raw HTML credit:

```typescript
type AttributionItem = AttributionSource | AttributionHtml;
```

### AttributionSource

| Property        | Type                              | Description                                                                           |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `attribution`   | `string`                          | Top-level source / provider name                                                      |
| `url`           | `string \| undefined`             | Optional link for the source name                                                     |
| `logo`          | `string \| undefined`             | Optional logo image URL, shown in the always-visible bottom-left frame                |
| `logoUrl`       | `string \| undefined`             | Optional click target for the `logo`; the logo is linked only when this is set        |
| `children`      | `AttributionChild[] \| undefined` | Optional credits shown only at their zoom range                                       |
| `creditLayerId` | `string \| undefined`             | Optional `layer.id`; per-feature credits from that layer are nested under this source |

### AttributionHtml

| Property          | Type     | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `attributionHtml` | `string` | A credit written as HTML with inline `<a>` links |

### AttributionChild

| Property        | Type                  | Description                                          |
| --------------- | --------------------- | --------------------------------------------------- |
| `attribution`   | `string`              | Credit text. May contain inline `<a>` links         |
| `minZoom`       | `number \| undefined` | Lowest zoom this credit applies to (omit for none)  |
| `maxZoom`       | `number \| undefined` | Highest zoom this credit applies to (omit for none) |

### AttributionStyle

All fields are optional; an unset field keeps the default color. Colors are applied as CSS custom properties, so `setStyle()` re-themes live.

| Property          | Type                  | Description                                   |
| ----------------- | --------------------- | --------------------------------------------- |
| `titleColor`      | `string \| undefined` | Source title text color                       |
| `linkColor`       | `string \| undefined` | Link and info-icon color                      |
| `listStyleColor`  | `string \| undefined` | Bullet (list marker) color                    |
| `textColor`       | `string \| undefined` | Body text color                               |
| `nestedTextColor` | `string \| undefined` | Nested child-credit text color                |
| `backgroundColor` | `string \| undefined` | Popover and trigger background color          |
| `borderColor`     | `string \| undefined` | Header divider color (useful for dark themes) |

## Notes

- **Zoom ranges are for raster sources you declare yourself.** Tiles like GSI or OpenStreetMap don't carry their own credits, so describe their zoom-dependent credits with `children`.
- **Per-layer credits come from the tiles.** Only sources that embed a copyright (such as Google Photorealistic 3D Tiles) produce credits through `creditLayerId`; for everything else, use `children`.
- **Mandated logos go in the logo frame, not the popover.** Use `logo` only for marks you are required to keep visible at all times; ordinary sources are best shown as text. A logo is a plain image by default — set `logoUrl` to make it link to the provider's page. Some marks must be shown but not turned into a link, so leave `logoUrl` unset for those.
- **Links are scheme-checked.** Every credit link — `url`, `logoUrl`, inline `<a>` in `attributionHtml` / `attribution`, and `<a>` embedded in a layer's per-feature credits — is kept only for safe schemes (`http` / `https` / `mailto`, or relative URLs); anything else (e.g. `javascript:`) is dropped to plain text. This makes it safe to render links even from untrusted tile metadata.
- **Bare URLs are auto-linked.** A plain `http(s)` URL inside credit text is turned into a clickable link automatically, so you can paste an official notice verbatim without hand-wrapping the URL in `<a>` — the wording (and the URL) stays unchanged.

## Related Resources

- [OverlayPlugin](../overlayplugin/) — World-to-screen HTML overlay projection
- [About three_plugins](../about/) — Package overview
