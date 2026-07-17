---
title: CesiumIonPlugin
description: Cesium Ion quantized-mesh terrain plugin for navara_three.
sidebar:
  order: 5
---

## Overview

`CesiumIonPlugin` resolves a [Cesium Ion](https://cesium.com/platform/cesium-ion/) asset endpoint at `init()` time and exposes `addTerrain()` to register the asset as a quantized-mesh terrain layer on the view.

The plugin handles the Cesium Ion authentication flow — fetching the asset endpoint URL and access token from `https://api.cesium.com/v1/assets/<assetId>/endpoint` — so your application only needs to supply the asset id and your Cesium Ion access token.

## Usage

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three_default_plugin";
import { CesiumIonPlugin } from "@navaramap/three_plugins";

const view = new ThreeView({ container, animation: true });
const cesiumIon = new CesiumIonPlugin({
  assetId: 12345, // Cesium ion asset id
  accessToken: "<your cesium ion token>",
});

view.addPlugin(new DefaultPlugin());
view.addPlugin(cesiumIon);
await view.init();

cesiumIon.addTerrain({
  maxZoom: 14,
  castShadow: true,
  receiveShadow: true,
  tms: true,
  geographic: true,
  requestVertexNormals: true,
  requestWaterMask: true,
});
```

## Constructor

```typescript
new CesiumIonPlugin(config: CesiumIonConfig)
```

### CesiumIonConfig

| Property      | Type               | Default                              | Description                                                                                  |
| ------------- | ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `assetId`     | `number \| string` | —                                    | Cesium Ion asset id.                               |
| `accessToken` | `string`           | —                                    | Cesium Ion access token used to resolve the asset endpoint.                                  |
| `endpoint`    | `string`           | `"https://api.cesium.com/v1/assets"` | Override the Cesium Ion asset endpoint base URL (e.g. for proxies or self-hosted endpoints). |

## Methods

### addTerrain(options)

```typescript
addTerrain(options?: CesiumIonTerrainOptions): Layer
```

Registers the resolved Cesium Ion asset as a quantized-mesh terrain layer — internally it creates a `quantized-mesh` source (`view.addSource(...)`) and renders it with `view.addLayer({ type: "terrain", source })`. Must be called after `view.init()` has completed; otherwise the endpoint has not yet been resolved and the call throws.

Returns the `Layer` handle returned by `view.addLayer()`.

## Types

### CesiumIonTerrainOptions

`CesiumIonTerrainOptions` is a flat object combining the `quantized-mesh` source's fetch/decode options (with `type`, `url`, and `token` removed — the plugin supplies those from the resolved Cesium Ion endpoint) with the terrain layer's mesh render options. The plugin routes each field to `view.addSource()` or `view.addLayer()` internally.

Commonly used options:

| Property               | Type      | Description                                                                                              |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `maxZoom`              | `number`  | Maximum zoom level fetched from the Cesium Ion endpoint.                                                 |
| `minZoom`              | `number`  | Minimum zoom level fetched from the Cesium Ion endpoint.                                                 |
| `overscaledMaxZoom`    | `number`  | The terrain is upsampled until it reaches this zoom level.                                               |
| `castShadow`           | `boolean` | Whether the terrain casts shadows.                                                                       |
| `receiveShadow`        | `boolean` | Whether the terrain receives shadows.                                                                    |
| `tms`                  | `boolean` | Whether the source endpoint uses TMS tile coordinates. Cesium Ion quantized-mesh assets are TMS.         |
| `geographic`           | `boolean` | Whether the source endpoint uses a geographic (EPSG:4326) tiling scheme. Cesium Ion quantized-mesh is.   |
| `requestVertexNormals` | `boolean` | Request per-vertex normals from the Cesium Ion endpoint. Required for lighting from quantized-mesh data. |
| `requestWaterMask`     | `boolean` | Request the water mask from the Cesium Ion endpoint.                                                     |
| `skirt`                | `boolean` | Whether to render terrain tile skirts.                                                                   |
| `skirtExaggeration`    | `number`  | Multiplier applied to skirt height.                                                                      |
| `show`                 | `boolean` | Whether the terrain is visible.                                                                          |
| `showBoundingBox`      | `boolean` | Render per-tile bounding boxes (debug).                                                                  |

See the `quantized-mesh` source and the terrain layer's `terrain` render options for the complete list.

## Related Resources

- [About three_plugins](../about/) — Package overview
- [Terrain Layer](../../three/layer/terrain-layer/) — Terrain layer reference
