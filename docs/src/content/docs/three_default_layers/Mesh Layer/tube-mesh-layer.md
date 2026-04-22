---
title: TubeMeshLayer
description: Tube mesh layer for navara_three
sidebar:
  order: 106
---

The `TubeMeshLayer` class is a mesh layer for drawing tube geometry. It can create tube shapes along a Catmull-Rom curve.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshLayerDeclaration](./mesh-layer-base) for details.

## Properties

### points

**Type:** `XYZ[]`

**Description:** Specifies an array of 3D coordinates that define the tube's path. A minimum of 2 points is required.

**Example:**

```typescript
{
  tube: {
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 50, z: 0 },
      { x: 200, y: 0, z: 0 }
    ],
  }
}
```

### tubularSegments

**Type:** `number`

**Description:** Specifies the number of segments along the length of the tube.

**Default:** `64`

**Example:**

```typescript
{
  tube: {
    tubularSegments: 128,
  }
}
```

### radius

**Type:** `number`

**Description:** Specifies the radius of the tube.

**Default:** `1`

**Example:**

```typescript
{
  tube: {
    radius: 10,
  }
}
```

### radialSegments

**Type:** `number`

**Description:** Specifies the number of segments around the circumference of the tube.

**Default:** `8`

**Example:**

```typescript
{
  tube: {
    radialSegments: 16,
  }
}
```

### closed

**Type:** `boolean`

**Description:** Specifies whether to create a closed tube shape.

**Default:** `false`

**Example:**

```typescript
{
  tube: {
    closed: true,
  }
}
```

### tension

**Type:** `number`

**Description:** Specifies the tension of the Catmull-Rom curve. Values closer to 0 produce straighter lines.

**Default:** `0.5`

**Example:**

```typescript
{
  tube: {
    tension: 0.8,
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the color of the tube using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  tube: {
    color: new Color().setHex(0xff8800),
  }
}
```

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the tube casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  tube: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the tube receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  tube: {
    receiveShadow: true,
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** Specifies the emissive color of the tube using a `Color` instance.

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  tube: {
    emissiveColor: new Color().setHex(0xff8800),
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
  tube: {
    emissiveIntensity: 1.0,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the tube in the range of 0.0 to 1.0. `transparent` must be set to `true`.

**Default:** `1`

**Example:**

```typescript
{
  tube: {
    opacity: 0.5,
    transparent: true,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to make the tube semi-transparent.

**Default:** `false`

**Example:**

```typescript
{
  tube: {
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
  tube: {
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
  tube: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

```typescript
import ThreeView, { TubeMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a TubeMeshLayer
const tubeLayer = view.addMesh<TubeMeshLayer>({
  tube: {
    points: [
      { x: 0, y: 0, z: 1000 },
      { x: 100, y: 50, z: 1100 },
      { x: 200, y: -50, z: 1000 },
      { x: 300, y: 0, z: 1000 },
    ],
    radius: 10,
    tubularSegments: 128,
    radialSegments: 16,
    color: new Color().setHex(0xff8800),
    tension: 0.5,
  },
});
```
