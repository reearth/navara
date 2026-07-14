---
title: RasterMaterial
description: Raster imagery rendering options for a raster layer
sidebar:
  order: 570
---

`RasterMaterial` holds the render options for a [`raster`](../../../three/layer/raster-layer/) layer's imagery. It is set via the `raster` key. All fetch/tiling config (zoom range, TMS, …) lives on the referenced [`raster-tile`](../../../three/source/raster-tile-source/) source, not here.

## Properties

### show

**Type:** `boolean | undefined`

**Description:** Whether to show the raster imagery.

```typescript
{ raster: { show: true } }
```

### color

**Type:** `Color`

**Description:** Tint color applied to the raster imagery, as a `Color` instance.

```typescript
import { Color } from "@navara/three";

{ raster: { color: new Color().setHex(0xffffff) } }
```

### opacity

**Type:** `number | undefined`

**Description:** Opacity of the raster imagery, from `0.0` to `1.0`.

```typescript
{ raster: { opacity: 0.8 } }
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** Whether to show per-tile bounding boxes. Used for debugging.

```typescript
{ raster: { showBoundingBox: true } }
```

:::note
Globe-level settings such as `maxSse` and `segments` are configured via the [Globe](/three/api/globe/) API, not on this material.
:::

## Related Resources

- [Raster Layer](../../../three/layer/raster-layer/) — how to use this material
- [Raster Tile Source](../../../three/source/raster-tile-source/) — the imagery source (URL, zoom, TMS)
