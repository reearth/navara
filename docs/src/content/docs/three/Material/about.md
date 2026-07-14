---
title: About
description: Materials (styling options) for layers
sidebar:
  order: 500
---

**Materials** are the render (styling) options for a [layer](../../../three/layer/about/). Each material is set via its key on the layer configuration (for example `polygon` on a `vector` layer, or `terrain` on a `terrain` layer). Which materials a layer accepts depends on its type.

:::note
Data (URL, zoom, decoder, …) is described by a [Source](../../../three/source/about/); how it renders is described by a [layer](../../../three/layer/about/) and its materials.
:::

## Materials by layer type

| Layer type                                                | Materials (config keys)                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`vector`](../../../three/layer/vector-layer/)            | `point`, `billboard`, `text`, `polyline`, `polygon`                            |
| [`raster`](../../../three/layer/raster-layer/)            | `raster`, `hillshade`, `elevationHeatmap`                                       |
| [`terrain`](../../../three/layer/terrain-layer/)          | `terrain`                                                                       |
| [`3d-tiles`](../../../three/layer/3d-tiles-layer/)        | `model`                                                                         |

## Material reference

| Material                                                                              | Config key         | Used by                    |
| ------------------------------------------------------------------------------------- | ------------------ | -------------------------- |
| [PointMaterial](../../../three/material/point-material/)                        | `point`            | `vector`                   |
| [BillboardMaterial](../../../three/material/billboard-material/)                | `billboard`        | `vector`                   |
| [TextMaterial](../../../three/material/text-material/)                          | `text`             | `vector`                   |
| [PolylineMaterial](../../../three/material/polyline-material/)                  | `polyline`         | `vector`                   |
| [PolygonMaterial](../../../three/material/polygon-material/)                    | `polygon`          | `vector`                   |
| [RasterMaterial](../../../three/material/raster-material/)                      | `raster`           | `raster`                   |
| [HillshadeMaterial](../../../three/material/hillshade-material/)                | `hillshade`        | `raster` (raster-dem)      |
| [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/) | `elevationHeatmap` | `raster` (raster-dem)      |
| [TerrainMaterial](../../../three/material/terrain-material/)                    | `terrain`          | `terrain`                  |
| [ModelMaterial](../../../three/material/model-material/)                        | `model`            | `3d-tiles`                 |

## Usage example

```typescript
// A vector layer can take several materials at once
view.addLayer({
  type: "vector",
  source: features,
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});
```

## Related Resources

- [Layer Types](../../../three/layer/about/) — layer types and how to add them
- [About Source](../../../three/source/about/) — the data side
