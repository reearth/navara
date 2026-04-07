---
title: BoxMeshLayer
description: Box mesh layer for navara_three
sidebar:
  order: 102
---

The `BoxMeshLayer` class is a mesh layer for drawing box geometry. You can create a box by specifying width, height, and depth.

## Properties

### width

**Type:** `number`

**Description:** Specifies the width of the box (size along the X-axis).

**Default:** `1`

**Example:**

```typescript
{
  box: {
    width: 100,
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of the box (size along the Y-axis).

**Default:** `1`

**Example:**

```typescript
{
  box: {
    height: 100,
  }
}
```

### depth

**Type:** `number`

**Description:** Specifies the depth of the box (size along the Z-axis).

**Default:** `1`

**Example:**

```typescript
{
  box: {
    depth: 100,
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
  box: {
    widthSegments: 2,
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
  box: {
    heightSegments: 2,
  }
}
```

### depthSegments

**Type:** `number`

**Description:** Specifies the number of segments along the depth.

**Default:** `1`

**Example:**

```typescript
{
  box: {
    depthSegments: 2,
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the color of the box using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications.

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  box: {
    color: new Color().setHex(0xff0000),
  }
}

// or
{
  box: {
    color: new Color().setStyle("#ff0000"), // CSS format
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
  box: {
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
  box: {
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
  box: {
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
  box: {
    transparent: true,
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the box casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  box: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the box receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  box: {
    receiveShadow: true,
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
  box: {
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
  box: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a BoxMeshLayer
const boxLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### Box with Shadows

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const boxLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 200,
    height: 100,
    depth: 150,
    color: new Color().setHex(0x00aa00),
    castShadow: true,
    receiveShadow: true,
  },
  position: { x: 0, y: 0, z: 500 },
});
```

### Semi-transparent Box

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const boxLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 150,
    height: 150,
    depth: 150,
    color: new Color().setHex(0x0088ff),
    opacity: 0.5,
    transparent: true,
  },
  position: { x: 1000, y: 0, z: 500 },
});
```
