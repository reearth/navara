---
title: Vector Tile Source
description: A vector-tile (MVT) source
sidebar:
  order: 320
---

A `vector-tile` source describes a Mapbox Vector Tiles (MVT) tileset. Render it with a [`vector`](../../../three/layer/vector-layer/) layer. Which source layers inside the tileset to render is chosen per layer via the layer's `sourceLayers` property.

The `url` accepts two forms:

- **Tile templates** — a URL containing `{z}/{x}/{y}` placeholders, where each tile is fetched individually.
- **PMTiles archives** — a single URL ending in `.pmtiles`, where all tiles live in one file served over HTTP range requests. See [PMTiles Archives](#pmtiles-archives) below.

Both forms produce the same source; the engine picks the right implementation automatically based on the URL.

## Properties

| Property            | Type            | Default    | Description                                              |
| ------------------- | --------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"vector-tile"` | (required) | Source type.                                            |
| `url`               | `string`        | (required) | Tile URL — either a `{z}/{x}/{y}` template or a `.pmtiles` archive URL. |
| `maxZoom`           | `number`        | `20`       | Maximum zoom level new tiles are requested for.         |
| `overscaledMaxZoom` | `number`        | `24`       | Maximum zoom overscaled (stretched-parent) tiles are used up to. |
| `maxSse`            | `number`        | `2.0`      | Maximum screen-space error driving tile traversal.      |
| `crs`               | `string`        | —          | Coordinate reference system of the tiles.               |

## Source sharing

Multiple `vector` layers can reference one vector-tile source; the tile data and traversal are shared, and each layer styles its own `sourceLayers`.

```typescript
import ThreeView, { Color } from "@navaramap/three";

const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555") },
});
```

## PMTiles Archives

A [PMTiles](https://docs.protomaps.com/pmtiles/) archive packs an entire tile pyramid into a **single file**. Instead of one HTTP request per tile, the engine reads the archive's header and directory once, then fetches individual tiles with HTTP range requests. Only archives whose payload is MVT are supported.

To use one, point the source `url` at the archive. The URL has **no** `{z}/{x}/{y}` placeholders and ends in `.pmtiles`; the engine selects the archive source implementation automatically:

```typescript
import ThreeView, { Color } from "@navaramap/three";

// Credit: © OpenStreetMap contributors, © Protomaps (https://protomaps.com)
const PMTILES_URL =
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles";

const firenze = view.addSource({
  type: "vector-tile",
  url: PMTILES_URL,
  maxZoom: 15,
});

view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["water"],
  polygon: { color: new Color().setStyle("#4a90d9"), clampToGround: true },
});
```

Everything else is identical to a templated vector-tile source — the same materials apply, `sourceLayers` selects which vector layers to style, and multiple `vector` layers referencing the same source share one archive (a single header/directory fetch and a shared tile cache):

```typescript
const firenze = view.addSource({
  type: "vector-tile",
  url: PMTILES_URL,
  maxZoom: 15,
});

// Base land fill.
view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["earth"],
  polygon: { color: new Color().setStyle("#d0bf70"), clampToGround: true },
});

// Roads drape on top — same archive, resolved once.
view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["roads"],
  polyline: {
    show: true,
    color: new Color().setStyle("#278b8c"),
    width: 6,
    height: 1,
    clampToGround: true,
  },
});
```

:::note
The archive must be served from a host that supports HTTP range requests (`Range` / `Accept-Ranges`) and, for cross-origin URLs, permits CORS. Most static hosts (S3, CDNs) satisfy both.
:::

## Related Resources

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
