---
title: SplatMeshDesc
description: 3D Gaussian Splat mesh descriptor for navara_three.
sidebar:
  order: 116
---

The `SplatMeshDesc` class is a mesh descriptor that renders 3D Gaussian Splat assets (`.spz`, `.ply`, `.sog`, `.rad`, `.splat`, `.ksplat`).

It is registered as the `"splat"` mesh key by `DefaultPlugin`, so any `view.addMesh({ splat: { ... } })` call routes to this descriptor.

The splat renderer ([Spark](https://sparkjs.dev/)) is downloaded when a splat mesh is first added, not at page load. `addMesh` returns immediately; the splat appears once the renderer and the asset have loaded. A renderer load failure is reported through the `error` event.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `geodetic`, `visible`) are available. See [MeshDesc](../mesh-desc-base) for details.

## Properties

### url

**Type:** `string`

**Description:** URL of the splat file to load. Required. Provide either the URL of an externally hosted splat with a verified license, or a path to a self-hosted asset placed under your project's `public/splat/` directory (referenced as `/splat/your-asset.ply`).

On fetch failure, a `console.warn` is logged and the `error` event is emitted. No exception is thrown. Implement retry / fallback in the application if needed.

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

**Description:** Enable Level-of-Detail rendering to draw only the splats needed at the current camera distance. Works with any 3DGS asset at runtime. Pre-building the LoD tree at asset preparation time speeds up the initial load and avoids runtime tree construction.

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
    lod: true,
  }
}
```

### originCellSize

**Type:** `number`

**Default:** `2000`

**Description:** Cell edge, in meters, of the floating origin that keeps splats numerically stable at globe (ECEF) scale. Navara renders splats relative to an origin that follows the camera, snapped to a grid of this size, so the large ECEF coordinates never reach the renderer's single-precision math. This is what prevents sub-meter jitter as the camera moves. This is automatic. The property only tunes the grid. Smaller values tighten precision near the camera but re-sort splats more often as the camera crosses cells. Larger values re-sort less often. The value is shared per transparent scene: the first splat added fixes it for every splat on that renderer. Most applications never need to change the default.

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
    originCellSize: 500,
  }
}
```

> `url`, `lod`, and `originCellSize` are fixed at construction time. Calling `handle.update()` with a different value logs a warning. Recreate the descriptor instead.

## Events

### load

**Description:** Fired when the splat file has been fetched and parsed. Not fired on a failed load (the `error` event fires instead).

**Example:**

```typescript
splat.ref.on("load", () => {
  console.log("Splat loaded!");
});
```

### error

**Description:** Fired when fetching or parsing the splat file fails.

**Example:**

```typescript
splat.ref.on("error", (error) => {
  console.warn("Splat failed to load:", error);
});
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView from "@navaramap/three";
import type { SplatMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

const view = new ThreeView<DefaultDescriptions>();
view.addPlugin(new DefaultPlugin()); // registers "splat" → SplatMeshDesc
await view.init();

const splat = view.addMesh<SplatMeshDesc>({
  splat: {
    url: "/splat/your-asset.ply",
  },
  geodetic: { lng: 139.8107, lat: 35.71, height: 10, scale: 30 },
});
```

### Upside-down correction

Some captures are stored Y-down and appear upside-down in the scene. A 180° `pitch` in the `geodetic` placement flips them upright:

```typescript
view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  geodetic: { lng: 139.8107, lat: 35.71, pitch: 180 },
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

- **No scene lighting**: Lighting is baked into the splat data. `SunLight` / `AmbientLight` do not affect rendering.
- **No shadow / selective effect / picking**: Splats render in the transparent pass and are not integrated with shadows, `SelectiveBloomEffect` / `SelectiveOutlineEffect`, or Navara's picking pipeline.
- **Very large scale can look unstable**: A very large `scale` makes each splat span a large world region, so the depth sort order can change abruptly with small camera moves (visible as "boiling"). This is inherent to Gaussian Splatting and is unrelated to placement precision. Author assets close to their intended world size rather than scaling them up heavily.
