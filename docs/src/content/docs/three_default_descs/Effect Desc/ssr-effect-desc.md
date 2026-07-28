---
title: SSREffectDesc
description: SSR effect descriptor for navara_three
sidebar:
  order: 60
---

The `SSREffectDesc` class is a Descriptor that generates screen-space reflection (SSR) effects. It calculates reflections of on-screen objects in real-time, expressing reflections on water surfaces and glossy surfaces.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### geometryBuffer

**Type:** `Texture | null | undefined`

**Description:** A custom geometry buffer used for reflection calculations. When unset or `null`, the engine's MRT normal buffer is used, so SSR applies wherever materials write reflectivity (e.g. `water: true` polygons). Supplying your own screen-aligned texture gives the application full control over where SSR applies — for example, dynamically drawn puddles.

Each texel must follow the engine's G-buffer encoding:

- `.xy` — octahedral-packed **view-space** normal (`packNormalToVec2` from `@takram/three-geospatial/shaders` `packing`)
- `.z` — reflectivity/metalness mask; SSR is skipped where the value is below `0.01`. The ray-tracing shader also uses `.z` as its roughness base value
- `.w` — roughness; with cone tracing enabled (the default) it drives the blur cone angle, and with cone tracing disabled it multiplies `.z` to form the GGX ray-jitter roughness (`.z * .w`)

The texture is sampled by normalized screen UV, so it should match the drawing-buffer size (use `HalfFloatType`; packed normal values are signed). Keeping it sized correctly on resize is the application's responsibility. Updating the *contents* of the texture (render-to-texture every frame) takes effect automatically; only swapping the texture *object* requires an `update()` call. Setting the option back to `null` resets SSR to the MRT normal buffer:

```typescript
ssrDesc.update({ ssr: { geometryBuffer: null } });
```

To composite over the scene's own normals, read the MRT normal buffer through the SSR descriptor handle:

```typescript
import { type MRTPassEffectDesc } from "@navaramap/three";

const mrtPass = ssrDesc.ref.find<MRTPassEffectDesc>("mrt");
const sceneNormals = mrtPass?.normalBuffer; // Texture | undefined
```

**Default:** `null` (the engine's MRT normal buffer)

**Example:**

```typescript
{
  ssr: {
    geometryBuffer: myRenderTarget.texture,
  }
}
```

A full working example that draws animated puddles into a custom geometry buffer is available at `example/pages/ssr-puddle/` in the Navara repository.

### resolutionScale

**Type:** `number | undefined`

**Description:** Specifies the SSR rendering resolution scale factor. Range is 0-1, with lower values improving performance.

**Default:** `0.5`

**Example:**

```typescript
{
  ssr: {
    resolutionScale: 0.75,
  }
}
```

### iterations

**Type:** `number | undefined`

**Description:** Specifies the maximum number of ray marching iterations to find reflection intersections.

**Default:** `100`

**Example:**

```typescript
{
  ssr: {
    iterations: 150,
  }
}
```

### binarySearchIterations

**Type:** `number | undefined`

**Description:** Specifies the number of binary search refinement steps to improve reflection accuracy.

**Default:** `4`

**Example:**

```typescript
{
  ssr: {
    binarySearchIterations: 6,
  }
}
```

### pixelZSize

**Type:** `number | undefined`

**Description:** Specifies the depth buffer precision threshold for pixel rejection.

**Default:** `100`

**Example:**

```typescript
{
  ssr: {
    pixelZSize: 150,
  }
}
```

### pixelStride

**Type:** `number | undefined`

**Description:** Specifies the ray marching step size in pixels along screen space.

**Default:** `5`

**Example:**

```typescript
{
  ssr: {
    pixelStride: 8,
  }
}
```

### pixelStrideZCutoff

**Type:** `number | undefined`

**Description:** Specifies the depth cutoff value for reducing pixel stride in distant areas.

**Default:** `500`

**Example:**

```typescript
{
  ssr: {
    pixelStrideZCutoff: 750,
  }
}
```

### maxRayDistance

**Type:** `number | undefined`

**Description:** Specifies the maximum distance a reflection ray can travel in world units.

**Default:** `5000`

**Example:**

```typescript
{
  ssr: {
    maxRayDistance: 10000,
  }
}
```

### screenEdgeFadeStart

**Type:** `number | undefined`

**Description:** Specifies the screen position (0-1) where edge fade begins to hide artifacts.

**Default:** `0.75`

**Example:**

```typescript
{
  ssr: {
    screenEdgeFadeStart: 0.8,
  }
}
```

### eyeFadeStart

**Type:** `number | undefined`

**Description:** Specifies the start angle (in radians) for fading reflections based on view angle.

**Default:** `0`

**Example:**

```typescript
{
  ssr: {
    eyeFadeStart: 0.1,
  }
}
```

### eyeFadeEnd

**Type:** `number | undefined`

**Description:** Specifies the end angle (in radians) for fading reflections based on view angle.

**Default:** `1`

**Example:**

```typescript
{
  ssr: {
    eyeFadeEnd: 1.2,
  }
}
```

### jitter

**Type:** `number | undefined`

**Description:** Specifies the amount of random jitter to reduce artifacts.

**Default:** `1`

**Example:**

```typescript
{
  ssr: {
    jitter: 0.5,
  }
}
```

### blendMode

**Type:** `BlendMode | undefined`

**Description:** Specifies the blend mode for compositing reflections with the original scene.

**Default:** `"normal"`

:::note[Can only be set at initialization]
This property can only be set when creating the Descriptor. It cannot be changed via the `update()` method.
:::

**Valid values:** `"normal"`, `"add"`, `"multiply"`, `"screen"`, `"overlay"`, etc. (see ColorGradingLUTEffectDesc blendMode)

**Example:**

```typescript
{
  ssr: {
    blendMode: "add",
  }
}
```

### kernelSize

**Type:** `number | undefined`

**Description:** Specifies the kernel size for the Gaussian blur used in cone tracing.

**Default:** `5`

:::note[Can only be set at initialization]
This property can only be set when creating the Descriptor. It cannot be changed via the `update()` method.
:::

**Example:**

```typescript
{
  ssr: {
    kernelSize: 9,
  }
}
```

### useConeTracing

**Type:** `boolean | undefined`

**Description:** Enables cone tracing to improve visual quality. May be computationally expensive.

**Default:** `true`

**Example:**

```typescript
{
  ssr: {
    useConeTracing: false,
  }
}
```

### coneTracingFadeStart

**Type:** `number | undefined`

**Description:** Specifies the ratio at which reflection fading begins.

**Default:** `0.9`

**Example:**

```typescript
{
  ssr: {
    coneTracingFadeStart: 0.5,
  }
}
```

### coneTracingFadeEnd

**Type:** `number | undefined`

**Description:** Specifies the ratio at which reflection fading ends.

**Default:** `1.0`

**Example:**

```typescript
{
  ssr: {
    coneTracingFadeEnd: 1.0,
  }
}
```

### coneTracingMaxDistance

**Type:** `number | undefined`

**Description:** Specifies the maximum distance at which reflections are visible.

**Default:** `500.0`

**Example:**

```typescript
{
  ssr: {
    coneTracingMaxDistance: 3000,
  }
}
```

### coneTracingIteration

**Type:** `number | undefined`

**Description:** Specifies the number of iterations for accumulating cone tracing.

**Default:** `14`

**Example:**

```typescript
{
  ssr: {
    coneTracingIteration: 8,
  }
}
```

### coneTracingIor

**Type:** `number | undefined`

**Description:** Specifies the Index of Refraction (IOR) for cone tracing. Typical values range from 1.0 to 2.0.

**Default:** `1.5`

**Example:**

```typescript
{
  ssr: {
    coneTracingIor: 1.5,
  }
}
```

## Usage Examples

### Adding a basic SSR effect

```typescript
import ThreeView from "@navaramap/three";
import { SSREffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// Add SSR effect descriptor
const ssrDesc = view.addEffect<SSREffectDesc>({
  ssr: {},
});
```

### SSR for water surface reflections

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { SSREffectDesc } from "@navaramap/three-default-descs";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects
plugin.addDefaultPhotorealScene();

// Add SSR effect
const ssrDesc = view.addEffect<SSREffectDesc>({
  ssr: {
    resolutionScale: 0.5,
    iterations: 100,
    binarySearchIterations: 4,
    maxRayDistance: 5000,
  },
});

// Add water surface polygon
const waterSource = view.addSource({
  type: "geojson",
  data: {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.64, 35.77],
          [139.64, 35.61],
          [139.90, 35.61],
          [139.90, 35.77],
          [139.64, 35.77],
        ],
      ],
    },
  },
});

view.addLayer({
  type: "vector",
  source: waterSource,
  polygon: {
    color: new Color().setHex(0x001e0f),
    reflectivity: 0.02,
    roughness: 0.2,
    water: true,
    specular: true,
  },
});
```

### Performance-oriented SSR settings

```typescript
import ThreeView from "@navaramap/three";
import { SSREffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// Performance-oriented settings
const ssrDesc = view.addEffect<SSREffectDesc>({
  ssr: {
    resolutionScale: 0.25, // Lower resolution for improved performance
    iterations: 50,        // Reduce iteration count
    useConeTracing: false, // Disable cone tracing
  },
});
```

### High-quality SSR with cone tracing

```typescript
import ThreeView from "@navaramap/three";
import { SSREffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// High-quality settings
const ssrDesc = view.addEffect<SSREffectDesc>({
  ssr: {
    resolutionScale: 1.0,
    iterations: 150,
    binarySearchIterations: 6,
    useConeTracing: true,
    coneTracingIteration: 8,
    jitter: 1,
  },
});
```

## Notes

This provides high-quality reflection effects but has a high performance cost. Adjust the resolution scale and iteration count as needed. It is most effective when used in combination with water surfaces and glossy surfaces.
