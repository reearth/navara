---
title: InstancedBoxMeshLayer
description: GPU-instanced box mesh layer for navara_three
sidebar:
  order: 103
---

The `InstancedBoxMeshLayer` class is a mesh layer that renders multiple box instances using GPU instancing. All boxes share a single geometry and material, rendered in one draw call for high performance. It extends `InstancedMeshLayerDeclaration`.

## Shared Material Properties

Shared material properties applied to all instances. These are specified in the `boxes` config object.

### color

**Type:** `Color`

**Description:** Specifies the base color for all instances using a `Color` instance.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  boxes: {
    color: new Color().setHex(0xff0000),
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive (self-illuminating) color using a `Color` instance.

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  boxes: {
    emissiveColor: new Color().setHex(0x222222),
  }
}
```

### emissiveIntensity

**Type:** `number`

**Description:** Specifies the emissive intensity.

**Default:** `1`

**Example:**

```typescript
{
  boxes: {
    emissiveIntensity: 0.5,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity. Ranges from 0.0 (fully transparent) to 1.0 (fully opaque).

**Default:** `1`

**Example:**

```typescript
{
  boxes: {
    opacity: 0.5,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to enable transparency.

**Default:** `false`

**Example:**

```typescript
{
  boxes: {
    transparent: true,
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the instances cast shadows.

**Default:** `false`

**Example:**

```typescript
{
  boxes: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the instances receive shadows.

**Default:** `false`

**Example:**

```typescript
{
  boxes: {
    receiveShadow: true,
  }
}
```

## Per-Instance Properties (BoxChildConfig)

Properties for each individual box instance, specified in the `children` array.

### width

**Type:** `number`

**Description:** Specifies the width of the box (X-axis). Encoded as scale in the instance matrix. Multiplied with `scale.x` if both are specified.

**Default:** `1`

**Example:**

```typescript
{
  boxes: {
    children: [
      { width: 100 },
    ],
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of the box (Y-axis). Encoded as scale in the instance matrix. Multiplied with `scale.y` if both are specified.

**Default:** `1`

**Example:**

```typescript
{
  boxes: {
    children: [
      { height: 100 },
    ],
  }
}
```

### depth

**Type:** `number`

**Description:** Specifies the depth of the box (Z-axis). Encoded as scale in the instance matrix. Multiplied with `scale.z` if both are specified.

**Default:** `1`

**Example:**

```typescript
{
  boxes: {
    children: [
      { depth: 100 },
    ],
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** Specifies the per-instance color using a `Color` instance. Overrides the shared material `color` for this specific instance.

**Default:** `undefined` (uses shared material color)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  boxes: {
    children: [
      { color: new Color().setHex(0xff0000) },
    ],
  }
}
```

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local position relative to the parent group.

**Default:** `{ x: 0, y: 0, z: 0 }`

**Example:**

```typescript
{
  boxes: {
    children: [
      { position: { x: 100, y: 0, z: 0 } },
    ],
  }
}
```

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local rotation (Euler angles in radians).

**Default:** `undefined`

**Example:**

```typescript
{
  boxes: {
    children: [
      { rotation: { x: 0, y: Math.PI / 4, z: 0 } },
    ],
  }
}
```

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local scale. Multiplied with `width`, `height`, and `depth`.

**Default:** `{ x: 1, y: 1, z: 1 }`

**Example:**

```typescript
{
  boxes: {
    children: [
      { scale: { x: 2, y: 2, z: 2 } },
    ],
  }
}
```

### matrix

**Type:** `Matrix4 | undefined`

**Description:** Specifies a pre-computed transform matrix. When set, `position`, `rotation`, and `scale` are ignored.

**Default:** `undefined`

**Example:**

```typescript
import { Matrix4 } from "three";

{
  boxes: {
    children: [
      { matrix: new Matrix4().makeTranslation(100, 0, 0) },
    ],
  }
}
```

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** Specifies an array of selective effect layer IDs to apply to this mesh.

**Example:**

```typescript
{
  boxes: {
    effectIds: ["bloom-effect", "outline-effect"],
  }
}
```

### selectiveEffectOcclusion

**Type:** `SelectiveEffectOcclusion` (optional)

**Description:** Specifies the occlusion mode for selective effects (Bloom, Outline, etc.).

- `"normal"`: Normal occlusion where effects are not applied to parts occluded by other objects
- `"silhouette"`: Silhouette mode where effects are applied even to occluded parts

**Example:**

```typescript
{
  boxes: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Instance Management

Methods inherited from [InstancedMeshLayerDeclaration](../../../three/core/custom-layer/#custom-instanced-mesh-layer) for dynamic instance management:

### handle.ref.add(config)

Adds a new instance. Returns the index of the added instance.

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  width: 20,
  height: 20,
  depth: 20,
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
  height: 50,
});
```

### handle.ref.clear()

Removes all instances.

```typescript
handle.ref.clear();
```

### handle.ref.replaceAll(configs)

Batch replaces all instances. More efficient than `clear()` + multiple `add()` calls as it emits a single update notification.

```typescript
handle.ref.replaceAll([
  { position: { x: 0, y: 0, z: 0 }, width: 10, height: 10, depth: 10 },
  { position: { x: 20, y: 0, z: 0 }, width: 10, height: 10, depth: 10 },
]);
```

### handle.ref.count

Gets the number of active instances.

```typescript
console.log("Instance count:", handle.ref.count);
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedBoxMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();
view.registerMesh("boxes", InstancedBoxMeshLayer);
await view.init();

const handle = view.addMesh<InstancedBoxMeshLayer>({
  boxes: {
    color: new Color().setHex(0xffffff),
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, width: 10, height: 20, depth: 10, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, width: 15, height: 10, depth: 15, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, width: 5, height: 40, depth: 5, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```

### Dynamic Instance Management

```typescript
// Add a new instance
const index = handle.ref.add({
  position: { x: 90, y: 0, z: 0 },
  width: 20,
  height: 20,
  depth: 20,
  color: new Color().setHex(0xffff00),
});

// Update instance at index 0
handle.ref.updateAt(0, {
  color: new Color().setHex(0xff00ff),
  height: 50,
});

// Remove instance at index 1
handle.ref.removeAt(1);

// Replace all instances
handle.ref.replaceAll([
  { position: { x: 0, y: 0, z: 0 }, width: 10, height: 10, depth: 10 },
  { position: { x: 20, y: 0, z: 0 }, width: 10, height: 10, depth: 10 },
]);
```

### Updating Shared Material

```typescript
handle.update({
  boxes: {
    color: new Color().setHex(0x333333),
    emissiveColor: new Color().setHex(0xff0000),
    emissiveIntensity: 0.5,
    opacity: 0.8,
    transparent: true,
  },
});
```
