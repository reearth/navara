---
title: What is navara_three?
description: Overview and features of navara_three.
sidebar:
  order: 1
---

## What is navara_three?

`navara_three` is a JavaScript library that connects Three.js with Navara's headless map engine. It enables you to build high-quality 3D map applications on the web.

## Features of navara_three

### Declarative Layer API

In navara_three, all elements displayed on the map can be added declaratively as "layers."

```typescript
// Add GeoJSON data as a layer
const layer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  polygon: { color: 0x3388ff, opacity: 0.6 },
});
```

Many data formats that were complex in traditional GIS development (GeoJSON, MVT, 3D Tiles, terrain data, raster tiles, etc.) can all be handled through a unified layer API.

### Styling with Materials

Each layer is styled by specifying Materials. You can flexibly specify color, size, opacity, and more for each feature type such as points, lines, and polygons.

```typescript
view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});
```

### 3D Objects, Effects, and Lights Managed as Layers

Not only GIS data, but also 3D meshes, post-processing effects, and lighting can be added as layers. This allows you to manage maps and visual effects through a unified API.

Mesh, effect, and light layers require layer class registration before use.

```typescript
import { BoxMeshLayer, FXAAEffectLayer, SunLightLayer } from "@navara/three_default_layers";

// Register layer classes
view.registerMesh("box", BoxMeshLayer);
view.registerEffect("fxaa", FXAAEffectLayer);
view.registerLight("sun", SunLightLayer);

// Add a 3D box
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });

// Apply anti-aliasing
view.addEffect({ fxaa: {} });

// Add sunlight
view.addLight({ sun: { intensity: 1.0 } });
```

### Dynamic Access to Features

Layers support not only declarative addition but also dynamic access to features. You can access individual features through events to implement data-driven styling and interaction.

```typescript
import { Color } from "@navara/three";

layer.on("featureUpdated", (evaluator) => {
  // Dynamically change styles based on feature properties
  evaluator.evaluate((batchId, property) => {
    const population = property?.["population"] as number;
    return {
      color: new Color().setHex(population > 1000000 ? 0xff0000 : 0x00ff00),
    };
  });
});
```
