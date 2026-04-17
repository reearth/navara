---
title: About Layer
description: An explanation of the layer concept.
sidebar:
  order: 4
---

## What is a Layer?

In navara_three, elements displayed in the 3D scene are managed as "layers." Map data rendering, 3D object placement, post-processing effects, lighting, and more can all be added and controlled as layers.

## Layer Types

navara_three has 4 types of layers:

| Layer Type           | Description                                            | Method                                                   |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| **Resource Layer**   | Loads and displays geographic data from external data sources | `addLayer()` with data format name (`"geojson"`, `"terrain"`, etc.) |
| **Mesh Layer**       | Adds 3D mesh objects to the scene                      | `addMesh()`                                              |
| **Effect Layer**     | Applies post-processing effects                        | `addEffect()`                                            |
| **Light Layer**      | Manages scene lighting                                 | `addLight()`                                             |

## Differences Between Resource Layers and Other Layers

Resource layers handle external geographic data, so they differ from mesh, effect, and light layers in how they are used.

### Resource Layer

Resource layers load and display external data sources such as GeoJSON, 3D Tiles, and terrain data.

**Characteristics:**

- Specify the data format name for `type` (`"geojson"`, `"terrain"`, `"cesium3dtiles"`, `"tiles"`, `"mvt"`, etc.)
- Specify the data source URL or inline data with the `data` property
- Multiple Materials can be specified depending on the data format
- Available Materials vary by data format

```typescript
// GeoJSON layer example
const geoJsonLayer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  // For GeoJSON, you can specify multiple Materials such as point, polyline, polygon
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});

// Terrain layer example
const terrainLayer = view.addLayer({
  type: "terrain",
  data: { url: "https://example.com/terrain/{z}/{x}/{y}.png" },
  // For terrain layers, only the rasterTerrain Material can be specified
  rasterTerrain: { exaggeration: 1.5 },
});
```

### Mesh, Effect, and Light Layers

Mesh layers, effect layers, and light layers create Three.js objects directly on the client side.

**Characteristics:**

- Use the dedicated method for each type: `addMesh()`, `addEffect()`, or `addLight()`
- Each layer has a single Material (configuration object)
- The Material key name determines the layer type
- **Layer class registration is required before use** (`registerMesh`, `registerEffect`, `registerLight`)

```typescript
import { BoxMeshLayer, FXAAEffectLayer, SunLightLayer } from "@navara/three_default_layers";

// Register layer classes (required before addMesh/addEffect/addLight)
view.registerMesh("box", BoxMeshLayer);
view.registerEffect("fxaa", FXAAEffectLayer);
view.registerLight("sun", SunLightLayer);

// Mesh layer example (BoxMeshLayer)
const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    // Recognized as BoxMeshLayer by the box key
    width: 100,
    height: 100,
  },
});

// Effect layer example (FXAAEffectLayer)
const fxaaLayer = view.addEffect<FXAAEffectLayer>({
  fxaa: {
    // Recognized as FXAAEffectLayer by the fxaa key
  },
});

// Light layer example (SunLightLayer)
const sunLayer = view.addLight<SunLightLayer>({
  sun: {
    // Recognized as SunLightLayer by the sun key
    intensity: 1.0,
    castShadow: true,
  },
});
```

:::tip
Using `DefaultPlugin` from [three_default_plugin](../../../three_default_plugin/about/), you can register all default layers at once.
:::

## Differences in Returned Handle Classes

The handle class returned from `view.addLayer()` / `view.addMesh()` / `view.addEffect()` / `view.addLight()` differs depending on the layer type:

| Layer Type                       | Returned Class   | Main Features                                                                    |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| Resource Layer                   | `Layer`          | `update()`, `delete()`, `forceUpdate()`, feature events                          |
| Mesh / Effect / Light Layer      | `LayerHandle<T>` | `update()`, `delete()`, `visible`, `ref` (access to the base instance)           |

### Layer (for Resource Layers)

```typescript
const geoJsonLayer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
});

// Update by fully overwriting the configuration
geoJsonLayer.update({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0x00ff00 },
});

// Subscribe to feature events
geoJsonLayer.on("featureCreated", (evaluator) => {
  console.log("A feature was created");
});

// Delete the layer
geoJsonLayer.delete();
```

### LayerHandle (for Mesh / Effect / Light Layers)

```typescript
// BoxMeshLayer must be registered
const boxLayer = view.addMesh<BoxMeshLayer>({
  box: { width: 100, height: 100, depth: 100 },
});

// Partial update (only the specified properties are changed)
boxLayer.update({ width: 200 });

// Toggle visibility
boxLayer.visible = false;

// Access the underlying Three.js object
const boxMesh = boxLayer.ref;

// Delete the layer
boxLayer.delete();
```

For detailed API reference, see [Layer Types](../../../three/api-reference/layer-types/).

## Summary

| Aspect              | Resource Layer                     | Mesh / Effect / Light Layer                                 |
| ------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Purpose             | Loading and displaying external data | 3D objects, effects, lighting                              |
| Method               | `addLayer()` with data format name | `addMesh()`, `addEffect()`, `addLight()`                   |
| Pre-registration    | Not required                       | Required (`registerMesh` / `registerEffect` / `registerLight`) |
| Number of Materials | Multiple depending on the data     | 1 Material per layer                                        |
| Handle Class        | `Layer`                            | `LayerHandle<T>`                                            |
| Update Method       | Overwrite with a complete configuration object | Partial updates are possible                       |

## Related Resources

- [Resource Layer](../../../three/resource-layer/about/) - Resource layer details
- [three_default_layers](../../../three_default_layers/about/) - Default layer details
