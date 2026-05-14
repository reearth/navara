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

**Description:** URL of the splat file to load. Required.

**Example:**

```typescript
{
  splat: {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
  }
}
```

### lod

**Type:** `boolean`

**Default:** `false`

**Description:** Enable [SparkJS Level-of-Detail](https://sparkjs.dev/docs/lod-getting-started/). When `true`, an in-memory LoD tree is built and splats are picked per frame.

**Example:**

```typescript
{
  splat: {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
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
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    lod: true,
  },
  position: { x: pos.x, y: pos.y, z: pos.z },
  scale: { x: 30, y: 30, z: 30 },
});
```

### Y-down Asset Correction

Many publicly distributed splat assets are trained in **Y-down (image-space)** convention and appear upside-down in a Y-up world. Apply a 180° rotation around the X axis to correct:

```typescript
import { Vector3, Quaternion, Euler } from "three";

const flip = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
const euler = new Euler().setFromQuaternion(flip);

view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});
```

See the [splat example](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) for a complete flip + surface-normal alignment helper.

## Technical Details

`SplatMeshDesc` is an adapter around [SparkJS](https://sparkjs.dev/) and provides the following:

- **Shared `SparkRenderer`**: Lazily created once per transparent scene and reference-counted; the last descriptor to release disposes the renderer. The renderer lives in the transparent scene so splats render after atmosphere / aerial-perspective post-effects, preserving their baked color.
- **`sparkOverride`**: SparkJS's process-wide static (used by new `SplatMesh` instances to discover their renderer) is cleared on final release and re-asserted on the next acquire to keep sequential / LIFO use of multiple views safe.
- **`enableLod`**: Fixed at first acquire. If the first descriptor was created with `lod: false`, subsequent descriptors that request `lod: true` are downgraded to `lod: false` (a `console.warn` is logged) because building a per-mesh LoD tree without a LoD-driving renderer would waste memory. The reverse (`lod: false` on a LoD-capable renderer) incurs no downgrade.
- **`ConcurrencyManager` slot**: One slot reserved per descriptor while its async splat load is in flight, released as soon as `mesh.initialized` settles (success or failure). `onDestroy()` only performs fallback cleanup for a still-held reservation. Reservation is **best-effort**: if the pool is already saturated, `canIncrement()` returns false and the splat load proceeds without a reserved slot (to preserve `decrement` symmetry); the load is not blocked or queued.

## Limitations

- **Periodic visual snaps at globe-scale**: SparkJS's two async workers (sort + LoD) continuously push state updates while `autoUpdate: true` (the default required for interactive rendering), producing 10–60% pixel snaps every 0.5–2s even at fixed camera. SparkJS's [System Design](https://sparkjs.dev/docs/system-design/) acknowledges that "the sort order lags the render by at least one frame, but possibly more on older devices" while claiming it is "not usually perceptible" — globe-scale viewing makes it perceptible. The following `SparkRenderer` flags were each tested and did **not** meaningfully reduce snap frequency in our measurements: `minSortIntervalMs: 500/1000`, `enableLodFetching: false`, `lodSplatScale: 0.25/0.5` (the [official LoD docs](https://sparkjs.dev/docs/lod-getting-started/) recommend lowering the latter at the cost of detail). Pre-building LoD trees with the `spark-cli ... --quality` flag at asset preparation time may help. Snaps appear inherent to SparkJS 2.0's new LoD architecture.
- **No scene lighting**: Gaussian Splats encode lighting in the splat data; they do not respond to `SunLight`, `AmbientLight`, etc.
- **No shadow / selective effect**: Splats render in the transparent pass and do not write to the MRT effect-ids / normal buffer used by `SelectiveBloomEffect` and `SelectiveOutlineEffect`.
- **No picking**: `SplatMesh.raycastable` exists on the underlying SparkJS instance but is not integrated into Navara's picking pipeline.
- **Single view at a time**: SparkJS exposes `sparkOverride` as a process-wide static; truly concurrent rendering of multiple `ThreeView` instances on the same page is not supported.
- **SparkJS peer dependency**: `@sparkjsdev/spark@2.0.0` declares `three: ^0.180.0` while this workspace pins `three@0.184.0`. pnpm emits an unmet-peer warning at install but installation succeeds and no runtime incompatibility was observed. A widened peer range from upstream is expected.
