---
title: Realistic Atmosphere
description: Realistic visual rendering using atmospheric effects
sidebar:
  order: 6
---

![Result](@assets/tutorial/realistic-atmosphere-result.png)

Achieve more realistic visual rendering using atmospheric effects.

**What you will learn in this tutorial:**
- Adding Aerial Perspective effects
- Configuring sky, sun, and star descriptors
- Adding cloud effects
- Setting up tone mapping and anti-aliasing
- Adding rain and snow effects
- Configuring water surface materials (using GSI MVT data)

## Adding the Aerial Perspective Effect

Aerial Perspective applies a haze and atmospheric depth effect based on distance. Using `DefaultPlugin`, all default descriptors are registered, and `addDefaultPhotorealScene()` sets up a photorealistic scene in one call.

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({ shadow: true });
view.addPlugin(plugin);
await view.init();

// Set up a photorealistic scene in one call (sky, sunlight, stars, atmospheric effects, tone mapping, anti-aliasing, etc.)
const layers = plugin.addDefaultPhotorealScene();

// Adjust Aerial Perspective as needed
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // Deferred lighting (required for displaying cloud shadows)
  },
});

const photoSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: photoSource,
});

const terrainSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  minZoom: 6,
  maxZoom: 15,
});
view.addLayer({
  type: "terrain",
  source: terrainSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: terrainSource,
  hillshade: {},
});

view.setCamera({ lng: 139.7511, lat: 35.6736, height: 400, heading: -100, pitch: -20, roll: 0 });
```

With `addDefaultPhotorealScene()`, atmospheric descriptors such as sky, sunlight, stars, and skylight probe are also automatically added. To cast shadows, update the sunlight settings.

```typescript
layers.sun.update({ sun: { castShadow: true } }); // Cast shadows
```

:::caution[Notes on irradiance]
Enabling `irradiance` may cause unstable rendering of transparent materials (such as glass). If you use many transparent objects, consider setting `irradiance: false`.
:::

## Setting Up Tone Mapping and Anti-Aliasing

Configure tone mapping, exposure, and anti-aliasing for a natural HDR look.

```typescript
// Tone mapping
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // Adjust according to the scene

// Anti-aliasing
// addDefaultPhotorealScene() automatically selects SMAA for desktop and FXAA for mobile optimization
```

## Adding Cloud Effects

Overlaying volumetric cloud effects enhances the sense of realism. Start with the default settings and adjust shadows and density as needed.

```typescript
const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {},
});

// Example: Enable cloud shadows
clouds.update({ clouds: { shadows: true } });
```

![Result](@assets/tutorial/realistic-atmosphere.png)

## Adding Rain Effects

Rain effects use a combination of two objects. `RainMeshDesc` renders 3D raindrop particles in the scene, and `RainDropEffectDesc` provides a post-processing effect of water droplets on the screen.

### 3D Raindrop Particles

```typescript
// Enable the animation loop to keep rain animation running
view.animation = true;

// Add rain object
const rain = view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // Number of raindrops
    speed: 0.0015,             // Fall speed
    opacity: 1.0,         // Opacity
    width: 3,          // Raindrop width
    height: 60.0,          // Raindrop length
    areaWidth: 500,       // Rainfall area width (m)
    areaHeight: 1000,      // Rainfall area height (m)
    maxHeight: 10000,       // Maximum rainfall area height (m)
  },
});
```

### Screen Water Droplet Effect

A post-processing effect that simulates water droplets adhering to the camera lens during rainy weather.

```typescript
const rainDropEffect = view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 0.8,           // Overall effect opacity
    dropGridSize: 14,       // Water droplet grid size
    dropDensity: 0.1,       // Water droplet density
    dropSizeFactor: 0.025,  // Water droplet size factor
  },
});
```

:::tip[Combining Rain Effects]
Enabling both `RainMeshDesc` and `RainDropEffectDesc` simultaneously allows for a more immersive rain effect.
:::

![Result](@assets/tutorial/realistic-atmosphere-rain.png)

## Adding Snow Effects

For snow effects, use `SnowMeshDesc`. Remove the rain object and add it instead.

```typescript
// Add snow object
const snow = view.addMesh<SnowMeshDesc>({
  snow: {
    particleCount: 5000,  // Number of snowflakes
    speed: 0.00005,           // Fall speed
    size: 10,              // Snowflake size
    opacity: 1,         // Opacity
    areaWidth: 500,       // Snowfall area width (m)
    areaHeight: 1000,      // Snowfall area height (m)
    maxHeight: 3000,       // Maximum snowfall area height (m)
    // Wind-driven sway
    movementStrength: { x: 50, y: 20, z: 50 }, // Sway amplitude for each axis
    movementSpeed: { x: 0.0005, y: 0.0002, z: 0.0005 }, // Sway speed for each axis
  },
});
```

:::caution[Performance Note]
Increasing `particleCount` makes the effect more realistic, but may impact performance on mobile devices. Adjust as needed.
:::

![Result](@assets/tutorial/realistic-atmosphere-snow.png)

## Adding Water Surface Materials (GSI MVT Data)

The Geospatial Information Authority of Japan's experimental vector tiles (experimental_bvmap) include water area data such as rivers and lakes. Using the `water: true` option applies a water surface material with ripples.

:::caution[Required ThreeView Option]
To use the water surface material, you must enable `waterTexture` when constructing `ThreeView`. Without it, the `water: true` option on the layer will have no effect.

```typescript
const view = new ThreeView<DefaultDescriptions>({
  waterTexture: { enabled: true },
  // ...other options
});
```
:::

```typescript
// Add water area layer from GSI experimental vector tiles
const waterSource = view.addSource({
  // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
  // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
  type: "vector-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});
view.addLayer({
  type: "vector",
  source: waterSource,
  sourceLayers: ["waterarea"], // Use only the water area layer
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.2,    // Reflectivity
    clampToGround: true,  // Clamp to terrain
    water: true,          // Enable water surface material
  },
});

view.atmosphere.date = new Date("2026-01-01T16:00:00+09:00"); // January 1, 16:00 JST
view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

![Result](@assets/tutorial/realistic-atmosphere-water.png)

### Combining with SSR (Screen Space Reflections)

Adding `SSREffectDesc` enables real-time reflections of buildings and other objects on the water surface.

```typescript
// Add PLATEAU building models
const plateauSource = view.addSource({
  // Credit:
  // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
  //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: plateauSource,
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // Adjust ellipsoidal height
    castShadow: true,
    receiveShadow: true,
  },
});

// Add SSR effect
view.addEffect<SSREffectDesc>({
  ssr: {},
});

view.atmosphere.date = new Date("2026-01-01T12:00:00+09:00"); // January 1, 12:00 JST

view.setCamera({
  lng: 139.7511145474829,
  lat: 35.67364356091717,
  height: 902.0,
  heading: 64.41840149763287,
  pitch: -36.00000121921312,
  roll: 0,
});
```

![Result](@assets/tutorial/realistic-atmosphere-ssr.png)

## Complete Example

Below is a complete example combining atmospheric effects, rain, and water surface materials.

```typescript
import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { type CloudsEffectDesc, type RainDropEffectDesc, type RainMeshDesc, type SnowMeshDesc, type SSREffectDesc, ToneMappingMode } from "@navara/three_default_descs";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({
  shadow: true,
  animation: true,
  waterTexture: {
    enabled: true
  },
});
view.addPlugin(plugin);
await view.init();

// Set up a photorealistic scene in one call
const layers = plugin.addDefaultPhotorealScene();

// Adjust Aerial Perspective as needed
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // Deferred lighting (required for displaying cloud shadows)
  },
});

const photoSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: photoSource,
});

const terrainSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  minZoom: 6,
  maxZoom: 15,
});
view.addLayer({
  type: "terrain",
  source: terrainSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: terrainSource,
  hillshade: {},
});

layers.sun.update({ sun: { castShadow: true } }); // Cast shadows

// Tone mapping
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // Adjust according to the scene

const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {
    qualityPreset: "high"
  },
});

// Enable cloud shadows
clouds.update({ clouds: { shadows: true } });

view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // Number of raindrops
    speed: 0.0015,             // Fall speed
    opacity: 1.0,         // Opacity
    width: 3,          // Raindrop width
    height: 60.0,          // Raindrop length
    areaWidth: 500,       // Rainfall area width (m)
    areaHeight: 1000,      // Rainfall area height (m)
    maxHeight: 10000,       // Maximum rainfall area height (m)
  },
});

view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 0.8,           // Overall effect opacity
    dropGridSize: 14,       // Water droplet grid size
    dropDensity: 0.1,       // Water droplet density
    dropSizeFactor: 0.025,  // Water droplet size factor
  },
});

// Add water area layer from GSI experimental vector tiles
const waterSource = view.addSource({
  // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
  // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
  type: "vector-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});
view.addLayer({
  type: "vector",
  source: waterSource,
  sourceLayers: ["waterarea"], // Use only the water area layer
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.02,    // Reflectivity
    clampToGround: true,  // Clamp to terrain
    water: true,          // Enable water surface material
  },
});

// Add PLATEAU building models
const plateauSource = view.addSource({
  // Credit:
  // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
  //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: plateauSource,
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // Adjust ellipsoidal height
    castShadow: true,
    receiveShadow: true,
  },
});

// Add SSR effect
view.addEffect<SSREffectDesc>({
  ssr: {
  },
});

view.atmosphere.date = new Date("2026-01-01T16:00:00+09:00"); // January 1, 16:00 JST

view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

:::tip[Tips for a Natural Look]
- **3D Tiles models**: Adjust `roughness`/`metalness` and properly enable `castShadow`/`receiveShadow`
- **Time of day adjustment**: Set the time with an ISO string including a timezone offset, e.g. `new Date("2026-01-01T08:00:00+09:00")`
- **Weather switching**: Rain and snow can be toggled using the `.visible` property
- **Water surface adjustment**: Adjust wave motion with `waterSpeed` and `waterScaleNormal`
:::
