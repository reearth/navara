---
title: SplatMeshDesc
description: 3D Gaussian Splat mesh descriptor for navara_three (powered by SparkJS).
sidebar:
  order: 116
---

The `SplatMeshDesc` class is a Mesh Descriptor that renders 3D Gaussian Splat assets (`.spz`, `.ply`, `.splat`, `.ksplat`, `.pcsogs`) via [SparkJS](https://sparkjs.dev/). It is registered as the `"splat"` mesh key by `DefaultPlugin`, so any `view.addMesh({ splat: { ... } })` call routes to this Descriptor.

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

> `url` and `lod` are fixed at construction time. Calling `handle.update()` with a different value logs a warning; recreate the Descriptor instead.

## Notes

### Coordinate convention

Many publicly distributed splat assets are trained in **Y-down (image-space)** convention. When placed in a Y-up world they appear upside-down. A 180° rotation around the X axis (`quaternion.set(1, 0, 0, 0)` per SparkJS docs) corrects this. See the [`splat` example](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) for a flip + surface-normal alignment helper.

### Renderer sharing

`SplatMeshDesc` lazily creates a single `SparkRenderer` per transparent scene and shares it across all splat Descriptors via reference counting. The renderer lives in the transparent scene so splats render **after** atmosphere / aerial-perspective post-effects, preserving their baked color and edge crispness. `SparkRenderer.sparkOverride` (a process-wide static used by new `SplatMesh` instances to discover their renderer) is cleared to `undefined` on final release, and the next active view re-asserts it the next time a `SplatMeshDesc` is constructed.

The renderer's `enableLod` is fixed at creation time by the **first** `SplatMeshDesc` to acquire. Subsequent Descriptors with a different `lod` value log a warning and reuse the shared renderer; the per-mesh `lod` value passed to `new SplatMesh()` still applies, but the renderer's LoD driving capability is shared.

### ConcurrencyManager

Each `SplatMeshDesc` instance reserves one `ViewContext.concurrencyManager` slot on `createMesh()` (guarded by `canIncrement()`) and releases it on `onDestroy()`. This throttles concurrent splat / tile / model workloads so SparkJS's worker pool does not oversubscribe.

> Adding many splats may consume the entire pool capacity and serialize unrelated workloads. Consider load order if you mix splats with large tile loads.

### Limitations

- **No scene lighting**: Gaussian Splats encode lighting in the splat data; they do not respond to `SunLight`, `AmbientLight`, etc.
- **No shadow / selective effect**: Splats render in the transparent pass and do not write to the MRT effect-ids / normal buffer used by `SelectiveBloomEffect` and `SelectiveOutlineEffect`.
- **No picking**: `SplatMesh.raycastable` exists on the underlying SparkJS instance but is not integrated into Navara's picking pipeline.
- **Single view at a time**: SparkJS exposes `sparkOverride` as a process-wide static; truly concurrent rendering of multiple `ThreeView` instances on the same page is not supported.

## Related Resources

- [SparkJS documentation](https://sparkjs.dev/) — upstream renderer
- [SparkJS LoD guide](https://sparkjs.dev/docs/lod-getting-started/) — Level-of-Detail concepts
- [MeshDesc](./mesh-desc-base) — base class properties
