---
title: MeshDesc
description: Base class properties and features shared by all mesh layers
sidebar:
  order: 99
---

`MeshDesc` is the base class for all mesh layers. It provides common configuration properties, transform composition, and picking support. Every mesh layer — both built-in and custom — inherits from this class, so the features described here are available on all mesh layers.

## Common Properties

| Property      | Type                                   | Default        | Description                                                                                    |
|---------------|----------------------------------------|----------------|------------------------------------------------------------------------------------------------|
| `id`          | `string`                               | Auto-generated | Unique identifier for the layer                                                                |
| `visible`     | `boolean`                              | `true`         | Toggle visibility of the layer                                                                 |
| `position`    | `{ x: number, y: number, z: number }`  | -              | Position (ECEF), or local offset when `matrix`/`matrixWorld` is set                            |
| `rotation`    | `{ x: number, y: number, z: number }`  | -              | Rotation (Euler angles, radians), or local offset when `matrix`/`matrixWorld` is set           |
| `scale`       | `{ x: number, y: number, z: number }`  | -              | Scale, or local offset when `matrix`/`matrixWorld` is set                                      |
| `matrix`      | `Matrix4`                              | -              | Local transform matrix. When set, `position`/`rotation`/`scale` become offsets within this frame |
| `matrixWorld` | `Matrix4`                              | -              | World transform matrix. When set, `position`/`rotation`/`scale` become offsets within this frame |
| `pickable`    | `boolean`                              | `false`        | Enable GPU-based click picking for this mesh                                                   |

## Transform Composition

`MeshDesc` supports three transform modes.

### Standard Transforms

When neither `matrix` nor `matrixWorld` is set, `position`, `rotation`, and `scale` are applied directly to the Three.js object in the ECEF coordinate system — the same way standard Three.js transforms work.

### Local Frame with `matrix`

When `matrix` is set, Three.js `matrixAutoUpdate` is disabled and the final local matrix is computed as:

```
effective = matrix · T(position) · R(rotation) · S(scale)
```

This lets you supply a base frame and then express offsets within that frame.

### World Frame with `matrixWorld`

When `matrixWorld` is set, both `matrixAutoUpdate` and `matrixWorldAutoUpdate` are disabled, and the final world matrix is computed as:

```
effective = matrixWorld · T(position) · R(rotation) · S(scale)
```

This is the most common mode for geographic placement. You supply a world-space reference frame (e.g., an ENU tangent frame from `eastNorthUpToFixedFrame()`) and express local offsets within that frame. This eliminates the need to manually compose frame matrices when positioning meshes on the globe.

### Example: Placing Meshes in an ENU Frame

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  eastNorthUpToFixedFrame,
  degreeToRadian,
} from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_layers";

const view = new ThreeView();
view.registerMesh("box", BoxMeshDesc);
await view.init();

// Compute the ENU frame at a geographic origin
const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// Place a box 200m east and 50m above the origin
const box1 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 100, depth: 50, color: new Color().setHex(0xff0000) },
  matrixWorld: enuFrame,
  position: { x: 200, y: 50, z: 0 },
});

// Place another box 100m north
const box2 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 80, depth: 50, color: new Color().setHex(0x00ff00) },
  matrixWorld: enuFrame,
  position: { x: 0, y: 40, z: 100 },
});
```

## Picking

Mesh layers can opt into GPU-based click picking by setting `pickable: true` in the layer config. The picking system renders pickable meshes into a dedicated single-pixel render target with each mesh's batch ID encoded as an RGB color, reads back the pixel, and emits a `"pick"` event identifying which mesh was clicked.

:::note
To use picking, you must set `picking: true` in the ThreeView constructor.
:::

### Basic Usage

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_layers";

const view = new ThreeView({ picking: true });
view.registerMesh("box", BoxMeshDesc);
await view.init();

const boxLayer = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
  pickable: true,
});

view.on("pick", (info) => {
  if (info) {
    console.log("Picked layer:", info.layerId);
    console.log("Batch ID:", info.batchId);
  }
});
```

### Batch ID

The batch ID is a unique 24-bit integer assigned to each pickable mesh (or each instance in an instanced mesh layer). You can read it from the layer reference to determine which mesh was clicked:

```typescript
// Single mesh layer
const batchId = boxLayer.ref.batchId;

// Instanced mesh layer — one batch ID per instance
const batchIds = instancedLayer.ref.batchIds;
```

### Responding to Picks

```typescript
view.on("pick", (info) => {
  if (info && info.batchId === boxLayer.ref.batchId) {
    // Highlight the selected box
    boxLayer.update({ box: { color: new Color().setHex(0xffff00) } });
  }
});
```

### PickedFeature Type

```typescript
type PickedFeature = {
  batchId: number;                        // 24-bit encoded ID
  properties?: Record<string, unknown>;   // Feature properties (for GIS layers)
  layerId?: string;                       // Layer identifier
};
```

For implementing picking in custom layers, see [Custom Layer — Mesh Picking](../../three/core/custom-layer/#mesh-picking).

## Coordinate Transformation

The `position` property uses the ECEF (Earth-Centered, Earth-Fixed) coordinate system. To convert from latitude/longitude/altitude (geodetic coordinates) to ECEF, use the `geodeticToVector3()` function.

:::note
Latitude and longitude must be specified in **radians**. Use `degreeToRadian()` to convert from degrees to radians.
:::

### Basic Coordinate Transformation

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three";
import { SphereMeshDesc } from "@navara/three_default_layers";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshDesc);
await view.init();

// Convert from latitude/longitude/altitude to ECEF coordinates
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // Latitude (radians)
  lng: degreeToRadian(139.767125), // Longitude (radians)
  height: 200,                      // Altitude (meters)
});

// Add a mesh layer with the converted coordinates
const sphereLayer = view.addMesh<SphereMeshDesc>({
  sphere: {
    radius: 100,
    color: new Color().setHex(0x00aaff),
  },
  position: {
    x: position.x,
    y: position.y,
    z: position.z,
  },
});
```

### Using ENU (East-North-Up) Coordinate System

To place meshes using a local coordinate system (ENU: East-North-Up), use `eastNorthUpToFixedFrame()`.

```typescript
import {
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
} from "@navara/three";
import { GLTFModelDesc } from "@navara/three_default_layers";
import { Vector3, Quaternion, Euler } from "three";

// GLTFModelDesc must be registered

// Compute position
const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// Place the model along the Earth's surface
const modelLayer = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "/models/building.gltf",
  },
  matrixWorld: enuFrame,
});
```

### Coordinate Transformation Functions

| Function | Description |
|------|------|
| `geodeticToVector3()` | Converts geodetic coordinates (latitude/longitude/altitude) to ECEF coordinates (Vector3) |
| `vector3ToGeodetic()` | Converts ECEF coordinates (Vector3) to geodetic coordinates |
| `degreeToRadian()` | Converts degrees to radians |
| `radianToDegree()` | Converts radians to degrees |
| `geodeticSurfaceNormal()` | Gets the Earth's surface normal vector at the specified position |
| `eastNorthUpToFixedFrame()` | Gets the transformation matrix to the ENU coordinate system |

For details, see [navara_three_api](../API%20Reference/navara_three_api).
