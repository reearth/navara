---
title: Tile Layer
description: How to use the raster tile layer
sidebar:
  order: 26
---

The Tile layer is a layer for displaying XYZ raster tiles (aerial photos, satellite imagery, map tiles, etc.).

## Basic Configuration

| Property   | Type              | Description                                          |
| ---------- | ----------------- | ---------------------------------------------------- |
| `type`     | `"tiles"`         | Layer type (required)                                |
| `data`     | `{ url: string }` | Tile URL (containing `{z}/{x}/{y}` placeholders)    |

## Supported Materials

| Material                                                                                    | Config key         | Description                                       |
| ------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------- |
| [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/)         | `rasterTile`       | Configures tile appearance                        |
| [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) | `elevationHeatmap` | Displays elevation data as a heatmap              |
| [HillshadeMaterial](../../../three/resource-layer-reference/hillshade-material/)            | `hillshade`        | Renders shaded relief (hillshade) from DEM tiles  |

## Usage Examples

### OpenStreetMap Tiles

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const osmLayer = view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    color: new Color().setHex(0xffffff),
    maxZoom: 23,
    wireframe: false,
    opacity: 1,
  },
});
```

### Elevation Heatmap

Elevation data can be color-coded to visualize terrain elevation differences.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const heatmapLayer = view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    logarithmic: true,
    logBoundary: 1000,
  },
});
```

### Hillshade

Hillshade renders shaded relief from DEM tiles, emphasizing terrain features such as ridges and valleys. It can be used on top of a flat basemap, or combined with a [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) for shaded relief over 3D terrain.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const hillshadeLayer = view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
});
```

## Related Resources

- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - Display 3D terrain
- [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/) - Detailed tile material settings
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - Detailed heatmap material settings
- [HillshadeMaterial](../../../three/resource-layer-reference/hillshade-material/) - Detailed hillshade material settings
