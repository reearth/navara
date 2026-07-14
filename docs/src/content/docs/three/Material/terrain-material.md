---
title: TerrainMaterial
description: Terrain mesh rendering options for a terrain layer
sidebar:
  order: 560
---

`TerrainMaterial` holds the render options for a [`terrain`](../../../three/layer/terrain-layer/) layer's mesh. It is set via the `terrain` key and applies regardless of the source's data format — [`raster-dem`](../../../three/source/raster-dem-source/) (RGB-encoded elevation) or [`quantized-mesh`](../../../three/source/quantized-mesh-source/). All fetch/geometry config (zoom range, tiling scheme, elevation decoder, extensions, token) lives on the referenced source, not here.

## Properties

### show

**Type:** `boolean | undefined` — **Default:** `true`

**Description:** Whether to show the terrain.

```typescript
{ terrain: { show: true } }
```

### castShadow

**Type:** `boolean | undefined` — **Default:** `false`

**Description:** Whether the terrain casts shadows.

```typescript
{ terrain: { castShadow: true } }
```

### receiveShadow

**Type:** `boolean | undefined` — **Default:** `false`

**Description:** Whether the terrain receives shadows.

```typescript
{ terrain: { receiveShadow: true } }
```

### showBoundingBox

**Type:** `boolean | undefined` — **Default:** `false`

**Description:** Whether to show per-tile bounding boxes. Used for debugging.

```typescript
{ terrain: { showBoundingBox: true } }
```

### skirt

**Type:** `boolean | undefined` — **Default:** `true`

**Description:** Whether to render skirts along tile boundaries to hide gaps between neighboring tiles at different LODs. Disable this if you want to visualize underground models.

```typescript
{ terrain: { skirt: true } }
```

### skirtExaggeration

**Type:** `number | undefined` — **Default:** `1.0`

**Description:** Multiplier applied to the auto-calculated skirt height. `1.0` uses the default calculated height.

```typescript
{ terrain: { skirtExaggeration: 1.5 } }
```

## Combining with other layers

A terrain layer provides only the 3D surface. Drape imagery or shaded relief on top with a [`raster`](../../../three/layer/raster-layer/) layer:

| Over terrain            | Supported | Notes                                                                            |
| ----------------------- | --------- | -------------------------------------------------------------------------------- |
| `raster` (imagery)      | ✅ Yes    | Raster imagery is reprojected and draped onto the mesh. Multiple can be stacked. |
| `raster` (hillshade)    | ✅ Yes    | Shaded relief computed from DEM tiles, rendered over the 3D surface.             |
| `vector` (vector tiles) | ❌ Not yet | Vector tiles cannot currently be draped onto quantized-mesh terrain.            |

## Related Resources

- [Terrain Layer](../../../three/layer/terrain-layer/) — how to use this material
- [Raster DEM Source](../../../three/source/raster-dem-source/) / [Quantized Mesh Source](../../../three/source/quantized-mesh-source/) — terrain data sources
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) — Cesium Ion quantized-mesh assets
