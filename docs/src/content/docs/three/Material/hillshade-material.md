---
title: HillshadeMaterial
description: Hillshade material for navara_three
sidebar:
  order: 600
---

`HillshadeMaterial` holds the render options for hillshade (shaded relief) on a [`raster`](../../../three/layer/raster-layer/) layer. It computes surface normals from DEM elevation values and shades the tile based on lighting direction, emphasizing terrain features such as ridges and valleys. Set it via the `hillshade` key.

Because it decodes DEM tiles, it requires a [`raster-dem`](../../../three/source/raster-dem-source/) source; the elevation decoder is taken from the source, not from this material.

## Use Cases

- Emphasizing terrain undulation on flat (2D) basemaps
- Computing accurate terrain normals from DEM tiles on top of [3D terrain layers](../../../three/layer/terrain-layer/) (the geometry's vertex normals are coarse-grained; hillshade derives per-pixel normals directly from the elevation tile)
- Drawing attention to subtle topographic features that are hard to perceive from a raster basemap alone

## Properties

### exaggeration

**Type:** `number | undefined` — **Default:** `1.0`

**Description:** Exaggeration factor applied to elevation differences when computing the hillshade. Larger values produce stronger shading; smaller values produce more subtle shading.

```typescript
{ hillshade: { exaggeration: 0.5 } }
```

## Usage Example

Add hillshade on top of a flat basemap by referencing a `raster-dem` source. The decoder lives on the source.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navaramap/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// Base imagery
const imagery = view.addSource({ type: "raster-tile", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19 });
view.addLayer({ type: "raster", source: imagery });

// Hillshade from a raster-dem source
const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/terrarium/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  maxZoom: 17,
  minZoom: 5,
});
view.addLayer({ type: "raster", source: dem, hillshade: { exaggeration: 0.5 } });
```

Reuse the same `raster-dem` source for both a [`terrain`](../../../three/layer/terrain-layer/) layer (geometry) and a `raster` hillshade layer (shading) to get shaded relief over the actual 3D surface.

## Related Resources

- [Raster Layer](../../../three/layer/raster-layer/) — how to use this material
- [Raster DEM Source](../../../three/source/raster-dem-source/) — DEM source and its elevation decoder
- [Terrain Layer](../../../three/layer/terrain-layer/) — 3D terrain rendering
- [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/) — visualize elevation data as a heatmap
