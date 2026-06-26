---
title: Terrain Layer
description: How to use the terrain layer
sidebar:
  order: 25
---

The Terrain layer is a layer for displaying 3D terrain. It supports two data sources: raster PNG elevation tiles (DEM) decoded on the GPU, and pre-meshed quantized-mesh tiles served by endpoints such as Cesium Ion.

## Basic Configuration

| Property | Type              | Description                                                                                                                                  |
| -------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `"terrain"`       | Layer type (required)                                                                                                                        |
| `data`   | `{ url: string }` | Terrain tile URL (containing `{z}/{x}/{y}` placeholders). Use a `.png` / `.webp` URL for raster DEM, or a `.terrain` URL for quantized-mesh. |

## Supported Materials

| Material                                                                                       | Config key      | Description                                                          |
| ---------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| [RasterTerrainMaterial](../../../three/resource-layer/raster-terrain-material/)                | `rasterTerrain` | Configures terrain appearance and elevation decoder for PNG/WebP DEM |
| [QuantizedMeshTerrainMaterial](../../../three/resource-layer/quantized-mesh-terrain-material/) | `quantizedMesh` | Configures terrain appearance for quantized-mesh tile                |

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
For details on pre-defined decoder constants, see [RasterTerrainMaterial](../../../three/resource-layer/raster-terrain-material/#pre-defined-constants).
:::

### Combined Use with Hillshade

Combining a Terrain layer with a [Hillshade](../../../three/resource-layer/hillshade-material/) layer produces shaded relief on top of the actual 3D surface: the Terrain layer provides the geometry, while the Hillshade layer adds shading driven by elevation gradients. Reusing the same DEM URL for both layers ensures the geometry and shading stay consistent.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const TERRAIN_URL =
  "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png";

// Base raster tile layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// 3D terrain layer (provides geometry)
view.addLayer({
  type: "terrain",
  data: {
    url: TERRAIN_URL,
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  },
});

// Hillshade layer (adds shaded relief on top of the terrain)
view.addLayer({
  type: "tiles",
  data: {
    url: TERRAIN_URL,
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

### Quantized-Mesh with Raster Imagery

A quantized-mesh terrain layer provides only the 3D surface. To show imagery on it, add one or more [Tile Layers](../../../three/resource-layer/tile-layer/) — their raster tiles are draped onto the terrain mesh. Stacking layers works too: later layers render on top, so a higher-resolution overlay can refine a wider base layer.

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

// 3D terrain surface (quantized-mesh)
view.addLayer({
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

// Base raster imagery, draped onto the terrain
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/satellite/{z}/{x}/{y}.jpg",
  },
  rasterTile: {
    maxZoom: 15,
  },
});

// Higher-resolution overlay for closer zooms
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/aerial/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 18,
    minZoom: 10,
  },
});
```

:::note
Raster tiles are WebMercator, while Geographic quantized-mesh terrain is equal-degree, so one terrain tile can overlap several raster tiles. Navara resolves this overlap and reprojects the imagery per fragment, so it aligns correctly even over Geographic terrain. See [QuantizedMeshTerrainMaterial › Combining with Other Layers](../../../three/resource-layer/quantized-mesh-terrain-material/#combining-with-other-layers) for the full compatibility matrix. Vector tiles ([MVT Layer](../../../three/resource-layer/mvt-layer/)) cannot currently be draped onto quantized-mesh terrain.
:::

## Related Resources

- [Tile Layer](../../../three/resource-layer/tile-layer/) - Display raster tiles
- [RasterTerrainMaterial](../../../three/resource-layer/raster-terrain-material/) - Detailed terrain material settings
- [HillshadeMaterial](../../../three/resource-layer/hillshade-material/) - Combine 3D terrain with hillshade rendering
- [QuantizedMeshTerrainMaterial](../../../three/resource-layer/quantized-mesh-terrain-material/) - Quantized-mesh material settings
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - Resolve Cesium Ion quantized-mesh assets and register them as a terrain layer
