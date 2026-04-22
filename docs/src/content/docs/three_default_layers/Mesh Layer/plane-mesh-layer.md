---
title: PlaneMeshDesc
description: Plane mesh descriptor for navara_three
sidebar:
  order: 105
---

The `PlaneMeshDesc` class is a mesh descriptor for drawing plane geometry. You can create a plane by specifying width and height.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-layer-base) for details.

## Properties

### width

**Type:** `number`

**Description:** Specifies the width of the plane.

**Default:** `1`

**Example:**

```typescript
{
  plane: {
    width: 1000,
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of the plane.

**Default:** `1`

**Example:**

```typescript
{
  plane: {
    height: 1000,
  }
}
```

### widthSegments

**Type:** `number`

**Description:** Specifies the number of segments along the width.

**Default:** `1`

**Example:**

```typescript
{
  plane: {
    widthSegments: 10,
  }
}
```

### heightSegments

**Type:** `number`

**Description:** Specifies the number of segments along the height.

**Default:** `1`

**Example:**

```typescript
{
  plane: {
    heightSegments: 10,
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the color of the plane using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  plane: {
    color: new Color().setHex(0x00aa00),
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the plane casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  plane: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the plane receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  plane: {
    receiveShadow: true,
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive color of the plane using a `Color` instance.

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  plane: {
    emissiveColor: new Color().setHex(0x0000ff),
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
  plane: {
    emissiveIntensity: 1.0,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the plane in the range of 0.0 to 1.0. `transparent` must be set to `true`.

**Default:** `1`

**Example:**

```typescript
{
  plane: {
    opacity: 0.5,
    transparent: true,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to make the plane semi-transparent.

**Default:** `false`

**Example:**

```typescript
{
  plane: {
    transparent: true,
    opacity: 0.5,
  }
}
```

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** Specifies an array of selective effect descriptor IDs to apply to this mesh.

**Example:**

```typescript
{
  plane: {
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
  plane: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

```typescript
import ThreeView, { PlaneMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const planeLayer = view.addMesh<PlaneMeshDesc>({
  plane: {
    width: 1000,
    height: 1000,
    color: new Color().setHex(0x00aa00),
    receiveShadow: true,
  },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: -Math.PI / 2, y: 0, z: 0 },
});
```
