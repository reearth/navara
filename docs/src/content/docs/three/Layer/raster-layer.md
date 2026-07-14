---
title: Raster Layer
description: Render a raster-tile or raster-dem source as imagery, hillshade, or elevation heatmap
sidebar:
  order: 420
---

A `raster` layer renders a [`raster-tile`](../../../three/source/raster-tile-source/) source as imagery, or a [`raster-dem`](../../../three/source/raster-dem-source/) source as hillshade or an elevation heatmap. When a [`terrain`](../../../three/layer/terrain-layer/) layer is present, the imagery is draped onto the 3D surface; otherwise it renders on the flat globe.

## Properties

| Property | Type               | Description                                            |
| -------- | ------------------ | ----------------------------------------------------- |
| `type`   | `"raster"`         | Layer type (required).                                |
| `source` | `Source \| string` | The `raster-tile` or `raster-dem` source (required).  |

### Render options

| Material                                                                              | Config key         | Description                                                     |
| ------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| [RasterMaterial](../../../three/material/raster-material/)                       | `raster`           | Imagery appearance (color, opacity, …).                        |
| [HillshadeMaterial](../../../three/material/hillshade-material/)                 | `hillshade`        | Shaded relief from a `raster-dem` source.                      |
| [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/)  | `elevationHeatmap` | Color-coded elevation from a `raster-dem` source.              |

:::note
`hillshade` and `elevationHeatmap` decode DEM tiles, so they require a `raster-dem` source. The elevation decoder is taken from the source (`raster-dem`'s `elevationDecoder`), not from the render options.
:::

## Examples

### Imagery

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 19,
});

view.addLayer({ type: "raster", source: imagery, raster: { opacity: 1 } });
```

### Hillshade

Reference a `raster-dem` source; the decoder lives on the source.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/terrarium/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  maxZoom: 17,
  minZoom: 5,
});

view.addLayer({
  type: "raster",
  source: dem,
  hillshade: { exaggeration: 0.5 },
});
```

### Elevation heatmap

```typescript
view.addLayer({
  type: "raster",
  source: dem,
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    logarithmic: true,
    logBoundary: 1000,
  },
});
```

## Related Resources

- [Raster Tile Source](../../../three/source/raster-tile-source/) / [Raster DEM Source](../../../three/source/raster-dem-source/)
- [RasterMaterial](../../../three/material/raster-material/) / [HillshadeMaterial](../../../three/material/hillshade-material/) / [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/)
- [Terrain Layer](../../../three/layer/terrain-layer/) — drape imagery onto 3D terrain
