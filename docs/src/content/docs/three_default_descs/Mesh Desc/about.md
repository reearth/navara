---
title: Mesh Descriptor
description: Mesh descriptor types for navara_three
sidebar:
  order: 100
---

`MeshDesc` is a descriptor type for adding 3D mesh objects to the scene. It can display various 3D objects.

All mesh descriptors inherit from [`MeshDesc`](./mesh-desc-base), which provides common properties such as `position`, `rotation`, `scale`, `matrix`, `matrixWorld`, and `pickable`. See the [MeshDesc](./mesh-desc-base) page for details on transform composition, picking, and coordinate transformation.

## Available Mesh Descriptor Types

The following MeshDescriptor types are available in navara_three:

| Descriptor Type | Description |
|------------|------|
| [ArclineMeshDesc](./arcline-mesh-desc) | A Descriptor that draws arc-shaped lines connecting two points |
| [BoxMeshDesc](./box-mesh-desc) | A Descriptor that draws box geometry |
| [InstancedBoxMeshDesc](./instanced-box-mesh-desc) | A GPU-instanced Descriptor that renders multiple boxes in a single draw call |
| [CylinderMeshDesc](./cylinder-mesh-desc) | A Descriptor that draws cylinder geometry |
| [GLTFModelDesc](./gltf-model-desc) | A Descriptor that loads and displays GLTF/GLB format 3D models |
| [GlowGlobeMeshDesc](./glow-globe-mesh-desc) | A Descriptor that displays a Fresnel-effect glow around the globe |
| [PlaneMeshDesc](./plane-mesh-desc) | A Descriptor that draws plane geometry |
| [RainMeshDesc](./rain-mesh-desc) | A Descriptor that displays rain particle effects |
| [SkyBoxMeshDesc](./sky-box-mesh-desc) | A Descriptor that draws a simple skybox |
| [SkyMeshDesc](./sky-mesh-desc) | A Descriptor that draws the sky, sun, and moon using atmospheric scattering |
| [SmoothLineMeshDesc](./smooth-line-mesh-desc) | A Descriptor that draws smooth lines using Catmull-Rom curves |
| [SnowMeshDesc](./snow-mesh-desc) | A Descriptor that displays snow particle effects |
| [SphereMeshDesc](./sphere-mesh-desc) | A Descriptor that draws sphere geometry |
| [StarsDesc](./stars-desc) | A Descriptor that draws a starry sky |
| [TubeMeshDesc](./tube-mesh-desc) | A Descriptor that draws tube geometry |
| [AxesHelperDesc](./axes-helper-desc) | A debug helper Descriptor that visualizes the 3 axes |
| [ArrowHelperDesc](./arrow-helper-desc) | A debug helper Descriptor that visualizes vector directions |

## Basic Usage

A mesh descriptor is added by registering the descriptor class and then calling the `view.addMesh()` method:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();

// Register the descriptor class
view.registerMesh("box", BoxMeshDesc);

await view.init();

// Add a BoxMeshDesc
const boxDesc = view.addMesh<BoxMeshDesc>({
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

All Mesh Descriptors have the following basic settings:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | Auto-generated | Unique identifier for the object |
| `visible` | `boolean` | `true` | Toggle visibility of the object |
| `position` | `{ x: number, y: number, z: number }` | - | Position of the mesh (ECEF coordinate system) |
| `rotation` | `{ x: number, y: number, z: number }` | - | Rotation of the mesh (Euler angles, radians) |
| `scale` | `{ x: number, y: number, z: number }` | - | Scale of the mesh |

## Coordinate Transformation

The `position` property of MeshDesc uses the ECEF (Earth-Centered, Earth-Fixed) coordinate system. To convert from latitude/longitude/altitude (geodetic coordinates) to the ECEF coordinate system, use the `geodeticToVector3()` function.

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
import { SphereMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshDesc);
await view.init();

// Convert from latitude/longitude/altitude to ECEF coordinates
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // Latitude (radians)
  lng: degreeToRadian(139.767125), // Longitude (radians)
  height: 200,                      // Altitude (meters)
});

// Add a mesh descriptor with the converted coordinates
const sphereDesc = view.addMesh<SphereMeshDesc>({
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
import { GLTFModelDesc } from "@navara/three_default_descs";
import { Vector3, Quaternion, Euler } from "three";

// GLTFModelDesc must be registered

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
const modelDesc = view.addMesh<GLTFModelDesc>({
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
const worldPosition = meshDesc.ref.getWorldPosition();

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

For details, see [navara_three_api](../../../three/api/navara_three_api).

For detailed usage, refer to the documentation for each descriptor type.
