---
title: InstancedSphereMeshDesc
description: GPU-instanced sphere mesh descriptor for navara_three
sidebar:
  order: 104
---

The `InstancedSphereMeshDesc` class is a mesh descriptor that renders multiple sphere instances using GPU instancing. All spheres share a single geometry and material, rendered in one draw call for high performance. It extends `InstancedMeshDesc`.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Shared Material Properties

Shared properties applied to all instances. These are specified in the `spheres` config object. Segment and arc parameters are baked into the shared geometry and cannot vary per instance.

### widthSegments

**Type:** `number`

**Description:** Specifies the number of horizontal segments of the shared sphere geometry.

**Default:** `32`

### heightSegments

**Type:** `number`

**Description:** Specifies the number of vertical segments of the shared sphere geometry.

**Default:** `16`

### phiStart

**Type:** `number`

**Description:** Specifies the horizontal starting angle (radians).

**Default:** `0`

### phiLength

**Type:** `number`

**Description:** Specifies the horizontal sweep angle (radians).

**Default:** `Math.PI * 2`

### thetaStart

**Type:** `number`

**Description:** Specifies the vertical starting angle (radians).

**Default:** `0`

### thetaLength

**Type:** `number`

**Description:** Specifies the vertical sweep angle (radians).

**Default:** `Math.PI`

### color

**Type:** `Color`

**Description:** Specifies the base color for all instances using a `Color` instance.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  spheres: {
    color: new Color().setHex(0xff0000),
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive (self-illuminating) color.

**Default:** `new Color().setHex(0x000000)`

### emissiveIntensity

**Type:** `number`

**Description:** Specifies the emissive intensity.

**Default:** `0`

### opacity

**Type:** `number`

**Description:** Specifies the opacity. Ranges from 0.0 (fully transparent) to 1.0 (fully opaque).

**Default:** `1`

### transparent

**Type:** `boolean`

**Description:** Specifies whether to enable transparency.

**Default:** `false`

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the instances cast shadows.

**Default:** `false`

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the instances receive shadows.

**Default:** `false`

## Per-Instance Properties (SphereChildConfig)

Properties for each individual sphere instance, specified in the `children` array.

### radius

**Type:** `number`

**Description:** Specifies the sphere radius. Encoded as uniform scale in the instance matrix. Multiplied with `scale` if specified.

**Default:** `1`

**Example:**

```typescript
{
  spheres: {
    children: [
      { radius: 100 },
    ],
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** Specifies the per-instance color. Overrides the shared material `color` for this specific instance.

**Default:** `undefined` (uses shared material color)

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local position relative to the parent group.

**Default:** `{ x: 0, y: 0, z: 0 }`

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local rotation (Euler angles in radians).

**Default:** `undefined`

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local scale. Multiplied with `radius`.

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** Specifies a pre-computed transform matrix. When set, `position`, `rotation`, and `scale` are ignored.

**Default:** `undefined`

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** Specifies an array of selective effect descriptor IDs to apply to this mesh.

**Example:**

```typescript
{
  spheres: {
    effectIds: ["bloom-effect", "outline-effect"],
  }
}
```

### pickable

**Type:** `boolean` (optional)

**Description:** Enables picking for individual instances. When `true`, each instance can be picked by the picking system.

**Default:** `false`

## Instance Management

Methods inherited from [InstancedMeshDesc](../../../three/core/custom-desc/#custom-instanced-mesh-desc) for dynamic instance management:

### handle.ref.add(config)

Adds a new instance. Returns the index of the added instance.

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  radius: 20,
  color: new Color().setHex(0xffff00),
});
```

### handle.ref.removeAt(index)

Removes an instance by index. Uses swap-with-last for O(1) removal. Instance order is not preserved.

```typescript
handle.ref.removeAt(1);
```

### handle.ref.updateAt(index, config)

Updates an instance at the given index with partial config.

```typescript
handle.ref.updateAt(0, {
  color: new Color().setHex(0xff00ff),
  radius: 50,
});
```

### handle.ref.clear()

Removes all instances.

### handle.ref.replaceAll(configs)

Batch replaces all instances. More efficient than `clear()` + multiple `add()` calls as it emits a single update notification.

### handle.ref.count

Gets the number of active instances.

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedSphereMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("spheres", InstancedSphereMeshDesc);
await view.init();

const handle = view.addMesh<InstancedSphereMeshDesc>({
  spheres: {
    color: new Color().setHex(0xffffff),
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, radius: 10, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, radius: 15, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, radius: 5, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```

### Updating Shared Material

```typescript
handle.update({
  spheres: {
    color: new Color().setHex(0x333333),
    emissiveColor: new Color().setHex(0xff0000),
    emissiveIntensity: 0.5,
    opacity: 0.8,
    transparent: true,
  },
});
```
