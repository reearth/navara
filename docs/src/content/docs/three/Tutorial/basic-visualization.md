---
title: Basic Visualization
description: Basic implementation of map display, terrain display, and GIS data display
sidebar:
  order: 4
---

This tutorial explains the basic methods for displaying maps using navara_three.

## Setup

Create a new navara_three project and install the required libraries:

```bash
npm create navara-three-starter my-navara-app
cd my-navara-app
npm install
```

## Displaying a Map

### Adding a Raster Tile Layer

Open `index.html` and you will see the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Navara Three</title>
  </head>
  <body style="margin: 0; overflow: hidden">
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Next, open `src/main.ts` and you will see the following:

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// Create a ThreeView instance
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();
```

By adding `DefaultPlugin`, the default descriptors for meshes, effects, and lights become available.

Add the following code to `main.ts`:

```typescript
// Add basic ambient light
view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
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
```

### Result

A base map will be displayed on the globe in the scene.

![Basic Map](@assets/tutorial/basemap.png)

### Code Explanation

**Initializing ThreeView**

```typescript
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();
```

Create a `ThreeView` instance, register default descriptors with `DefaultPlugin`, and then initialize. This sets up the 3D scene and camera.

**Adding Light**

```typescript
view.addLight({
  ambient: {},
});
```

Add basic ambient light to illuminate the scene.

**Adding a Tile Layer**

```typescript
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
```

Add a map layer using OpenStreetMap raster tiles.

### Complete Code

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// Create a ThreeView instance
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
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
```

## Setting the Camera Position

### Set the Camera Position

To display the map at a specific location, set the camera position. Add the following to `main.ts`:

```typescript
view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

### Result

The camera position is set to the area around Tokyo.

![Camera Map](@assets/tutorial/camera.png)

### Code Explanation

You can set the camera position and orientation using the `view.setCamera()` method. For details on the parameters, see [ThreeView Functions](../../../three/api-reference/threeview-functions/).

### Complete Code

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// Create a ThreeView instance
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
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

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

## Displaying Terrain

In this tutorial, you will learn how to add terrain data to the map created in the previous step.

### Adding a Terrain Layer

Add a terrain layer to `src/main.ts`.

First, import JAPAN_GSI_ELEVATION_DECODER to decode the terrain tiles.

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
```

Add the terrain layer **before** the raster tile layer (layers are rendered in the order they are added):

```typescript
// Add terrain layer
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Result

When you tilt the map, you can see the terrain relief.

![Terrain Map](@assets/tutorial/terrain.png)

### Code Explanation

**Terrain Data Source**

```typescript
data: {
// Credit:
// - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
//   https://maps.gsi.go.jp/development/ichiran.html
url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
},
```

Here we use the elevation tiles from the Geospatial Information Authority of Japan.

**Terrain Settings**

```typescript
rasterTerrain: {
minZoom: 6,
maxZoom: 15,
elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
castShadow: true,
receiveShadow: true,
},
```

- The maximum zoom level, minimum zoom level, and shadows for terrain tiles are configured here.
- The elevationDecoder decodes the terrain data.

For details, see [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/).

### Complete Code

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// Create a ThreeView instance
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add terrain layer
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});

// Add OpenStreetMap tile layer
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

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

## Displaying GeoJSON Data

In this tutorial, you will learn how to display polygons on the map using GeoJSON data.

### Adding a GeoJSON Layer

Add a GeoJSON layer to `src/main.ts`.

```typescript
// Display polygon data
view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    properties: { name: "Area" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.75843063805576, 35.70688252862743],
          [139.75843063805576, 35.700933240062355],
          [139.77157543771887, 35.700933240062355],
          [139.77157543771887, 35.70688252862743],
          [139.75843063805576, 35.70688252862743],
        ],
      ],
    },
  },
  polygon: {
    color: new Color().setHex(0x00ff00),
    height: 0,
    opacity: 0.5,
    transparent: true,
  },
});
```

### Result

A polygon is displayed on the map.

![GeoJSON Map](@assets/tutorial/geojson.png)

### Code Explanation

Use the `view.addLayer` method to add a GeoJSON layer. By specifying `type: "geojson"`, you can display GeoJSON format data on the map. You can also configure polygon styling (color, height, transparency, etc.).

For details, see [GeoJSON Layer](../../../three/resource-layer-reference/geojson-layer/).

### Complete Code

A complete example combining everything:

```typescript
import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});

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

// Polygon (area)
view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.75843063805576, 35.70688252862743],
          [139.75843063805576, 35.700933240062355],
          [139.77157543771887, 35.700933240062355],
          [139.77157543771887, 35.70688252862743],
          [139.75843063805576, 35.70688252862743],
        ],
      ],
    },
  },
  polygon: {
    color: new Color().setHex(0x00ff00),
    height: 0,
    opacity: 0.5,
    transparent: true,
  },
});

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```
