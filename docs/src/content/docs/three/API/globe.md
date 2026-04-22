---
title: Globe Class
description: API Reference for Globe Class - a class for managing globe display settings
sidebar:
  order: 21
---

The Globe class provides an interface for accessing and modifying properties related to globe display. It manages globe display settings shared across different material types such as VectorTile, RasterTile, and RasterTerrain.

## How to Access

The Globe instance is accessed through the `globe` property of ThreeView.

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView();

await view.init();

// Access the Globe instance
const globe = view.globe;

// Modify properties
globe.wireframe = true;
globe.opacity = 0.8;
```

## Properties

### maxSse

**Type:** `number`

**Description:** Screen space error threshold for LOD (Level of Detail) calculations. Smaller values load more detailed tiles.

**Default:** `2.0`

:::warning
This property is only effective at initialization time. Set it in the ThreeView constructor.
:::

**Example:**

```typescript
// Set in the constructor
const view = new ThreeView({
  maxSse: 1.5,
});

// Get the current value
console.log(view.globe.maxSse);
```

---

### segments

**Type:** `number`

**Description:** Number of segments for mesh tessellation. Larger values produce a smoother globe surface but have a performance impact.

**Default:** `64`

:::warning
This property is only effective at initialization time. Set it in the ThreeView constructor.
:::

**Example:**

```typescript
// Set in the constructor
const view = new ThreeView({
  segments: 32,
});

// Get the current value
console.log(view.globe.segments);
```

---

### color

**Type:** `Color | undefined`

**Description:** The base color of the globe surface. Sets the color displayed before tiles are loaded or in areas without tiles.

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView();

await view.init();

// Set the color
view.globe.color = new Color().setHex(0x1a1a2e);

// Set from a CSS color string
view.globe.color = new Color().setStyle("#2d3436");
```

---

### hideUnderground

**Type:** `boolean`

**Description:** Whether to hide underground geometry. Controls the display when the camera goes below the globe surface.

**Default:** `true`

:::warning
Disabling this value may cause unexpected behavior when using effect descriptors.
:::

**Example:**

```typescript
// Enable underground display (e.g., for underground model visualization)
view.globe.hideUnderground = false;

// Disable underground display (default)
view.globe.hideUnderground = true;
```

---

### shouldComputeNormalFromVertex

**Type:** `boolean`

**Description:** Whether to compute normals from vertex positions. Affects lighting calculations.

**Default:** `true`

:::warning
This property is only effective at initialization time. Set it in the ThreeView constructor.
:::

**Example:**

```typescript
// Set in the constructor
const view = new ThreeView({
  shouldComputeNormalFromVertex: true,
});
```

---

### transparent

**Type:** `boolean`

**Description:** Whether to make the material transparent. When set to `true`, transparency can be adjusted using the `opacity` property.

**Default:** `false`

:::note
Blending only works with resource layers.
:::

**Example:**

```typescript
// Enable transparency
view.globe.transparent = true;
view.globe.opacity = 0.7;
```

---

### opacity

**Type:** `number`

**Description:** Global material opacity (0.0-1.0). Only takes effect when `transparent` is `true`.

**Default:** `1.0`

**Example:**

```typescript
// Set to semi-transparent
view.globe.transparent = true;
view.globe.opacity = 0.5;

// Restore to fully opaque
view.globe.opacity = 1.0;
```

---

### wireframe

**Type:** `boolean`

**Description:** Whether to render the material in wireframe mode. Used for debugging and visualization purposes.

**Default:** `false`

**Example:**

```typescript
// Enable wireframe mode
view.globe.wireframe = true;

// Disable wireframe mode
view.globe.wireframe = false;
```

---

### elevationColormap

**Type:** `ColorMap | undefined`

**Description:** Color map lookup table for elevation heatmap rendering. Used in combination with the `elevationHeatmap` layer to achieve color-coded display based on elevation.

**Example:**

```typescript
import ThreeView, { ColorMap, Color } from "@navara/three";

const view = new ThreeView();

await view.init();

// ref: https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=9
const ylGnBuColorMap = new ColorMap("sequential", "YlGnBu", [
  new Color().setStyle("#ffffd9"),
  new Color().setStyle("#edf8b1"),
  new Color().setStyle("#c7e9b4"),
  new Color().setStyle("#7fcdbb"),
  new Color().setStyle("#41b6c4"),
  new Color().setStyle("#1d91c0"),
  new Color().setStyle("#225ea8"),
  new Color().setStyle("#253494"),
  new Color().setStyle("#081d58"),
]);

view.globe.elevationColormap = ylGnBuColorMap;
```

:::tip[Related Documentation]
For details on the ColorMap class (methods, properties, color map patterns), see [ColorMap Class](../../../three/api-reference/colormap/).
:::

## Elevation Heatmap Usage Example

To display an elevation heatmap, use `elevationColormap` in combination with the `elevationHeatmap` layer.

```typescript
import ThreeView, {
  ColorMap,
  Color,
  TERRARIUM_ELEVATION_DECODER,
} from "@navara/three";

const view = new ThreeView({
  animation: true,
});

await view.init();

// ref: https://colorbrewer2.org/#type=diverging&scheme=RdYlGn&n=11
const rdYlGnColorMap = new ColorMap("diverging", "RdYlGn", [
  new Color().setStyle("#006837"),
  new Color().setStyle("#1a9850"),
  new Color().setStyle("#66bd63"),
  new Color().setStyle("#a6d96a"),
  new Color().setStyle("#d9ef8b"),
  new Color().setStyle("#ffffbf"),
  new Color().setStyle("#fee08b"),
  new Color().setStyle("#fdae61"),
  new Color().setStyle("#f46d43"),
  new Color().setStyle("#d73027"),
  new Color().setStyle("#a50026"),
]);

view.globe.elevationColormap = rdYlGnColorMap;
view.globe.color = new Color().setStyle("#1a9850");

// Add terrain layer
view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/terrain/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 12,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  },
});

// Add elevation heatmap layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/terrain/{z}/{x}/{y}.png",
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

view.setCamera({
  lng: 138.5,
  lat: 34,
  height: 100000,
  heading: 0,
  pitch: -30,
  roll: 0,
});
```

## Setting Initialization-Time Properties

Some properties can only be set at initialization time. These are specified in the ThreeView constructor options.

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  // Properties that can only be set at initialization
  maxSse: 2,
  segments: 64,
  shouldComputeNormalFromVertex: true,
  // Properties that can be changed at runtime
  color: new Color().setHex(0x1a1a2e),
  hideUnderground: true,
  transparent: false,
  opacity: 1.0,
  wireframe: false,
});

await view.init();

// After initialization, only runtime properties can be changed
view.globe.wireframe = true;
view.globe.opacity = 0.8;
```

## See Also

- [Color Class](../../../three/api-reference/color/) - A class for representing colors
- [ColorMap Class](../../../three/api-reference/colormap/) - Defining color gradients
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - Elevation heatmap material
- [ThreeView Class](../../../three/api-reference/threeview-class/) - Main view class
