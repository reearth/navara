---
title: ThreeView Class
description: API Reference for ThreeView Class Overview and Constructor
sidebar:
  order: 11
---

ThreeView is the main class for creating and managing 3D map visualizations using Three.js and WebGL. It provides a comprehensive API for layer management, camera control, rendering, and event handling.

## Example

```tsx
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Vector3 } from "three";

// Create ThreeView instance
const view = new ThreeView({
  shadow: true,
  animation: true,
  backgroundColor: 0x0a0a0f,
  logarithmicDepthBuffer: true,
});

// Initialize the view
await view.init();

// Add default atmosphere layers (sky, stars, sun, light probe)
const atmosphereLayers = view.addDefaultAtmosphereLayers();

// Add terrain layer
view.addLayer({
  type: "terrain",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});

// Add raster tile layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    color: new Color().setHex(0xffffff),
    maxZoom: 23,
    opacity: 1,
  },
});

// Set camera position
view.setCamera({
  lng: 139.7,
  lat: 35.7,
  height: 1000,
  pitch: -45,
  heading: 0,
  roll: 0,
});
```

## Properties

### container

**Type:** `HTMLElement | undefined`

**Description:** The HTML container element for rendering the view. When specified, ThreeView adds a canvas within this container.

**Example:**

```typescript
const view = new ThreeView({
  container: document.getElementById("map") ?? undefined,
});
```

### canvas

**Type:** `HTMLCanvasElement | OffscreenCanvas | undefined`

**Description:** The canvas element used for rendering. When specified, this canvas is used. When not specified, a new canvas is created.

**Example:**

```typescript
const view = new ThreeView({
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
});
```

### pixelRatio

**Type:** `number | undefined`

**Description:** Override for the device pixel ratio. Affects rendering quality on high-DPI displays. When not specified, the device's default value is used.

**Example:**

```typescript
const view = new ThreeView({
  pixelRatio: 2,
});
```

### disableAutoResize

**Type:** `boolean | undefined`

**Description:** Whether to disable automatic resize handling on window resize events. When `true`, the view is not automatically resized when the window size changes.

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  disableAutoResize: true,
});
```

### debug

**Type:** `boolean | undefined`

**Description:** Whether to enable debug mode. When `true`, additional debug information such as performance statistics overlays is displayed.

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  debug: true,
});
```

### atmosphere

**Type:** `AtmosphereOptions | undefined`

**Description:** Configuration options for atmospheric rendering. Configures the sky, sun, and atmospheric scattering effects. Sun and moon positions are automatically calculated based on the date specified in the `date` property and reflected in related layers such as `SunLightLayer`.

```typescript
export type AtmosphereOptions = {
  atmosphereAssetsUrl?: string; // URL for atmosphere asset files
  stbnUrl?: string; // URL for STBN textures
  date?: Date; // Date and time used for sun/moon position calculations
};
```

**Example:**

```typescript
const view = new ThreeView({
  atmosphere: {
    atmosphereAssetsUrl: "/assets/atmosphere",
    date: new Date("2024-06-21T12:00:00"),
  },
});

// The date can be changed after initialization
await view.init();
view.atmosphere.date = new Date("2024-12-21T18:00:00");
```

:::tip[Related Documentation]
For details on the atmosphere system, see [Atmosphere Class](../../../three/api-reference/atmosphere/).
:::

### backgroundColor

**Type:** `Color | undefined`

**Description:** The background color of the scene. Specify an instance of the `Color` class.

**Default:** `0x0a0a0f` (dark blue-gray)

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  backgroundColor: new Color().setHex(0x1a1a2e),
});
```

:::note
A numeric value (hexadecimal color code) can also be passed directly in the constructor, but it is internally processed as a `Color` object.
:::

### picking

**Type:** `boolean | undefined`

**Description:** Configuration option for feature picking. When enabled, the `pick` event fires when a feature is clicked.

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  picking: true,
});

// Listen for pick events
view.on("pick", (info) => {
  if (info) {
    console.log("Selected feature:", info.properties);
  }
});
```

### animation

**Type:** `boolean | undefined`

**Description:** Whether to run the main loop every frame. When `true`, rendering occurs continuously. When `false`, rendering occurs only when changes are detected or `forceUpdate()` is called.

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  animation: true,
});
```

### multisampling

**Type:** `number | undefined`

**Description:** Number of MSAA (Multi-Sample Anti-Aliasing) samples. When 0, MSAA is disabled. Use with caution as it impacts performance.

**Default:** `0`

**Example:**

```typescript
const view = new ThreeView({
  multisampling: 4,
});
```

### halfFloat

**Type:** `boolean | undefined`

**Description:** Whether to use half-precision floating-point numbers (half-float) for post-processing. When `true`, rendering quality is improved.

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  halfFloat: true,
});
```

### logarithmicDepthBuffer

**Type:** `boolean | undefined`

**Description:** Whether to use a logarithmic depth buffer. When `true`, depth precision is improved at large scales. Some effects do not support this, so it should be set to `false` in such cases.

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  logarithmicDepthBuffer: true,
});
```

### shadow

**Type:** `boolean | undefined`

**Description:** Whether to enable shadow mapping. Must be specified at initialization and cannot be changed later.

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  shadow: true,
});
```

### selectiveEffects

**Type:** `{ debugViews?: boolean } | undefined`

**Description:** Configuration for selective post-processing effects (effects applied only to specific objects). Setting `debugViews` to `true` displays debug views of the selective effect masks.

**Default:** `{ debugViews: false }`

**Example:**

```typescript
const view = new ThreeView({
  selectiveEffects: { debugViews: true },
});
```

### mobileOptimization

**Type:** `boolean | undefined`

**Description:** Whether to enable optimizations for mobile devices. When `true`, settings suitable for mobile devices are applied, such as lower pixel ratios and lighter effects.

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  mobileOptimization: true,
});
```

### waterTexture

**Type:** `{ enabled: boolean; url?: string } | undefined`

**Description:** Configuration for shared water textures. When enabled, a single water normal texture is shared across all meshes that use water effects. This is more efficient than each mesh loading its own texture individually.

**Default:** `{ enabled: true }`

```typescript
type WaterTextureOptions = {
  enabled: boolean; // Whether to enable water texture sharing
  url?: string; // URL for custom water normal texture (uses built-in texture when omitted)
};
```

**Example:**

```typescript
// Use built-in texture
const view = new ThreeView({
  waterTexture: { enabled: true },
});

// Use a custom texture
const viewWithCustomWater = new ThreeView({
  waterTexture: {
    enabled: true,
    url: "https://example.com/water-normal.png",
  },
});
```

### GlobeOptions

**Type:** `GlobeOptions`

**Description:** Additional options related to globe display. ThreeView constructor options inherit from GlobeOptions.

```typescript
type GlobeOptions = {
  maxSse?: number; // Screen space error threshold for LOD calculations (initialization only)
  segments?: number; // Number of segments for mesh tessellation (initialization only)
  color?: Color; // Base color of the globe surface
  hideUnderground?: boolean; // Whether to hide underground geometry
  shouldComputeNormalFromVertex?: boolean; // Whether to compute normals from vertex positions (initialization only)
  transparent?: boolean; // Whether to make the material transparent
  opacity?: number; // Global material opacity (0.0-1.0)
  wireframe?: boolean; // Whether to render in wireframe mode
};
```

:::warning
Disabling `hideUnderground` may cause unexpected behavior with some effect layers.
:::

:::tip[Related Documentation]
For details and usage examples of each property, see [Globe Class](../../../three/api-reference/globe/).
:::

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  maxSse: 2,
  segments: 10,
  color: new Color().setHex(0x1a1a2e),
  hideUnderground: true,
  wireframe: false,
});
```
