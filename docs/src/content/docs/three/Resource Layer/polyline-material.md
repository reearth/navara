---
title: PolylineMaterial
description: Polyline material for navara_three
sidebar:
  order: 35
---

`PolylineMaterial` represents a material for polyline geometry rendering.

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the polyline casts shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    castShadow: true
  }
}
```

### clampToGround

**Type:** `boolean`

**Description:** Specifies whether to clamp the polyline to the ground.

**Default:** Required

**Example:**

```typescript
{
  polyline: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the polyline color as a `Color` instance.

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  polyline: {
    color: new Color().setHex(0x0066cc)
  }
}
```

### effectIds

**Type:** `string[] | undefined`

**Description:** Specifies the IDs of selective effects to apply (e.g., "bloom", "outline"). Used in conjunction with SelectiveBloomEffectLayer or SelectiveOutlineEffectLayer.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    effectIds: ["bloom", "outline"]
  }
}
```

### emissiveColor

**Type:** `Color | undefined`

**Description:** Specifies the emissive color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  polyline: {
    emissiveColor: new Color().setHex(0xff0000)
  }
}
```

### emissiveIntensity

**Type:** `number | undefined`

**Description:** Specifies the emissive intensity. The default value is 0.3 when the Bloom effect is enabled.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number | undefined`

**Description:** Specifies the height of the polyline. The unit is meters.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    height: 1
  }
}
```

### maxWidth

**Type:** `number | undefined`

**Description:** Maximum line width in pixels, clamping the rendered width regardless of zoom level. Smaller values are cheaper to render as they reduce fragment shader overdraw.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    maxWidth: 10
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the polyline receives shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    receiveShadow: true
  }
}
```

### selectiveEffectOcclusion

**Type:** `string | undefined`

**Description:** Specifies the depth behavior for the selective effect mask pass. Can be set to "normal" or "silhouette".

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the polyline.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    show: true
  }
}
```

### tiled

**Type:** `boolean | undefined`

**Description:** Splits the polyline into XYZ vector tiles for rendering, even when the data source is not an MVT layer. This can improve performance for large polylines. Enabling `clampToGround` implicitly forces `tiled` to `true`.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    tiled: true
  }
}
```

### useGroundNormals

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply terrain shadows to the polyline. This is effective when `clampToGround` is `true`.

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    useGroundNormals: true
  }
}
```

### width

**Type:** `number`

**Description:** Specifies the width of the polyline. The unit is pixels.

**Default:** Required

**Example:**

```typescript
{
  polyline: {
    width: 3
  }
}
```
