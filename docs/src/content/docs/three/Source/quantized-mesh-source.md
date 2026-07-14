---
title: Quantized Mesh Source
description: A Cesium quantized-mesh terrain source
sidebar:
  order: 350
---

A `quantized-mesh` source describes Cesium quantized-mesh terrain. Render it with a [`terrain`](../../../three/layer/terrain-layer/) layer. By default it is treated as geographic (EPSG:4326) with a TMS (south-origin) Y axis, matching Cesium's convention.

## Properties

| Property               | Type               | Default    | Description                                                              |
| ---------------------- | ------------------ | ---------- | ---------------------------------------------------------------------- |
| `type`                 | `"quantized-mesh"` | (required) | Source type.                                                          |
| `url`                  | `string`           | (required) | Tile URL template (contains `{z}/{x}/{y}`).                          |
| `geographic`           | `boolean`          | `true`     | Use a geographic (EPSG:4326) tiling scheme; otherwise WebMercator.   |
| `tms`                  | `boolean`          | `true`     | Whether the tile Y axis is south-origin (TMS).                       |
| `requestVertexNormals` | `boolean`          | `false`    | Request the oct-encoded per-vertex normals extension (`octvertexnormals` Accept header). |
| `requestWaterMask`     | `boolean`          | `false`    | Request the watermask extension (`watermask` Accept header).         |
| `token`                | `string`           | —          | Bearer token sent as the `Authorization` header when fetching tiles. |
| `minZoom`              | `number`           | `0`        | Minimum zoom level tiles are provided for.                           |
| `maxZoom`              | `number`           | `20`       | Maximum zoom level new tiles are requested for.                      |
| `overscaledMaxZoom`    | `number`           | `24`       | Maximum zoom overscaled tiles are used up to.                        |

## Example

```typescript
import ThreeView from "@navara/three";

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://example.com/terrain/{z}/{x}/{y}.terrain",
  requestVertexNormals: true,
});

view.addLayer({ type: "terrain", source: terrain });

// Style the terrain mesh with `terrain`.
view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: { skirt: true, castShadow: true },
});
```

## Related Resources

- [About Source](../../../three/source/about/)
- [TerrainMaterial](../../../three/material/terrain-material/) — terrain rendering options
