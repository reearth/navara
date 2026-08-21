---
title: MeshDesc
description: Base class properties and features shared by all mesh Descriptors
sidebar:
  order: 99
---

`MeshDesc` is the base class for all mesh Descriptors. It provides common configuration properties, transform composition, and picking support. Every mesh Descriptor — both built-in and custom — inherits from this class, so the features described here are available on all mesh Descriptors.

## Common Properties

| Property      | Type                                   | Default        | Description                                                                                    |
|---------------|----------------------------------------|----------------|------------------------------------------------------------------------------------------------|
| `id`          | `string`                               | Auto-generated | Unique identifier for the object                                                                |
| `visible`     | `boolean`                              | `true`         | Toggle visibility of the object                                                                 |
| `position`    | `{ x: number, y: number, z: number }`  | -              | Position (ECEF), or local offset when `matrix`/`matrixWorld` is set                            |
| `rotation`    | `{ x: number, y: number, z: number }`  | -              | Rotation (Euler angles, radians), or local offset when `matrix`/`matrixWorld` is set           |
| `scale`       | `{ x: number, y: number, z: number }`  | -              | Scale, or local offset when `matrix`/`matrixWorld` is set                                      |
| `matrix`      | `Matrix4`                              | -              | Local transform matrix. When set, `position`/`rotation`/`scale` become offsets within this frame |
| `matrixWorld` | `Matrix4`                              | -              | World transform matrix. When set, `position`/`rotation`/`scale` become offsets within this frame |
| `geodetic`    | `GeodeticPlacement`                    | -              | Geographic placement in degrees — see [Geographic Placement](#geographic-placement-geodetic). Mutually exclusive with `matrix`/`matrixWorld` |
| `lit`         | `boolean`                              | -              | Lighting override applied to every material of the mesh. Unset follows `view.lit` — see [Lighting](#lighting-lit) |
| `pickable`    | `boolean`                              | `false`        | Enable GPU-based click picking. Defined per Descriptor by picking-capable mesh Descriptors, not on the base config |

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
} from "@navaramap/three";
import { BoxMeshDesc } from "@navaramap/three-default-descs";

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

// Place a box 200m east and 50m north of the origin
const box1 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 100, depth: 50, color: new Color().setHex(0xff0000) },
  matrixWorld: enuFrame,
  position: { x: 200, y: 50, z: 0 },
});

// Place another box 40m north and 100m above the origin
const box2 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 80, depth: 50, color: new Color().setHex(0x00ff00) },
  matrixWorld: enuFrame,
  position: { x: 0, y: 40, z: 100 },
});
```

## Geographic Placement (`geodetic`)

`geodetic` is the high-level way to place an object on the globe. Everything is
in degrees and metres, matching `setCamera`:

```typescript
import ThreeView from "@navaramap/three";
import { GLTFModelDesc } from "@navaramap/three-default-descs";

const car = view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  geodetic: {
    lng: 138.036142,
    lat: 36.085621,
    height: 1,
    heading: 321,
    pitch: 0,
    roll: 0,
  },
});

// Rotate it in place — a partial update keeps lng/lat/height.
car.update({ geodetic: { heading: 330 } });
```

| Property | Unit | Positive direction | Default |
| --- | --- | --- | --- |
| `lng`, `lat` | degrees | - | required |
| `height` | metres | up | `0` |
| `heading` | degrees | clockwise from north | `0` |
| `pitch` | degrees | nose up | `0` |
| `roll` | degrees | right wing down | `0` |
| `scale` | ratio | - | `1` |
| `heightReference` | `"ellipsoid"` \| `"terrain"` | - | `"ellipsoid"` |

`heading` is the compass bearing the object's front faces — the same convention
as `setCamera`'s heading.

### Composition

`geodetic` occupies the same slot as `matrixWorld`, so the composition rule is
the one already described above:

```
effective = geodetic · T(position) · R(rotation) · S(scale)
```

`position`, `rotation`, and `scale` therefore remain offsets *inside* the
placed frame. Setting `geodetic` together with `matrix` or `matrixWorld` throws
`ConflictingTransformError`, because both would define the same placement.

`geodetic.scale` and the top-level `scale` are both allowed and are not the
same thing: `geodetic.scale` scales the frame, so it also scales `position`
offsets, while `scale` scales only the object.

### Terrain-relative height

With `heightReference: "terrain"`, `height` is metres above the terrain rather
than above the ellipsoid:

```typescript
view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  geodetic: {
    lng: 138.036142,
    lat: 36.085621,
    height: 0,
    heightReference: "terrain",
    heading: 321,
  },
});
```

Three behaviours are worth knowing:

- The object **settles visibly** as terrain refines. Height is seeded from
  tiles already resident and updated as more detailed tiles arrive.
- Clamping follows the **active terrain**, not a source you name.
- With **no terrain layer** added, the placement behaves as
  `"ellipsoid"` — terrain layers can be added after the object.

## Up-Axis Conventions (glTF Y-up and tile Z-up)

glTF is Y-up: `GLTFLoader` preserves the asset's own axes, and the glTF 2.0
specification puts an asset's front at `+Z`, its up at `+Y`, and its right at
`-X`. The 3D Tiles convention — and `eastNorthUpToFixedFrame`, the frame that
feels most natural to reach for — is Z-up. Bridging the two by hand means
inserting an `Rx(+90°)` correction, and getting the remaining 90° of heading
right on top of it.

**With `geodetic` there is nothing to correct.** `geodetic` builds a
**West-Up-North (WUN)** tangent frame: `+x` west, `+y` up, `+z` north. WUN is
the only right-handed, Y-up tangent frame whose `+Z` axis is north, so it
agrees with glTF on all three axes — front, up, and right. The `Rx(+90°)` has
been absorbed once into the frame definition itself, as the `Ry(+90°)` basis
change from NUE, rather than applied per object.

This holds for every mesh Descriptor, not just glTF ones. Three.js primitives
are Y-up too (a `CylinderGeometry`'s axis is `+Y`), so the same frame is
correct for `BoxMeshDesc`, `CylinderMeshDesc`, and custom Descriptors.

You still need to think about axes when you supply a frame yourself:

| Frame | Axes (x, y, z) | Up | Needs correction for glTF? |
| --- | --- | --- | --- |
| `geodetic` (WUN) | west, up, north | Y | **No** |
| `westUpNorthToFixedFrame` | west, up, north | Y | **No** |
| `northUpEastToFixedFrame` | north, up, east | Y | Y-up is fine, but the asset faces **east** at zero rotation |
| `eastNorthUpToFixedFrame` | east, north, up | Z | Yes — `Rx(+90°)` |
| `northWestUpToFixedFrame` | north, west, up | Z | Yes — `Rx(+90°)` |
| `northEastDownToFixedFrame` | north, east, down | −Z | Yes |

### Migrating from another engine

Rotation conventions differ between 3D globe engines, and a frequent difference
is which axis of a glTF asset is treated as its front. If a ported model comes
out rotated by a multiple of 90°, that is the thing to check first.

Navara's rule has no special cases: `heading` is the compass bearing the
asset's front faces, where the front is glTF's own `+Z`. A model on a road
bearing 321° gets `heading: 321`, at every latitude, for every mesh
Descriptor.

```typescript
geodetic: { lng, lat, height, heading: 321 }
```

## Lighting (`lit`)

`lit` is a three-state lighting override applied to **every** material under the mesh, including the children of a loaded model:

| Value | Result |
| ----- | ------ |
| `true` | Lit, even when [`view.lit`](../../../three/api/threeview-properties/#lit) is `false` |
| `false` | Plain albedo — the lighting equation is skipped on the color output |
| unset (`undefined`) | Follows `view.lit` (default `true`) |

Setting `lit: false` does not disable the lit pipeline: normals and the shadow G-buffer keep being written, which is what lets a post-processing pass re-light the albedo afterwards.

```typescript
// Follows view.lit
const box = view.addMesh<BoxMeshDesc>({ box: { width: 100 }, position });

// Always lit, whatever view.lit says
const sphere = view.addMesh<SphereMeshDesc>({
  sphere: { radius: 100 },
  position,
  lit: true,
});

// Change it later
sphere.update({ lit: false });

// Passing undefined explicitly resets the mesh to following view.lit
sphere.update({ lit: undefined });
```

:::note
Changing `lit` recompiles the mesh's shaders once, so treat it as a configuration switch rather than a per-frame control. Mesh Descriptors that are unlit by nature (points, sprites, text, plain `ShaderMaterial`) are unaffected.
:::

Descriptors that attach their materials asynchronously (glTF loads, for example) re-apply the override by calling the base class's `applyLit()` once their materials exist.

## Picking

Mesh Descriptors can opt into GPU-based click picking by setting `pickable: true` in the Descriptor config. The picking system renders pickable meshes into a dedicated single-pixel render target with each mesh's batch ID encoded as an RGB color, reads back the pixel, and emits a `"pick"` event identifying which mesh was clicked.

:::note
To use picking, you must set `picking: true` in the ThreeView constructor.
:::

### Basic Usage

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { BoxMeshDesc } from "@navaramap/three-default-descs";

const view = new ThreeView({ picking: true });
view.registerMesh("box", BoxMeshDesc);
await view.init();

const boxDesc = view.addMesh<BoxMeshDesc>({
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

The batch ID is a unique 24-bit integer assigned to each pickable mesh (or each instance in an instanced mesh Descriptor). You can read it from the Descriptor reference to determine which mesh was clicked:

```typescript
// Single mesh Descriptor
const batchId = boxDesc.ref.batchId;

// Instanced mesh Descriptor — one batch ID per instance
const batchIds = instancedDesc.ref.batchIds;
```

### Responding to Picks

```typescript
view.on("pick", (info) => {
  if (info && info.batchId === boxDesc.ref.batchId) {
    // Highlight the selected box
    boxDesc.update({ box: { color: new Color().setHex(0xffff00) } });
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

For implementing picking in custom Descriptors, see [Custom Descriptor — Implementing Picking](../../../three/core/custom-desc/#implementing-picking-in-custom-descriptors).

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
} from "@navaramap/three";
import { SphereMeshDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshDesc);
await view.init();

// Convert from latitude/longitude/altitude to ECEF coordinates
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // Latitude (radians)
  lng: degreeToRadian(139.767125), // Longitude (radians)
  height: 200,                      // Altitude (meters)
});

// Add a mesh Descriptor with the converted coordinates
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

### Using a Local Tangent Frame (ENU and others)

The `position` property is Cartesian ECEF by default, so a bare `position` will not stand a mesh upright at a given longitude/latitude. For geographic placement, compute a local tangent frame at the origin and pass it as `matrixWorld`; `position`/`rotation`/`scale` are then interpreted as offsets within that frame.

Choose the frame function that matches the axis orientation your mesh expects. All take an ECEF origin (`Vector3`) and return a `Matrix4`, and all are exported from `@navaramap/three`:

| Function | Local axes (x, y, z) |
|------|------|
| `eastNorthUpToFixedFrame()` | East, North, Up |
| `northEastDownToFixedFrame()` | North, East, Down |
| `northUpEastToFixedFrame()` | North, Up, East |
| `northWestUpToFixedFrame()` | North, West, Up |

The most common choice is ENU (`eastNorthUpToFixedFrame()`):

```typescript
import {
  geodeticToVector3,
  eastNorthUpToFixedFrame,
  degreeToRadian,
} from "@navaramap/three";
import { GLTFModelDesc } from "@navaramap/three-default-descs";

// GLTFModelDesc must be registered

// Compute position
const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// Place the model along the Earth's surface
const modelDesc = view.addMesh<GLTFModelDesc>({
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
| `eastNorthUpToFixedFrame()` | Gets the ENU (East-North-Up) tangent-frame matrix at the origin |
| `northEastDownToFixedFrame()` | Gets the NED (North-East-Down) tangent-frame matrix at the origin |
| `northUpEastToFixedFrame()` | Gets the NUE (North-Up-East) tangent-frame matrix at the origin |
| `northWestUpToFixedFrame()` | Gets the NWU (North-West-Up) tangent-frame matrix at the origin |

For details, see [navara_three_api](../../../three/api/navara_three_api).
