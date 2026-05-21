---
title: SplatMeshDesc
description: 3D Gaussian Splat mesh descriptor for navara_three.
sidebar:
  order: 116
---

The `SplatMeshDesc` class is a mesh descriptor that renders 3D Gaussian Splat assets (`.spz`, `.ply`, `.sog`, `.rad`, `.splat`, `.ksplat`).

It is registered as the `"splat"` mesh key by `DefaultPlugin`, so any `view.addMesh({ splat: { ... } })` call routes to this descriptor.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### url

**Type:** `string`

**Description:** URL of the splat file to load. Required. Provide either the URL of an externally hosted splat with a verified license, or a path to a self-hosted asset placed under your project's `public/splat/` directory (referenced as `/splat/your-asset.ply`).

On fetch failure, a `console.warn` is logged; no exception is thrown and no event is emitted. Implement retry / fallback in the application if needed.

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

**Description:** Enable Level-of-Detail rendering to draw only the splats needed at the current camera distance. Works with any 3DGS asset at runtime; pre-building the LoD tree at asset preparation time speeds up the initial load and avoids runtime tree construction.

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

If a splat is trained in **Y-down (image-space)** convention, it will appear upside-down in a Y-up world. In that case, apply a 180° rotation around the X axis to correct:

```typescript
view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: Math.PI, y: 0, z: 0 },
});
```

## Supported Specifications

Navara supports the following Gaussian Splatting formats.

### File formats

| File format | Description |
| ----------- | ----------- |
| `.spz` | Niantic SPZ format |
| `.ply` | Plain Gaussian Splatting data |
| `.sog` | PlayCanvas Scene Optimized Gaussians |
| `.rad` | Pre-built LoD asset (output of `build-lod`) |
| `.splat` | antimatter15 splat format |
| `.ksplat` | mkkellogg GaussianSplats3D format |

:::note
- spz v4 (NGSP) is not yet supported. Files from Niantic's v4 web converter fail to load. Build [`nianticlabs/spz`](https://github.com/nianticlabs/spz) locally with `PackOptions.version = 3` to produce a compatible file.
:::

## Limitations

- **No scene lighting**: Lighting is baked into the splat data; `SunLight` / `AmbientLight` do not affect rendering.
- **No shadow / selective effect / picking**: Splats render in the transparent pass and are not integrated with shadows, `SelectiveBloomEffect` / `SelectiveOutlineEffect`, or Navara's picking pipeline.
