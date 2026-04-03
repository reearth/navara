---
title: BillboardMaterial
description: Billboard material for navara_three
sidebar:
  order: 31
---

`BillboardMaterial` represents a material for billboard rendering.

## Properties

### alphaTest

**Type:** `number | undefined`

**Description:** Pixels with an RGBA alpha value below this threshold will not be rendered.

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    alphaTest: 0.5
  }
}
```

### center

**Type:** [`Vec2`](./point-material#vec2)

**Description:** Specifies the shift amount from the center. The range is between 0 and 1.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    center: { x: 0.5, y: 0.5 }
  }
}
```

### clampToGround

**Type:** `boolean`

**Description:** Specifies whether to clamp the billboard to the ground.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** Specifies the billboard color as a `Color` instance.

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  billboard: {
    color: new Color().setHex(0xffffff)
  }
}
```

### depthTest

**Type:** `boolean`

**Description:** A variable that determines whether front-facing models occlude back-facing models.

**Default:** `true`

**Example:**

```typescript
{
  billboard: {
    depthTest: true
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
  billboard: {
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
  billboard: {
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
  billboard: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of the billboard. The unit is meters.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    height: 100 // 100 meters
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** Avoids overlap with the earth's surface. Use this to prevent the billboard from clipping into the earth's surface.

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    offsetDepth: true
  }
}
```

### scaleByDistance

**Type:** `boolean`

**Description:** Specifies whether to adjust the object size based on the distance from the camera.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    scaleByDistance: true
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
  billboard: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the billboard.

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    show: true
  }
}
```

### size

**Type:** `number`

**Description:** Specifies the size of the billboard. The unit is meters.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    size: 10 // 10 meters
  }
}
```

### transparent

**Type:** `boolean | undefined`

**Description:** Specifies whether to consider the billboard's transparency. Note that setting this to true may cause the billboard to not display correctly when effect layers are enabled.

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    transparent: false
  }
}
```

### url

**Type:** `string`

**Description:** Specifies the URL of the object. Supports image files.

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    url: "https://example.com/icons/marker.png"
  }
}
```
