---
title: MVT Layer
description: How to use the MVT (Mapbox Vector Tiles) layer
sidebar:
  order: 24
---

The MVT (Mapbox Vector Tiles) layer is a layer for displaying geographic data in vector tile format. It can efficiently display large-scale vector data.

The layer accepts two kinds of `data.url`:

- **Tile templates** — a URL containing `{z}/{x}/{y}` placeholders, where each tile is fetched individually.
- **PMTiles archives** — a single URL ending in `.pmtiles`, where all tiles live in one file served over HTTP range requests. See [PMTiles Archives](#pmtiles-archives) below.

Both forms produce the same MVT layer; the engine picks the right source automatically based on the URL.

## Basic Configuration

| Property   | Type              | Description                                                                                     |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `type`     | `"mvt"`           | Layer type (required)                                                                           |
| `data`     | `{ url: string }` | Vector tile URL — either a `{z}/{x}/{y}` template or a `.pmtiles` archive URL                   |

## Supported Materials

You can specify multiple materials simultaneously depending on the geometry types in the data.

| Material                                                                            | Config key   | Supported geometry        |
| ----------------------------------------------------------------------------------- | ------------ | ------------------------- |
| [PointMaterial](../../../three/resource-layer/point-material/)            | `point`      | Point                     |
| [BillboardMaterial](../../../three/resource-layer/billboard-material/)    | `billboard`  | Point (icon display)      |
| [TextMaterial](../../../three/resource-layer/text-material/)              | `text`       | Point (label display)     |
| [PolylineMaterial](../../../three/resource-layer/polyline-material/)      | `polyline`   | LineString                |
| [PolygonMaterial](../../../three/resource-layer/polygon-material/)        | `polygon`    | Polygon                   |
| [VectorTileMaterial](../../../three/resource-layer/vector-tile-material/) | `vectorTile` | Overall tile settings     |

## Cache Strategy

### Source Sharing

When MVT layers have the same `data.url`, the tile data cache is shared. This allows multiple layers with different styles applied to the same tile source to be displayed efficiently.

```typescript
import ThreeView, { Color } from "@navara/three";

const VECTOR_TILE_URL = "https://example.com/tiles/{z}/{x}/{y}.mvt";

// Water area layer
view.addLayer({
  type: "mvt",
  data: { url: VECTOR_TILE_URL },
  polygon: {
    color: new Color().setStyle("#00aaff"),
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["waterarea"],
  },
});

// Building layer
view.addLayer({
  type: "mvt",
  data: { url: VECTOR_TILE_URL },
  polygon: {
    color: new Color().setStyle("#555555"),
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["building"],
  },
});
```

In the example above, since the same URL is used, tile data is downloaded only once.

:::warning
Adding query parameters to the URL will prevent cache sharing. To efficiently use caching, ensure the `data.url` is an exact match.
:::

## PMTiles Archives

A [PMTiles](https://docs.protomaps.com/pmtiles/) archive packs an entire tile pyramid into a **single file**. Instead of requesting one tile per HTTP call, the engine reads the archive's header and directory once, then fetches individual tiles with HTTP range requests. Only archives whose payload is MVT are supported.

To use one, point `data.url` at the archive. The URL has **no** `{z}/{x}/{y}` placeholders and ends in `.pmtiles`:

```typescript
import ThreeView, { Color } from "@navara/three";

// Credit: © OpenStreetMap contributors, © Protomaps (https://protomaps.com)
const PMTILES_URL =
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles";

view.addLayer({
  type: "mvt",
  data: { url: PMTILES_URL },
  polygon: {
    color: new Color().setStyle("#4a90d9"),
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 15,
    layers: ["water"],
  },
});
```

Everything else is identical to a templated MVT layer — the same materials apply, `vectorTile.layers` selects which vector layers to style, and multiple layers sharing the same `data.url` share one archive source (a single header/directory fetch and a shared tile cache).

```typescript
import ThreeView, { Color } from "@navara/three";

const PMTILES_URL =
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles";

// Base land fill.
view.addLayer({
  type: "mvt",
  data: { url: PMTILES_URL },
  polygon: {
    color: new Color().setStyle("#d0bf70"),
    clampToGround: true,
  },
  vectorTile: { maxZoom: 15, layers: ["earth"] },
});

// Roads drape on top — same archive, resolved once.
view.addLayer({
  type: "mvt",
  data: { url: PMTILES_URL },
  polyline: {
    show: true,
    color: new Color().setStyle("#278b8c"),
    width: 6,
    height: 1,
    clampToGround: true,
  },
  vectorTile: { maxZoom: 15, layers: ["roads"] },
});
```

:::note
The archive must be served from a host that supports HTTP range requests (`Range` / `Accept-Ranges`) and, for cross-origin URLs, permits CORS. Most static hosts (S3, CDNs) satisfy both.
:::

## Usage Examples

### Point Features

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const pointLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Wakayama City (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-30201-wakayama-shi-2023
    url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
  },
  point: {
    color: new Color().setHex(0xff0000),
    size: 0.01,
    height: 1,
    center: { x: 0.5, y: 0 },
    sizeInMeters: true,
    clampToGround: true,
    depthTest: true,
  },
});
```

### Road Network

```typescript
import ThreeView, { Color } from "@navara/three";

const roadLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Gifu City (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-21201-gifu-shi-2023
    url: "https://assets.cms.plateau.reearth.io/assets/67/b5b3c6-71d8-405c-88c8-4ead72890b2b/21201_gifu-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
  },
  polyline: {
    show: true,
    color: new Color().setHex(0x00ff00),
    width: 2,
    height: 1,
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
  },
});
```

### Land Use Areas

```typescript
import ThreeView, { Color } from "@navara/three";

const landUseLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Tokyo 23 Wards - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku
    url: "https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
  },
  polygon: {
    color: new Color().setHex(0x00aaff),
    height: 10,
    extrudedHeight: 0,
    clampToGround: true,
    wireframe: false,
  },
  vectorTile: {
    maxZoom: 15,
    layers: ["HeightControlDistrict"],
  },
});
```

## Related Resources

- [GeoJSON Layer](../../../three/resource-layer/geojson-layer/) - Display data in GeoJSON format
- [VectorTileMaterial](../../../three/resource-layer/vector-tile-material/) - Detailed vector tile material settings
