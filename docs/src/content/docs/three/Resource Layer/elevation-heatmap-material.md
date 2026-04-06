---
title: ElevationHeatmapMaterial
description: Elevation heatmap material for navara_three
sidebar:
  order: 40
---

`ElevationHeatmapMaterial` is a material for visualizing elevation data as a color-coded heatmap. It loads DEM (Digital Elevation Model) tile data and applies a colormap based on elevation values for display.

## Use Cases

- Visually representing elevation distribution of terrain
- Visualizing mountainous terrain and terrain analysis
- Intuitive understanding of elevation data

## Properties

### maxHeight

**Type:** `number | undefined`

**Description:** Specifies the maximum elevation value (in meters) for the colormap. Elevations exceeding this value will be displayed in the maximum color of the colormap.

**Default:** `1000`

**Example:**

```typescript
{
  elevationHeatmap: {
    maxHeight: 3000
  }
}
```

### minHeight

**Type:** `number | undefined`

**Description:** Specifies the minimum elevation value (in meters) for the colormap. Elevations at or below this value will be displayed in the minimum color of the colormap.

**Default:** `0`

**Example:**

```typescript
{
  elevationHeatmap: {
    minHeight: 0
  }
}
```

### elevationDecoder

**Type:** [`ElevationDecoder`](../../../three/resource-layer-reference/raster-terrain-material/#elevationdecoder-type) | `undefined`

**Description:** Specifies the decoder settings for converting encoded elevation data to actual elevation values. Select the appropriate decoder according to the DEM tile format being used.

**Example:**

```typescript
import { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

{
  elevationHeatmap: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER()
  }
}
```

### logarithmic

**Type:** `boolean`

**Description:** Specifies whether to use a logarithmic scale for elevation visualization. This is useful for making subtle elevation differences in lowland areas more visible when the difference between low and high elevations is large.

**Default:** `false`

**Example:**

```typescript
{
  elevationHeatmap: {
    logarithmic: true
  }
}
```

### logBoundary

**Type:** `number`

**Description:** Specifies the boundary value when using logarithmic scale. This value is used as the base for logarithmic calculations.

**Default:** `10`

**Example:**

```typescript
{
  elevationHeatmap: {
    logBoundary: 1000
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// Add an elevation heatmap layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  },
});
```

### Visualization with Logarithmic Scale

Use a logarithmic scale when you want to emphasize subtle elevation differences in lowland areas.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// Display elevation heatmap with logarithmic scale
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    logarithmic: true,
    logBoundary: 1000,
  },
});
```

### Combined Use with 3D Terrain

The elevation heatmap can be combined with a 3D terrain layer for more intuitive terrain visualization.

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const TERRAIN_URL =
  "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png";

// Add 3D terrain layer
view.addLayer({
  type: "terrain",
  data: {
    url: TERRAIN_URL,
  },
  rasterTerrain: {
    maxZoom: 12,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  },
});

// Add elevation heatmap layer (displayed on top of terrain)
view.addLayer({
  type: "tiles",
  data: {
    url: TERRAIN_URL,
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  },
});
```

### Customizing the Colormap

The elevation heatmap colors can be changed using the `globe.elevationColormap` property.

```typescript
import ThreeView, { ColorMap, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// ref: https://colorbrewer2.org/#type=diverging&scheme=RdYlBu&n=11
const rdYlBuColorMap = new ColorMap("diverging", "RdYlBu", [
  new Color().setStyle("#313695"),
  new Color().setStyle("#4575b4"),
  new Color().setStyle("#74add1"),
  new Color().setStyle("#abd9e9"),
  new Color().setStyle("#e0f3f8"),
  new Color().setStyle("#ffffbf"),
  new Color().setStyle("#fee090"),
  new Color().setStyle("#fdae61"),
  new Color().setStyle("#f46d43"),
  new Color().setStyle("#d73027"),
  new Color().setStyle("#a50026"),
]);

view.globe.elevationColormap = rdYlBuColorMap;
```

## Related Resources

- [ColorMap class](../../../three/api-reference/colormap/) - Detailed API reference for ColorMap
- [Globe class](../../../three/api-reference/globe/) - Details on the `elevationColormap` property
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - Material for 3D terrain rendering
- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - Tile layer configuration

:::note
The elevation heatmap is configured via the `elevationHeatmap` property of the Tile Layer. Use it in conjunction with `rasterTile`.
:::
