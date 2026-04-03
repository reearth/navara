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

### maxSse

**Type:** `number`

**Description:** The maximum value used to determine the level of detail (LOD). Higher values improve performance but reduce visual quality.

**Default:** `2`

**Example:**

```typescript
{
  rasterTile: {
    maxSse: 4
  }
}
```

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

### segments

**Type:** `number`

**Description:** Specifies the number of polygon subdivision segments. Higher segment counts produce smoother spherical surfaces.

**Example:**

```typescript
{
  rasterTile: {
    segments: 32
  }
}
```

### shouldComputeNormalFromVertex

**Type:** `boolean | undefined`

**Description:** Specifies whether to compute normals from vertices. This is automatically set to `true` when Terrain is added. When set to `true` without Terrain being added, sunlight shadows will be displayed.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    shouldComputeNormalFromVertex: true
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

### wireframe

**Type:** `boolean | undefined`

**Description:** Specifies whether to display as wireframe.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    wireframe: false
  }
}
```
