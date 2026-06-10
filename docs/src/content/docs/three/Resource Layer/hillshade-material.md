---
title: HillshadeMaterial
description: Hillshade material for navara_three
sidebar:
  order: 41
---

`HillshadeMaterial` is a material for rendering hillshade (shaded relief) from DEM (Digital Elevation Model) tile data. It computes surface normals from elevation values and shades the tile based on lighting direction, emphasizing terrain features such as ridges and valleys.

## Use Cases

- Emphasizing terrain undulation on flat (2D) basemaps
- Adding richer surface detail on top of [3D terrain layers](../../../three/resource-layer-reference/terrain-layer/)
- Drawing attention to subtle topographic features that are hard to perceive from a raster basemap alone

## Properties

### elevationDecoder

**Type:** [`ElevationDecoder`](../../../three/resource-layer-reference/raster-terrain-material/#elevationdecoder-type) | `undefined`

**Description:** Specifies the decoder settings for converting encoded elevation data to actual elevation values. Select the appropriate decoder according to the DEM tile format being used.

**Example:**

```typescript
import { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

{
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER()
  }
}
```

### exaggeration

**Type:** `number | undefined`

**Description:** Specifies the exaggeration factor applied to elevation differences when computing the hillshade. Larger values produce stronger shading and emphasize terrain features more aggressively; smaller values produce more subtle shading.

**Default:** `1.0`

**Example:**

```typescript
{
  hillshade: {
    exaggeration: 0.5
  }
}
```

## Usage Examples

### Basic Usage (Flat Basemap + Hillshade)

Adding hillshade on top of a flat basemap (no 3D terrain) emphasizes terrain features while keeping the map two-dimensional.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// Base raster tile layer
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// Hillshade layer (DEM tiles)
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
});
```

### Combined Use with 3D Terrain

Hillshade can be combined with a [3D Terrain layer](../../../three/resource-layer-reference/terrain-layer/) to produce a shaded relief over the actual 3D surface. The terrain layer provides the geometry, while the hillshade layer adds shading driven by elevation gradients.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const TERRAIN_URL =
  "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png";

// Base raster tile layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// 3D terrain layer (provides geometry)
view.addLayer({
  type: "terrain",
  data: {
    url: TERRAIN_URL,
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  },
});

// Hillshade layer (adds shaded relief on top of the terrain)
view.addLayer({
  type: "tiles",
  data: {
    url: TERRAIN_URL,
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
});
```

### Dynamically Updating Exaggeration

`exaggeration` can be updated at runtime via `view.updateLayerById` to interactively adjust the strength of the shading.

```typescript
import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const layerDef: LayerDescription = {
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
};

const hillshadeLayer = view.addLayer(layerDef);

// Update exaggeration later
if (layerDef.hillshade) {
  layerDef.hillshade.exaggeration = 2.0;
  view.updateLayerById(hillshadeLayer.id, layerDef);
}
```

## Related Resources

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - Tile layer configuration
- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - 3D terrain rendering
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - Material for 3D terrain rendering, including elevation decoder reference
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - Visualize elevation data as a heatmap

:::note
Hillshade is configured via the `hillshade` property of the Tile Layer. It is typically used together with `rasterTile`, and can be combined with a separate Terrain Layer for shaded relief over 3D terrain.
:::
