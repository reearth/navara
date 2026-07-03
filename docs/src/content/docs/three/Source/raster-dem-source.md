---
title: Raster DEM Source
description: An RGB-encoded elevation (raster-dem) source
sidebar:
  order: 14
---

A `raster-dem` source describes RGB-encoded elevation tiles. It powers both:

- **terrain meshing** — via a [`terrain`](../../../three/layer/terrain-layer/) layer, and
- **hillshade / elevation-heatmap** — via a [`raster`](../../../three/layer/raster-layer/) layer (the layer supplies the `hillshade` / `elevationHeatmap` render options).

The RGB→height decoding is configured by `elevationDecoder`.

## Properties

| Property            | Type                                                                                        | Default    | Description                                              |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"raster-dem"`                                                                              | (required) | Source type.                                            |
| `url`               | `string`                                                                                    | (required) | Tile URL template (contains `{z}/{x}/{y}`).             |
| `tms`               | `boolean`                                                                                   | `false`    | Whether the tile scheme is flipped along the Y axis (TMS). |
| `elevationDecoder`  | [`ElevationDecoder`](#elevation-decoder)                                                    | default decoder | How RGB channels decode into a height value.      |
| `tileSize`          | `number`                                                                                    | `256`      | Pixel size of a DEM tile.                              |
| `minZoom`           | `number`                                                                                    | `0`        | Minimum zoom level tiles are provided for.             |
| `maxZoom`           | `number`                                                                                    | `20`       | Maximum zoom level new tiles are requested for.        |
| `overscaledMaxZoom` | `number`                                                                                    | `24`       | Maximum zoom overscaled tiles are used up to.          |

## Examples

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/dem/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  tileSize: 512,
  maxZoom: 17,
});

// As 3D terrain
view.addLayer({ type: "terrain", source: dem });

// As a hillshade raster layer (same source reused)
view.addLayer({ type: "raster", source: dem, hillshade: { exaggeration: 1.5 } });
```

## Elevation Decoder

The `elevationDecoder` describes how the tile's RGB(A) channels decode into a height value.

### Pre-defined constants

`@navara/three` provides decoder constants for common elevation tile providers:

| Constant                        | Use case                                                          |
| ------------------------------- | ----------------------------------------------------------------- |
| `JAPAN_GSI_ELEVATION_DECODER()` | Japan's Geospatial Information Authority (GSI) elevation tiles     |
| `MAPBOX_ELEVATION_DECODER()`    | Mapbox Terrain-RGB tiles                                          |
| `TERRARIUM_ELEVATION_DECODER()` | Terrarium format elevation tiles                                  |

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

view.addSource({
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
});
```

:::note
These constants are functions and must be called with `()`; the call defers to WASM module initialization.
:::

### Custom decoder

You can also pass an explicit decoder object:

| Property    | Type     | Description             |
| ----------- | -------- | ----------------------- |
| `rScaler`   | `number` | Red channel scaler.     |
| `gScaler`   | `number` | Green channel scaler.   |
| `bScaler`   | `number` | Blue channel scaler.    |
| `offset`    | `number` | Height offset.          |
| `maxOffset` | `number` | Maximum offset value.   |
| `minOffset` | `number` | Minimum offset value.   |
| `boundary`  | `number` | Boundary value.         |
| `epsilon`   | `number` | Epsilon (small value).  |

```typescript
{
  elevationDecoder: {
    rScaler: 256.0,
    gScaler: 1.0,
    bScaler: 1.0 / 256.0,
    offset: -32768.0,
    maxOffset: 8848.0,
    minOffset: -11034.0,
    boundary: 0.01,
    epsilon: 0.001,
  },
}
```

## Related Resources

- [About Source](../../../three/source/about/)
- [Terrain Layer](../../../three/layer/terrain-layer/) / [Raster Layer](../../../three/layer/raster-layer/)
- [TerrainMaterial](../../../three/material/terrain-material/) — terrain rendering options
- [HillshadeMaterial](../../../three/material/hillshade-material/) / [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/)
