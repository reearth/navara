---
title: RasterTileMaterial
description: Raster tile material for navara_three
sidebar:
  order: 37
---

`RasterTileMaterial` represents a material for raster tile rendering.

## Properties

### color

**Type:** `Color`

**Description:** Specifies the raster tile color as a `Color` instance.

**Example:**

```typescript
import { Color } from "@navara/three";

{
  rasterTile: {
    color: new Color().setHex(0xffffff)
  }
}
```

:::note
Globe-level settings such as `maxSse`, `segments`, and `shouldComputeNormalFromVertex` are configured via the [Globe](/three/api/globe/) API, not on this material.
:::

### maxZoom

**Type:** `number`

**Description:** Specifies the maximum zoom level. Tiles will not be displayed at zoom levels exceeding this value.

**Example:**

```typescript
{
  rasterTile: {
    maxZoom: 18
  }
}
```

### minZoom

**Type:** `number | undefined`

**Description:** Specifies the minimum zoom level. Tiles will not be displayed at zoom levels below this value.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    minZoom: 0
  }
}
```

### opacity

**Type:** `number | undefined`

**Description:** Specifies the opacity of the raster tile image. The range is 0.0 to 1.0.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    opacity: 0.8
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the raster tile.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    show: true
  }
}
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the bounding box. Used for debugging purposes.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    showBoundingBox: true
  }
}
```

### tms

**Type:** `boolean | undefined`

**Description:** Specifies whether to use TMS (Tile Map Service) format.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    tms: false
  }
}
```

