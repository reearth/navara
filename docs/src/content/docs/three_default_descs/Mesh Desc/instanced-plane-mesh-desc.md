---
title: InstancedPlaneMeshDesc
description: GPU-instanced plane mesh descriptor for navara_three
sidebar:
  order: 106
---

The `InstancedPlaneMeshDesc` class is a mesh descriptor that renders multiple plane instances using GPU instancing. All planes share a single geometry and material, rendered in one draw call for high performance. It extends `InstancedMeshDesc`.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Shared Material Properties

Shared properties applied to all instances. These are specified in the `planes` config object. Segment counts are baked into the shared geometry and cannot vary per instance.

### widthSegments

**Type:** `number`

**Description:** Specifies the number of horizontal segments of the shared plane geometry.

**Default:** `1`

### heightSegments

**Type:** `number`

**Description:** Specifies the number of vertical segments of the shared plane geometry.

**Default:** `1`

### color

**Type:** `Color`

**Description:** Specifies the base color for all instances using a `Color` instance.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  planes: {
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

## Per-Instance Properties (PlaneChildConfig)

Properties for each individual plane instance, specified in the `children` array.

### width

**Type:** `number`

**Description:** Specifies the width of the plane (X-axis). Encoded as scale in the instance matrix. Multiplied with `scale.x` if specified.

**Default:** `1`

### height

**Type:** `number`

**Description:** Specifies the height of the plane (Y-axis). Encoded as scale in the instance matrix. Multiplied with `scale.y` if specified.

**Default:** `1`

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

**Description:** Specifies the local scale. Multiplied with `width` and `height`.

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** Specifies a pre-computed transform matrix. When set, `position`, `rotation`, and `scale` are ignored.

**Default:** `undefined`

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** Specifies an array of selective effect descriptor IDs to apply to this mesh.

### pickable

**Type:** `boolean` (optional)

**Description:** Enables picking for individual instances.

**Default:** `false`

## Instance Management

Methods inherited from [InstancedMeshDesc](../../../three/core/custom-desc/#custom-instanced-mesh-desc) for dynamic instance management:

### handle.ref.add(config)

Adds a new instance. Returns the index of the added instance.

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  width: 20,
  height: 20,
  color: new Color().setHex(0xffff00),
});
```

### handle.ref.removeAt(index)

Removes an instance by index. Uses swap-with-last for O(1) removal.

### handle.ref.updateAt(index, config)

Updates an instance at the given index with partial config.

### handle.ref.clear()

Removes all instances.

### handle.ref.replaceAll(configs)

Batch replaces all instances.

### handle.ref.count

Gets the number of active instances.

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedPlaneMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("planes", InstancedPlaneMeshDesc);
await view.init();

const handle = view.addMesh<InstancedPlaneMeshDesc>({
  planes: {
    color: new Color().setHex(0xffffff),
    receiveShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, width: 10, height: 20, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, width: 15, height: 10, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, width: 5, height: 40, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```
