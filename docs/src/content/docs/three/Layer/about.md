---
title: About
description: What a layer is and how it renders a source
sidebar:
  order: 10
---

A **layer** decides *how* map data is rendered. The data itself comes from a [Source](../../../three/source/about/), which a layer references by `source`. Separating "where the data is" (Source) from "how it looks" (layer) lets one source feed several layers, restyle without re-fetching, and describe a whole map declaratively from JSON.

:::note
Layers are added with [`addLayer`](../../../three/api/threeview-functions/) and take a `source` — either a `Source` handle from `addSource`, or its `id` string. See [Materials](../../../three/material/about/) for the materials reference.
:::

## Creating a layer

```typescript
import ThreeView from "@navara/three";

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
  maxZoom: 19,
});

// Reference the source by handle…
view.addLayer({ type: "raster", source: imagery });

// …or by id
view.addLayer({ type: "raster", source: "basemap" });
```

`addLayer` returns a `Layer` handle with `update()`, `delete()`, `forceUpdate()`, and feature events.

## Layer types

Each layer type accepts a specific set of source types and its own set of nested render options (materials):

| Layer type                                                    | Accepts sources                | Render options                                              |
| ------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| [`vector`](../../../three/layer/vector-layer/)                | `geojson`, `vector-tile`       | `point` / `billboard` / `text` / `polyline` / `polygon`    |
| [`raster`](../../../three/layer/raster-layer/)                | `raster-tile`, `raster-dem`    | `raster` / `hillshade` / `elevationHeatmap`                |
| [`terrain`](../../../three/layer/terrain-layer/)              | `raster-dem`, `quantized-mesh` | `terrain`                                                  |
| [`3d-tiles`](../../../three/layer/3d-tiles-layer/)            | `3d-tiles`                     | `model`                                                    |

```typescript
view.addLayer({ type: "raster", source: imagery, raster: { opacity: 0.8 } });
view.addLayer({ type: "terrain", source: dem, terrain: { skirt: true } });
```

## Updating and deleting

The returned `Layer` handle overwrites its configuration with `update()` and removes the layer with `delete()`. A layer's `source` cannot be changed via `update()`; recreate the layer to point it at a different source.

```typescript
const layer = view.addLayer({ type: "raster", source: imagery });
layer.update({ type: "raster", source: imagery, raster: { opacity: 0.5 } });
layer.delete();
```

## Related Resources

- [About Source](../../../three/source/about/) — the data side
- [ThreeView functions](../../../three/api/threeview-functions/) — `addLayer` / `addSource`
- [Materials](../../../three/material/about/) — materials (styling) reference
