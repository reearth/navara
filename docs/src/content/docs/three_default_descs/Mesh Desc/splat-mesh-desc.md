---
title: SplatMeshDesc
description: 3D Gaussian Splat mesh descriptor for navara_three (powered by SparkJS).
sidebar:
  order: 116
---

The `SplatMeshDesc` class is a mesh descriptor that renders 3D Gaussian Splat assets (`.spz`, `.ply`, `.splat`, `.ksplat`, `.pcsogs`) via [SparkJS](https://sparkjs.dev/).

It is registered as the `"splat"` mesh key by `DefaultPlugin`, so any `view.addMesh({ splat: { ... } })` call routes to this descriptor.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### url

**Type:** `string`

**Description:** URL of the splat file to load. Required. Provide either the URL of an externally hosted splat with a verified license, or a path to a self-hosted asset placed under your project's `public/splat/` directory (referenced as `/splat/your-asset.ply`).

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
  }
}
```

### lod

**Type:** `boolean`

**Default:** `false`

**Description:** Enable [SparkJS Level-of-Detail](https://sparkjs.dev/docs/lod-getting-started/). Requires assets with a pre-built LoD tree (e.g. via `spark-cli ... --quality`); raw PLY exports may render with artifacts. See Limitations.

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
    lod: true,
  }
}
```

> `url` and `lod` are fixed at construction time. Calling `handle.update()` with a different value logs a warning; recreate the descriptor instead.

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { geodeticToVector3, degreeToRadian } from "@navara/three";
import type { SplatMeshDesc } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";

const view = new ThreeView<DefaultDescriptions>();
view.addPlugin(new DefaultPlugin()); // registers "splat" → SplatMeshDesc
await view.init();

const pos = geodeticToVector3({
  lat: degreeToRadian(35.7100),
  lng: degreeToRadian(139.8107),
  height: 10,
});

const splat = view.addMesh<SplatMeshDesc>({
  splat: {
    url: "/splat/your-asset.ply",
  },
  position: { x: pos.x, y: pos.y, z: pos.z },
  scale: { x: 30, y: 30, z: 30 },
});
```

### Y-down Asset Correction

Many publicly distributed splat assets are trained in **Y-down (image-space)** convention and appear upside-down in a Y-up world. Apply a 180° rotation around the X axis to correct:

```typescript
view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: Math.PI, y: 0, z: 0 },
});
```

For placing a splat on the globe, combine this with `northUpEastToFixedFrame(pos)` passed as `matrixWorld` so the local up axis follows the surface normal. See the [splat example](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) for a working setup.

## Limitations

- **Load failures are silent**: A failed fetch for the splat URL only logs a `console.warn`; no error is thrown, and the descriptor stays alive. Implement retry / fallback in the application if needed.
- **Visual flicker with `lod: true`**: Splats placed at globe-scale may show small flickers even at a fixed camera. Use `lod: false` (default) for stable rendering, or pre-build LoD trees at asset preparation time.
- **No scene lighting**: Lighting is baked into the splat data; `SunLight` / `AmbientLight` do not affect rendering.
- **No shadow / selective effect**: Splats are excluded from `SelectiveBloomEffect` and `SelectiveOutlineEffect`.
- **No picking**: Splats are not integrated into Navara's picking pipeline.
- **Single view at a time**: Multiple concurrent `ThreeView` instances rendering splats on the same page are not supported.
- **spz v4 (NGSP) is not yet supported**: Use spz v3 or earlier. Files from Niantic's v4 web converter fail to load. Build [`nianticlabs/spz`](https://github.com/nianticlabs/spz) locally and pass `PackOptions.version = 3` to produce a compatible file.
- **`three` peer-range mismatch**: Install emits an `unmet peer` warning because the SparkJS package targets an older `three` range than this workspace; runtime is unaffected.
