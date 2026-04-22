---
title: SphereMeshLayer
description: Sphere mesh layer for navara_three
sidebar:
  order: 104
---

The `SphereMeshLayer` class is a mesh layer for drawing sphere geometry. You can create a sphere by specifying radius, segment counts, and other parameters.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshLayerDeclaration](./mesh-layer-base) for details.

## Properties

### radius

**Type:** `number`

**Description:** Specifies the radius of the sphere.

**Default:** `1`

**Example:**

```typescript
{
  sphere: {
    radius: 100,
  }
}
```

### widthSegments

**Type:** `number`

**Description:** Specifies the number of horizontal segments.

**Default:** `32`

**Example:**

```typescript
{
  sphere: {
    widthSegments: 64,
  }
}
```

### heightSegments

**Type:** `number`

**Description:** Specifies the number of vertical segments.

**Default:** `16`

**Example:**

```typescript
{
  sphere: {
    heightSegments: 32,
  }
}
```

### phiStart

**Type:** `number`

**Description:** Specifies the horizontal starting angle in radians.

**Default:** `0`

**Example:**

```typescript
{
  sphere: {
    phiStart: Math.PI / 4,
  }
}
```

### phiLength

**Type:** `number`

**Description:** Specifies the horizontal central angle in radians.

**Default:** `Math.PI * 2`

**Example:**

```typescript
{
  sphere: {
    phiLength: Math.PI,
  }
}
```

### thetaStart

**Type:** `number`

**Description:** Specifies the vertical starting angle in radians.

**Default:** `0`

**Example:**

```typescript
{
  sphere: {
    thetaStart: Math.PI / 6,
  }
}
```

### thetaLength

**Type:** `number`

**Description:** Specifies the vertical central angle in radians.

**Default:** `Math.PI`

**Example:**

```typescript
{
  sphere: {
    thetaLength: Math.PI / 2,
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the color of the sphere using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  sphere: {
    color: new Color().setHex(0xff0000),
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the sphere casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  sphere: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the sphere receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  sphere: {
    receiveShadow: true,
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive color of the sphere using a `Color` instance.

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  sphere: {
    emissiveColor: new Color().setHex(0xff0000),
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
  sphere: {
    emissiveIntensity: 1.0,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the sphere in the range of 0.0 to 1.0. `transparent` must be set to `true`.

**Default:** `1`

**Example:**

```typescript
{
  sphere: {
    opacity: 0.5,
    transparent: true,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to make the sphere semi-transparent.

**Default:** `false`

**Example:**

```typescript
{
  sphere: {
    transparent: true,
    opacity: 0.5,
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
  sphere: {
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
  sphere: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

```typescript
import ThreeView, { SphereMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a SphereMeshLayer
const sphereLayer = view.addMesh<SphereMeshLayer>({
  sphere: {
    radius: 100,
    widthSegments: 32,
    heightSegments: 16,
    color: new Color().setHex(0xff0000),
    castShadow: true,
  },
  position: { x: 0, y: 0, z: 1000 },
});
```
