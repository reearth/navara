---
title: Cesium 3D Tiles Layer
description: How to use the Cesium 3D Tiles layer
sidebar:
  order: 22
---

The Cesium 3D Tiles layer is a layer for displaying large-scale 3D datasets in the 3D Tiles format. It can efficiently display building models, point clouds, photogrammetry data, and more.

## Basic Configuration

| Property   | Type              | Description              |
| ---------- | ----------------- | ------------------------ |
| `type`     | `"cesium3dtiles"` | Layer type (required)    |
| `data`     | `{ url: string }` | URL of tileset.json      |

## Supported Materials

| Material                                                                         | Config key | Description                    |
| ------------------------------------------------------------------------ | -------- | --------------------- |
| [ModelMaterial](../../../three/resource-layer-reference/model-material/) | `model`  | Controls 3D model appearance |

## Usage Examples

### Basic 3D Tiles Layer

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const tilesLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
    url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 0.1,
    roughness: 0.1,
  },
});
```

### Google Photorealistic 3D Tiles

You can also add [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles). A Google Maps API key is required for use.

```typescript
import ThreeView, { type Layer } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const layer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${YOUR_GOOGLE_MAPS_API_KEY}`,
  },
  model: {
    maxSse: 60,
  },
});
```

### Dynamic Credit Retrieval

For data sources such as Google Photorealistic 3D Tiles, you need to dynamically retrieve and display credits corresponding to the tiles currently being shown. You can track credits using events from the `Layer` class.

**Available events:**

| Event name                 | Description                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `featureCreated`           | Fires when a feature (tile) is created. Credit information is available via the `credit` property |
| `featureRemoved`           | Fires when a feature is removed                                                             |
| `featureVisibilityChanged` | Fires when a feature's visibility is toggled                                                |

**Usage example:**

```typescript
import ThreeView, { type Layer } from "@navara/three";

const layer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${YOUR_GOOGLE_MAPS_API_KEY}`,
  },
  model: {
    maxSse: 60,
  },
});

// Map to hold credit information
const featureCredits = new Map<bigint, string>();
// Track currently visible features
const visibleFeatures = new Set<bigint>();

// Helper function to update credit display
const updateCreditsDisplay = () => {
  const creditCounts = new Map<string, number>();
  for (const id of visibleFeatures) {
    const credit = featureCredits.get(id);
    if (credit) {
      // Split multiple credits separated by semicolons
      credit.split(";").forEach((c) => {
        const trimmed = c.trim();
        creditCounts.set(trimmed, (creditCounts.get(trimmed) ?? 0) + 1);
      });
    }
  }
  // creditCounts contains credit strings and their occurrence counts
  console.log("Visible credits:", Array.from(creditCounts.keys()));
};

// On feature creation: save credit information
layer.on("featureCreated", ({ featureId, credit }) => {
  if (credit) {
    featureCredits.set(featureId, credit);
  }
  visibleFeatures.add(featureId);
  updateCreditsDisplay();
});

// On feature removal: delete credit information
layer.on("featureRemoved", ({ featureId }) => {
  featureCredits.delete(featureId);
  visibleFeatures.delete(featureId);
  updateCreditsDisplay();
});

// On visibility change: update visibleFeatures
layer.on("featureVisibilityChanged", ({ featureId, visible }) => {
  if (visible) {
    visibleFeatures.add(featureId);
  } else {
    visibleFeatures.delete(featureId);
  }
  updateCreditsDisplay();
});
```

:::warning
When using Google Photorealistic 3D Tiles, you must display appropriate credits in accordance with the [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms).
:::

## Related Resources

- [ModelMaterial](../../../three/resource-layer-reference/model-material/) - Detailed model material settings
