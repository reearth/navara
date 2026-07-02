---
title: About
description: What a Source is and how layers reference it
sidebar:
  order: 10
---

A **Source** describes where map data comes from and how it is fetched and decoded (URL, zoom range, tiling scheme, elevation decoder, and so on). A [layer](../../../three/layer/about/) then decides *how* that data is rendered. One source can be referenced by many layers, and the engine deduplicates the underlying fetch and tiling resources.

Separating "where the data is" (Source) from "how it looks" (layer) lets you:

- share a single fetch/tile cache across several layers,
- restyle without re-fetching, and
- describe a whole map declaratively from JSON by referencing sources by `id`.

:::note
See [About Layer](../../../three/layer/about/) for the layer types and [Materials](../../../three/material/about/) for the materials reference.
:::

## Creating a source

Register a source with [`addSource`](../../../three/api/threeview-functions/). It returns a `Source` handle:

```typescript
import ThreeView from "@navara/three";

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
  maxZoom: 19,
});
```

A source has an `id` (used to reference it from layers) and a `type`.

### Providing an id

An `id` is optional; when omitted a random one is generated. You may pass your own id instead, and adding a source with an existing id **overrides** it (later definition wins):

```typescript
view.addSource({
  id: "basemap",
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
});
```

Because a layer can reference a source by its id string, this lets you define the whole map declaratively from JSON.

## Referencing a source from a layer

Source-based layers take a `source` property — either the `Source` handle returned by `addSource`, or its `id` string:

```typescript
// By handle
view.addLayer({ type: "raster", source: imagery });

// By id
view.addLayer({ type: "raster", source: "basemap" });
```

Each layer type accepts a specific set of source types:

| Layer type   | Accepts sources                          |
| ------------ | ---------------------------------------- |
| `"vector"`   | `geojson`, `vector-tile`                 |
| `"raster"`   | `raster-tile`, `raster-dem`              |
| `"terrain"`  | `raster-dem`, `quantized-mesh`           |
| `"3d-tiles"` | `3d-tiles`                               |

Each layer type accepts its own rendering options: `raster` / `hillshade` / `elevationHeatmap` for a `raster` layer, `terrain` for a `terrain` layer, `model` for a `3d-tiles` layer, and `point` / `polyline` / `polygon` / `text` / `billboard` for a `vector` layer.

```typescript
view.addLayer({ type: "raster", source: imagery, raster: { opacity: 0.8 } });
view.addLayer({ type: "terrain", source: dem, terrain: { skirt: true } });
```

## Source types

| Type                                                                        | Description                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| [`geojson`](../../../three/source/geojson-source/)                          | GeoJSON, from a URL or inline                    |
| [`vector-tile`](../../../three/source/vector-tile-source/)                  | Mapbox Vector Tiles (MVT) tileset                |
| [`raster-tile`](../../../three/source/raster-tile-source/)                  | Raster imagery tiles (XYZ / TMS)                 |
| [`raster-dem`](../../../three/source/raster-dem-source/)                    | RGB-encoded elevation tiles (terrain / hillshade)|
| [`quantized-mesh`](../../../three/source/quantized-mesh-source/)            | Cesium quantized-mesh terrain                    |
| [`3d-tiles`](../../../three/source/3d-tiles-source/)                        | 3D Tiles tileset                                 |

## Related Resources

- [ThreeView functions](../../../three/api/threeview-functions/) — `addSource` (update/delete are on the returned `Source` handle)
- [About Layer](../../../three/layer/about/) — layer types
- [Materials](../../../three/material/about/) — materials (styling) reference
