---
title: Terrain Layer
description: How to use the terrain layer
sidebar:
  order: 25
---

The Terrain layer is a layer for displaying 3D terrain using elevation data. It loads PNG elevation tiles (DEM) to achieve three-dimensional terrain representation.

## Basic Configuration

| Property   | Type              | Description                                              |
| ---------- | ----------------- | -------------------------------------------------------- |
| `type`     | `"terrain"`       | Layer type (required)                                    |
| `data`     | `{ url: string }` | Elevation tile URL (containing `{z}/{x}/{y}` placeholders) |

## Supported Materials

| Material                                                                              | Config key      | Description                              |
| ------------------------------------------------------------------------------------- | --------------- | ---------------------------------------- |
| [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) | `rasterTerrain` | Configures terrain appearance and elevation decoder |

## Usage Examples

### GSI DEM Tiles

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Mapbox Terrain-RGB

```typescript
import ThreeView, { MAPBOX_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - © Mapbox Terrain-RGB
    //   https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
    url: "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=YOUR_ACCESS_TOKEN",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: MAPBOX_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Terrarium Format

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

:::note
For details on pre-defined decoder constants, see [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/#pre-defined-constants).
:::

## Related Resources

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - Display raster tiles
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - Detailed terrain material settings
