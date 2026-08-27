---
title: Arch Line Visualization
description: Visualizing air traffic volume between airports using arch lines
sidebar:
  order: 220
---

![Result](@assets/tutorial/arch-line-visualization-result.png)

Learn how to visualize air traffic volume data between airports using arch lines (great circle routes lifted into arcs). This tutorial combines data-driven color mapping, animation, and glow effects to create a beautiful visualization.

**What you will learn in this tutorial:**
- Setting up a dark-themed globe view
- Configuring starfield, ambient light, and tone mapping
- Loading and processing GeoJSON data
- Data-driven color mapping using ColorMap
- Efficiently rendering multiple arch lines
- Expressing flow with dash animation
- Making the globe look beautiful with a glow effect

## Basic Implementation

First, create the base view.

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { ToneMappingMode } from "@navaramap/three-default-descs";
import { DefaultPlugin, type DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({
  backgroundColor: new Color().setStyle("#0b0a0d"),
});
view.addPlugin(plugin);

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Adjust tone mapping exposure
view.toneMappingExposure = 10;

// Add ambient light
view.addLight({
  ambient: {},
});

// Add starfield
view.addMesh({
  stars: {
    intensity: 100,
    pointSize: 1.5,
  },
});

// Add tone mapping effect
view.addEffect({
  toneMapping: {
    mode: ToneMappingMode.REINHARD2,
  },
});

// Add anti-aliasing (SMAA)
view.addEffect({
  smaa: {
    quality: "ultra",
  },
});

// Base satellite imagery tiles
const satelliteSource = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/bluemarble/tilejson.json",
});
view.addLayer({
  type: "raster",
  source: satelliteSource,
});

// Set camera to a position where the entire globe is visible
view.setCamera({ lng: 140, lat: 20, height: 12_600_000, heading: 0, pitch: -90, roll: 0 });
```

## Adding Night Tiles

To create a more beautiful nighttime Earth, overlay night tiles (NASA Earth at Night).

```typescript
// Add night tiles (overlaid with transparency)
const nightSource = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/blackmarble/tilejson.json",
});
view.addLayer({
  type: "raster",
  source: nightSource,
  raster: {
    opacity: 0.8, // Overlay with transparency
  },
});
```

:::note[About the Night Tiles]
`blackmarble` is NASA Earth Observatory's [Earth at Night 2016](https://earthobservatory.nasa.gov/features/NightLights) served as XYZ tiles by [Re:Earth Papers](https://papers.reearth.land).
:::

## Adding a Glow Effect

```typescript
import type { GlowGlobeMeshDesc } from "@navaramap/three-default-descs";

// Add globe glow effect
view.addMesh<GlowGlobeMeshDesc>({
  glowGlobe: {
    radiusScale: 1.2,
    coefficient: 0.43,
    exponent: 40.0,
    glowColor: new Color().setStyle("#938cff"),
    opacity: 0.5,
  },
});
```

:::tip[Customizing the Glow]
- `radiusScale`: Increasing this value makes the glow spread wider
- `coefficient`: Increasing this value makes the glow brighter
- `exponent`: Increasing this value makes the glow boundary sharper
- `glowColor`: Adjust the color to match your scene
:::

![Result](@assets/tutorial/arch-line-glow-globe.png)

## Loading GeoJSON Data

Load air traffic volume data between airports in GeoJSON format.

```typescript
import type { FeatureCollection, MultiLineString } from "geojson";

// Type definition for air traffic volume data
type AirportTrafficData = FeatureCollection<
  MultiLineString,
  {
    S10b_001: string; // Departure airport
    S10b_004: string; // Arrival airport
    S10b_005: number; // Distance
    S10b_006: number; // Number of flights
    S10b_007: number; // Number of passengers
    S10b_008: number; // Total transport volume
    S10b_009: number; // Cargo volume
  }
>;

// Fetch data
const response = await fetch(
  "https://assets.cms.reearth.io/assets/3b/63858d-9197-4b39-bbed-c17b6add52a4/airport-traffic-volume.geojson"
);
const data: AirportTrafficData = await response.json();
```

:::note[About the Data]
This is the [inter-airport flow volume data from the National Land Numerical Information service](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S10b-2014.html), converted to GeoJSON and hosted on [Re:Earth CMS](https://reearth.io/product/cms).
:::

## Data-Driven Color Mapping with ColorMap

Using the `ColorMap` class, you can map numerical data to colors. Here we assign colors based on the number of flights.

```typescript
import { Color, ColorMap, geodeticToVector3 } from "@navaramap/three";

// ref: https://matplotlib.org/stable/users/explain/colors/colormaps.html
const PLASMA_COLORMAP = new ColorMap("sequential", "Plasma", [
  [0.050383, 0.029803, 0.527975],
  [0.494877, 0.011990, 0.657865],
  [0.798216, 0.280197, 0.469538],
  [0.994324, 0.716681, 0.177208],
]);

// Get the maximum number of flights (normalized on a logarithmic scale)
const maxTrafficLog = Math.max(
  ...data.features.map((f) => Math.log(f.properties.S10b_006 + 1))
);

// Convert each GeoJSON feature to an arch line definition
const arcLines = data.features.map((feature) => {
  const coords = feature.geometry.coordinates[0];
  const source = { lng: coords[0][0], lat: coords[0][1] };
  const destination = { lng: coords[1][0], lat: coords[1][1] };

  // Calculate distance between two points (used for animation speed adjustment)
  const srcVec = geodeticToVector3({
    lat: source.lat,
    lng: source.lng,
    height: 0,
  });
  const destVec = geodeticToVector3({
    lat: destination.lat,
    lng: destination.lng,
    height: 0,
  });
  const distance = srcVec.distanceTo(destVec);

  // Normalize flight count on a logarithmic scale (0 to 1)
  const trafficVolume = feature.properties.S10b_006;
  const trafficVolumeLog = Math.log(trafficVolume + 1);
  const normalizedTraffic = trafficVolumeLog / maxTrafficLog;

  // Get color from ColorMap
  const [r, g, b] = PLASMA_COLORMAP.linear(normalizedTraffic);
  const color = new Color().setRGB(r, g, b);

  return {
    thickness: 1.2,
    transparent: true,
    opacity: 0.3,
    segments: 64,
    height: 0,
    arcHeightScale: 0.3,
    srcColor: color,
    tgtColor: color,
    dashed: true,
    dashSize: 500000,
    dashOffset: Math.random() * 1000000, // Random initial offset
    gapSize: 800000,
    geometry: [source, destination],
    distance, // Used for animation speed calculation
  };
});
```

:::tip[Using Logarithmic Scale]
When data distribution is skewed (a few high values and many low values), using a logarithmic scale `Math.log(x + 1)` makes the color distribution more even.
:::

:::tip[ColorMap Details]
For details on `ColorMap` class methods (`linear()`, `quantize()`, etc.), see the [ColorMap class](../../../three/api/colormap/) reference.
:::

## Adding the Arch Line Object

```typescript
import type { ArclineMeshDesc } from "@navaramap/three-default-descs";

const arcLineHandle = view.addMesh<ArclineMeshDesc>({
  arcLines,
});
```

![Result](@assets/tutorial/arch-line-colormap.png)

## Adding Dash Animation

Update the dash offset on every frame with `view.on("preUpdate", ...)` to express flow directionality. `preUpdate` fires just before the view processes a frame, so the offsets written there are picked up by the render of that same frame. Adjusting the animation speed based on distance creates a more natural appearance.

```typescript
// Dash animation flowing from origin to destination
view.on("preUpdate", () => {
  arcLines.forEach((arcLineDef) => {
    // Calculate animation speed based on distance
    const baseSpeed = 5000;
    const distance = arcLineDef.distance || 1;
    const speedMultiplier = Math.sqrt(distance / 2000000);
    const speed = baseSpeed * speedMultiplier;

    arcLineDef.dashOffset = (arcLineDef.dashOffset ?? 0) + speed;
  });

  arcLineHandle.update({ arcLines });
});
```

:::note[Adjusting Animation Speed]
- `baseSpeed`: Base speed. Increasing it makes the overall animation faster
- `speedMultiplier`: Distance-based multiplier. Using `Math.sqrt` makes longer distances faster and shorter distances slower
- Using a linear scale (`distance / 2000000`) may result in long distances being too fast and short distances being too slow
:::

## Complete Example

```typescript
import ThreeView, {
  Color,
  ColorMap,
  geodeticToVector3,
} from "@navaramap/three";
import {
  ToneMappingMode,
  type ArclineMeshDesc,
  type GlowGlobeMeshDesc,
} from "@navaramap/three-default-descs";
import { DefaultPlugin, type DefaultDescriptions } from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import type { FeatureCollection, MultiLineString } from "geojson";

// Type definition for air traffic volume data
type AirportTrafficData = FeatureCollection<
  MultiLineString,
  {
    S10b_001: string;
    S10b_004: string;
    S10b_005: number;
    S10b_006: number;
    S10b_007: number;
    S10b_008: number;
    S10b_009: number;
  }
>;

// ref: https://matplotlib.org/stable/users/explain/colors/colormaps.html
const PLASMA_COLORMAP = new ColorMap("sequential", "Plasma", [
  [0.050383, 0.029803, 0.527975],
  [0.494877, 0.011990, 0.657865],
  [0.798216, 0.280197, 0.469538],
  [0.994324, 0.716681, 0.177208],
]);

// Construct data
const constructData = async () => {
  const response = await fetch(
    "https://assets.cms.reearth.io/assets/3b/63858d-9197-4b39-bbed-c17b6add52a4/airport-traffic-volume.geojson"
  );
  const data: AirportTrafficData = await response.json();

  const maxTrafficLog = Math.max(
    ...data.features.map((f) => Math.log(f.properties.S10b_006 + 1))
  );

  const arcLines = data.features.map((feature) => {
    const coords = feature.geometry.coordinates[0];
    const source = { lng: coords[0][0], lat: coords[0][1] };
    const destination = { lng: coords[1][0], lat: coords[1][1] };

    const srcVec = geodeticToVector3({
      lat: source.lat,
      lng: source.lng,
      height: 0,
    });
    const destVec = geodeticToVector3({
      lat: destination.lat,
      lng: destination.lng,
      height: 0,
    });
    const distance = srcVec.distanceTo(destVec);

    const trafficVolume = feature.properties.S10b_006;
    const trafficVolumeLog = Math.log(trafficVolume + 1);
    const normalizedTraffic = trafficVolumeLog / maxTrafficLog;

    const [r, g, b] = PLASMA_COLORMAP.linear(normalizedTraffic);
    const color = new Color().setRGB(r, g, b);

    return {
      thickness: 1.2,
      transparent: true,
      opacity: 0.3,
      segments: 64,
      height: 0,
      arcHeightScale: 0.3,
      srcColor: color,
      tgtColor: color,
      dashed: true,
      dashSize: 500000,
      dashOffset: Math.random() * 1000000,
      gapSize: 800000,
      geometry: [source, destination],
      distance,
    };
  });

  return { arcLines };
};

// Main function
async function run() {
  const plugin = new DefaultPlugin();
  const view = new ThreeView<DefaultDescriptions>({
    backgroundColor: new Color().setStyle("#0b0a0d"),
  });
  view.addPlugin(plugin);

  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = 10;

  // Ambient light
  view.addLight({
    ambient: {},
  });

  // Starfield
  view.addMesh({
    stars: {
      intensity: 100,
      pointSize: 1.5,
    },
  });

  // Tone mapping
  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });

  // Anti-aliasing
  view.addEffect({
    smaa: {
      quality: "ultra",
    },
  });

  // Satellite imagery tiles
  const satelliteSource = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/bluemarble/tilejson.json",
  });
  view.addLayer({
    type: "raster",
    source: satelliteSource,
  });

  // Night tiles (optional)
  const nightSource = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/blackmarble/tilejson.json",
  });
  view.addLayer({
    type: "raster",
    source: nightSource,
    raster: {
      opacity: 0.8,
    },
  });

  // Glow effect
  view.addMesh<GlowGlobeMeshDesc>({
    glowGlobe: {
      radiusScale: 1.2,
      coefficient: 0.43,
      exponent: 40.0,
      glowColor: new Color().setStyle("#938cff"),
      opacity: 0.5,
    },
  });

  // Construct arch line data
  const { arcLines } = await constructData();

  // Add arch line object
  const arcLineHandle = view.addMesh<ArclineMeshDesc>({
    arcLines,
  });

  // Dash animation
  view.on("preUpdate", () => {
    arcLines.forEach((arcLineDef) => {
      const baseSpeed = 5000;
      const distance = arcLineDef.distance || 1;
      const speedMultiplier = Math.sqrt(distance / 2000000);
      const speed = baseSpeed * speedMultiplier;

      arcLineDef.dashOffset = (arcLineDef.dashOffset ?? 0) + speed;
    });

    arcLineHandle.update({ arcLines });
  });

  // Camera settings
  view.setCamera({ lng: 140, lat: 20, height: 12_600_000, heading: 0, pitch: -90, roll: 0 });
}

run();
```

:::tip[Customization Tips]
- **Changing colors**: Choose an appropriate colormap from [ColorBrewer](https://colorbrewer2.org/) or [matplotlib colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html)
- **Changing thickness**: Dynamically varying `thickness` based on data allows you to display routes with more flights as thicker lines
- **Adjusting transparency**: Adjust `opacity` to improve visibility of overlapping routes
- **Camera angle**: Adjust the camera position according to your purpose, such as Japan-centered, all of Asia, or the entire world
:::
