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
- **Per-layer credits** — credits supplied by layers (such as a 3D tile's copyright) are tracked automatically as features appear and disappear.
- **Always-visible logos** — logos that must always be shown (e.g. Google) sit in a separate bottom-left frame, independent of whether the popover is open.

Credits may contain inline `<a>` links; they are sanitized before display.

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

const tiles = view.addLayer({
  type: "tiles",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});

attribution.show(
  [
    {
      attribution: "国土地理院",
      url: "https://maps.gsi.go.jp/development/ichiran.html",
      children: [
        { title: "全国最新写真（シームレス）", minZoom: 14, maxZoom: 18 },
        { title: "全国ランドサットモザイク画像", minZoom: 9, maxZoom: 13 },
      ],
    },
    {
      attributionHtml:
        '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
    },
  ],
  [tiles],
);

attribution.hide();
attribution.dispose();
```

## Constructor

```typescript
new AttributionPlugin();
```

Takes no configuration. Register it with `view.addPlugin()` **before** `view.init()`.

## Methods

### show(items, layers?)

```typescript
show(items: AttributionItem[], layers?: Layer[]): void
```

Displays the given attributions. Calling it again replaces the content, so you can update credits when the displayed data changes. Pass the `layers` you want per-feature credits tracked for; this is optional.

### hide()

```typescript
hide(): void
```

Hides the attribution UI and clears the tracked content.

### dispose()

```typescript
dispose(): void
```

Removes the UI and releases everything the plugin set up. Call it when the plugin is no longer needed.

## Types

### AttributionItem

Each entry is either a structured source or a raw HTML credit:

```typescript
type AttributionItem = AttributionSource | AttributionHtml;
```

### AttributionSource

| Property      | Type                 | Description                                                                       |
| ------------- | -------------------- | --------------------------------------------------------------------------------- |
| `attribution` | `string`             | Data source name shown at the top level                                           |
| `url`         | `string`             | Optional link for the source name                                                 |
| `logo`        | `string`             | Optional logo image URL, shown in the always-visible bottom-left frame            |
| `children`    | `AttributionChild[]` | Optional credits shown only at their zoom range                                   |
| `creditLayerId` | `string`           | Optional `layer.id`; per-feature credits from that layer are nested under this source |
| `collapsible` | `boolean`            | When `true`, the source's sub-credits become a foldable group (starts expanded). Defaults to `false` |

### AttributionHtml

| Property          | Type     | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `attributionHtml` | `string` | A credit written as HTML with inline `<a>` links |

### AttributionChild

| Property  | Type     | Description                                         |
| --------- | -------- | --------------------------------------------------- |
| `title`   | `string` | Credit text. May contain inline `<a>` links         |
| `minZoom` | `number` | Lowest zoom this credit applies to (omit for none)  |
| `maxZoom` | `number` | Highest zoom this credit applies to (omit for none) |

## Notes

- **Zoom ranges are for raster sources you declare yourself.** Tiles like GSI or OpenStreetMap don't carry their own credits, so describe their zoom-dependent credits with `children`.
- **Per-layer credits come from the tiles.** Only sources that embed a copyright (such as Google Photorealistic 3D Tiles) produce credits through `layers`; for everything else, use `children`.
- **Mandated logos go in the logo frame, not the popover.** Use `logo` only for marks you are required to keep visible at all times; ordinary sources are best shown as text.
- **Links are scheme-checked.** Every credit link — `url`, inline `<a>` in `attributionHtml` / `title`, and `<a>` embedded in a layer's per-feature credits — is kept only for safe schemes (`http` / `https` / `mailto`, or relative URLs); anything else (e.g. `javascript:`) is dropped to plain text. This makes it safe to render links even from untrusted tile metadata.
- **Bare URLs are auto-linked.** A plain `http(s)` URL inside credit text is turned into a clickable link automatically, so you can paste an official notice verbatim without hand-wrapping the URL in `<a>` — the wording (and the URL) stays unchanged.

## Related Resources

- [OverlayPlugin](../overlayplugin/) — World-to-screen HTML overlay projection
- [About three_plugins](../about/) — Package overview
