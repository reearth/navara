---
title: Terrain Layer
description: How to use the terrain layer
sidebar:
  order: 25
---

The Terrain layer is a layer for displaying 3D terrain. It supports two data sources: raster PNG elevation tiles (DEM) decoded on the GPU, and pre-meshed quantized-mesh tiles served by endpoints such as Cesium Ion.

## Basic Configuration

| Property   | Type              | Description                                              |
| ---------- | ----------------- | -------------------------------------------------------- |
| `type`     | `"terrain"`       | Layer type (required)                                    |
| `data`     | `{ url: string }` | Terrain tile URL (containing `{z}/{x}/{y}` placeholders). Use a `.png` / `.webp` URL for raster DEM, or a `.terrain` URL for quantized-mesh. |

## Supported Materials

| Material                                                                                          | Config key       | Description                                                          |
| ------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/)         | `rasterTerrain`  | Configures terrain appearance and elevation decoder for PNG/WebP DEM |
| [QuantizedMeshTerrainMaterial](../../../three/resource-layer-reference/quantized-mesh-terrain-material/) | `quantizedMesh`  | Configures terrain appearance for quantized-mesh tile sources        |

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

### Quantized-Mesh (Cesium Ion)

For Cesium Ion quantized-mesh assets, the asset endpoint and access token are resolved at runtime, so the recommended path is to use the [`CesiumIonPlugin`](../../../three_plugins/cesiumionplugin/) instead of calling `addLayer` directly:

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { CesiumIonPlugin } from "@navara/three_plugins";

const view = new ThreeView(/* options */);
const cesiumIon = new CesiumIonPlugin({
  assetId: 1, // Cesium World Terrain
  accessToken: "<your cesium ion token>",
});

view.addPlugin(new DefaultPlugin());
view.addPlugin(cesiumIon);
await view.init();

cesiumIon.addTerrain({
  maxZoom: 18,
  castShadow: true,
  receiveShadow: true,
  requestVertexNormals: true,
  requestWaterMask: true,
});
```

### Quantized-Mesh (Self-hosted endpoint)

You can also pass a tile URL directly and configure the `quantizedMesh` material:

```typescript
const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/{z}/{x}/{y}.terrain",
  },
  quantizedMesh: {
    maxZoom: 18,
    castShadow: true,
    receiveShadow: true,
    requestVertexNormals: true,
    requestWaterMask: true,
  },
});
```

## Related Resources

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - Display raster tiles
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - Detailed terrain material settings
- [QuantizedMeshTerrainMaterial](../../../three/resource-layer-reference/quantized-mesh-terrain-material/) - Quantized-mesh material settings
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - Resolve Cesium Ion quantized-mesh assets and register them as a terrain layer
