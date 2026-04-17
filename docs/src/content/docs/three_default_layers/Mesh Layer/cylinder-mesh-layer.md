---
title: CylinderMeshLayer
description: Cylinder mesh layer for navara_three
sidebar:
  order: 103
---

The `CylinderMeshLayer` class is a mesh layer for drawing cylinder geometry. You can create cylinders and cones by specifying top radius, bottom radius, height, and other parameters.

## Properties

### radiusTop

**Type:** `number`

**Description:** Specifies the top radius of the cylinder.

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    radiusTop: 50,
  }
}
```

### radiusBottom

**Type:** `number`

**Description:** Specifies the bottom radius of the cylinder.

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    radiusBottom: 50,
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of the cylinder.

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    height: 200,
  }
}
```

### radialSegments

**Type:** `number`

**Description:** Specifies the number of segments around the circumference.

**Default:** `32`

**Example:**

```typescript
{
  cylinder: {
    radialSegments: 64,
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
  cylinder: {
    heightSegments: 2,
  }
}
```

### openEnded

**Type:** `boolean`

**Description:** Specifies whether to leave both ends of the cylinder open.

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    openEnded: true,
  }
}
```

### thetaStart

**Type:** `number`

**Description:** Specifies the starting angle of the cylinder in radians.

**Default:** `0`

**Example:**

```typescript
{
  cylinder: {
    thetaStart: Math.PI / 4,
  }
}
```

### thetaLength

**Type:** `number`

**Description:** Specifies the central angle of the cylinder in radians.

**Default:** `Math.PI * 2`

**Example:**

```typescript
{
  cylinder: {
    thetaLength: Math.PI,
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the color of the cylinder using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  cylinder: {
    color: new Color().setHex(0x0088ff),
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the cylinder casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the cylinder receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    receiveShadow: true,
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive color of the cylinder using a `Color` instance.

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  cylinder: {
    emissiveColor: new Color().setHex(0x00ff00),
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
  cylinder: {
    emissiveIntensity: 1.0,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the cylinder in the range of 0.0 to 1.0. `transparent` must be set to `true`.

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    opacity: 0.5,
    transparent: true,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to make the cylinder semi-transparent.

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
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
  cylinder: {
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
  cylinder: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

### Basic Cylinder

```typescript
import ThreeView, { CylinderMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a CylinderMeshLayer
const cylinderLayer = view.addMesh<CylinderMeshLayer>({
  cylinder: {
    radiusTop: 50,
    radiusBottom: 50,
    height: 200,
    color: new Color().setHex(0x0088ff),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### Creating a Cone

```typescript
import ThreeView, { CylinderMeshLayer, Color } from "@navara/three";

const coneLayer = view.addMesh<CylinderMeshLayer>({
  cylinder: {
    radiusTop: 0,
    radiusBottom: 100,
    height: 200,
    color: new Color().setHex(0xff8800),
  },
});
```
