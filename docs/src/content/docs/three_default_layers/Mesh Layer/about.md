---
title: Mesh Layer
description: Mesh layer types for navara_three
sidebar:
  order: 100
---

`MeshLayer` is a layer type for adding 3D mesh objects to the scene. It can display various 3D objects.

## Available MeshLayer Types

The following MeshLayer types are available in navara_three:

| Layer Type | Description |
|------------|------|
| [ArclineMeshLayer](./arcline-mesh-layer) | A layer that draws arc-shaped lines connecting two points |
| [BoxMeshLayer](./box-mesh-layer) | A layer that draws box geometry |
| [InstancedBoxMeshLayer](./instanced-box-mesh-layer) | A GPU-instanced layer that renders multiple boxes in a single draw call |
| [CylinderMeshLayer](./cylinder-mesh-layer) | A layer that draws cylinder geometry |
| [GLTFModelLayer](./gltf-model-layer) | A layer that loads and displays GLTF/GLB format 3D models |
| [GlowGlobeMeshLayer](./glow-globe-mesh-layer) | A layer that displays a Fresnel-effect glow around the globe |
| [PlaneMeshLayer](./plane-mesh-layer) | A layer that draws plane geometry |
| [RainMeshLayer](./rain-mesh-layer) | A layer that displays rain particle effects |
| [SkyBoxMeshLayer](./sky-box-mesh-layer) | A layer that draws a simple skybox |
| [SkyMeshLayer](./sky-mesh-layer) | A layer that draws the sky, sun, and moon using atmospheric scattering |
| [SmoothLineMeshLayer](./smooth-line-mesh-layer) | A layer that draws smooth lines using Catmull-Rom curves |
| [SnowMeshLayer](./snow-mesh-layer) | A layer that displays snow particle effects |
| [SphereMeshLayer](./sphere-mesh-layer) | A layer that draws sphere geometry |
| [StarsLayer](./stars-layer) | A layer that draws a starry sky |
| [TubeMeshLayer](./tube-mesh-layer) | A layer that draws tube geometry |
| [AxesHelperLayer](./axes-helper-layer) | A debug helper layer that visualizes the 3 axes |
| [ArrowHelperLayer](./arrow-helper-layer) | A debug helper layer that visualizes vector directions |

## Basic Usage

MeshLayer is added by registering the layer class and then calling the `view.addMesh()` method:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// Register the layer class
view.registerMesh("box", BoxMeshLayer);

await view.init();

// Add a BoxMeshLayer
const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

## Common Properties

All MeshLayers have the following basic settings:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | Auto-generated | Unique identifier for the layer |
| `visible` | `boolean` | `true` | Toggle visibility of the layer |
| `position` | `{ x: number, y: number, z: number }` | - | Position of the mesh (ECEF coordinate system) |
| `rotation` | `{ x: number, y: number, z: number }` | - | Rotation of the mesh (Euler angles, radians) |
| `scale` | `{ x: number, y: number, z: number }` | - | Scale of the mesh |

## Coordinate Transformation

The `position` property of MeshLayer uses the ECEF (Earth-Centered, Earth-Fixed) coordinate system. To convert from latitude/longitude/altitude (geodetic coordinates) to the ECEF coordinate system, use the `geodeticToVector3()` function.

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
import { SphereMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshLayer);
await view.init();

// Convert from latitude/longitude/altitude to ECEF coordinates
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // Latitude (radians)
  lng: degreeToRadian(139.767125), // Longitude (radians)
  height: 200,                      // Altitude (meters)
});

// Add a mesh layer with the converted coordinates
const sphereLayer = view.addMesh<SphereMeshLayer>({
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

### Setting Rotation Along the Earth's Surface

To place a mesh along the Earth's surface, obtain the surface normal vector using `geodeticSurfaceNormal()` and compute the rotation.

```typescript
import {
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
} from "@navara/three";
import { GLTFModelLayer } from "@navara/three_default_layers";
import { Vector3, Quaternion, Euler } from "three";

// GLTFModelLayer must be registered

// Compute position
const lat = degreeToRadian(35.681236);
const lng = degreeToRadian(139.767125);
const height = 0;

const position = geodeticToVector3({ lat, lng, height });

// Get the surface normal vector
const normal = geodeticSurfaceNormal({ lat, lng, height });

// Compute rotation to align the Y-axis (up direction) with the normal
const up = new Vector3(0, 1, 0);
const quaternion = new Quaternion().setFromUnitVectors(up, normal);
const euler = new Euler().setFromQuaternion(quaternion);

// Place the model along the Earth's surface
const modelLayer = view.addMesh<GLTFModelLayer>({
  gltfModel: {
    url: "/models/building.gltf",
  },
  position: { x: position.x, y: position.y, z: position.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});
```

### Using ENU (East-North-Up) Coordinate System

To place meshes using a local coordinate system (ENU: East-North-Up), use `eastNorthUpToFixedFrame()`.

```typescript
import {
  geodeticToVector3,
  eastNorthUpToFixedFrame,
  degreeToRadian,
} from "@navara/three";
import { Vector3 } from "three";

const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});

// Get the ENU transformation matrix
const enuMatrix = eastNorthUpToFixedFrame(position);

// Extract east and north direction vectors from the ENU matrix
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// Compute a position 100m to the east
const offsetPosition = position.clone().add(east.multiplyScalar(100));
```

### Reverse Conversion from ECEF to Geodetic Coordinates

To convert back from ECEF coordinates to latitude/longitude/altitude, use `vector3ToGeodetic()` and `radianToDegree()`.

```typescript
import {
  vector3ToGeodetic,
  radianToDegree,
} from "@navara/three";

// Get the current position of the mesh
const worldPosition = meshLayer.ref.getWorldPosition();

// Convert from ECEF to geodetic coordinates
const geodetic = vector3ToGeodetic(worldPosition);

// Convert from radians to degrees
const latitude = radianToDegree(geodetic.lat);
const longitude = radianToDegree(geodetic.lng);
const height = geodetic.height;

console.log(`Latitude: ${latitude}°, Longitude: ${longitude}°, Altitude: ${height}m`);
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

For detailed usage, refer to the documentation for each layer type.
