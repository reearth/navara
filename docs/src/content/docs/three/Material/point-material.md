---
title: PointMaterial
description: Point material for navara_three
sidebar:
  order: 33
---

`PointMaterial` represents a material for point geometry rendering.

## Properties

### center

**Type:** `{ x: number, y: number }`

**Description:** Specifies the shift amount from the center. The range is between 0 and 1. The unit is a relative position to the point circle.

**Default:** Required

**Example:**

```typescript
{
  point: {
    center: { x: 0.5, y: 0.5 }
  }
}
```

### clampToGround

**Type:** `boolean`

**Description:** Specifies whether to clamp to the ground.

**Default:** Required

**Example:**

```typescript
{
  point: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the point color as a `Color` instance.

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  point: {
    color: new Color().setHex(0xff0000)
  }
}
```

### depthTest

**Type:** `boolean | undefined`

**Description:** A variable that determines whether front-facing models occlude back-facing models.

**Default:** `true`

**Example:**

```typescript
{
  point: {
    depthTest: true
  }
}
```

### effectIds

**Type:** `string[] | undefined`

**Description:** Specifies the IDs of selective effects to apply (e.g., "bloom", "outline"). Used in conjunction with SelectiveBloomEffectDesc or SelectiveOutlineEffectDesc.

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
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
  point: {
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
  point: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height. The unit is meters.

**Default:** Required

**Example:**

```typescript
{
  point: {
    height: 100 // 100 meters
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** Avoids overlap with the earth's surface. Use this to prevent the point from clipping into the earth's surface.

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
    offsetDepth: true
  }
}
```

### sizeInMeters

**Type:** `boolean | undefined`

**Description:** Whether the size is specified in meters. If false, the size is in pixels.

**Default:** `true`

**Example:**

```typescript
{
  point: {
    sizeInMeters: true
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
  point: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the point.

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
    show: true
  }
}
```

### size

**Type:** `number`

**Description:** Specifies the size of the point. The unit is meters.

**Default:** Required

**Example:**

```typescript
{
  point: {
    size: 10 // 10 meters
  }
}
```

### transparent

**Type:** `boolean | undefined`

**Description:** Specifies whether to consider the point's transparency. Note that setting this to true may cause the point to not display correctly when effects are enabled.

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
    transparent: false
  }
}
```
