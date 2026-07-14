---
name: navara-usage
description: >
  Best practices for building 3D map applications with Navara (@navara/three).
  Use whenever writing or reviewing code that uses ThreeView, sources/layers/materials,
  plugins, mesh/effect/light descriptors, feature evaluation, picking, or geodetic math —
  in application code, examples, or documentation code snippets.
---

# Using Navara (@navara/three)

Navara is a 3D globe map engine: a Rust/WASM GIS core driven from TypeScript, rendered with Three.js. The public API is `ThreeView` plus a declarative Source/Layer/Descriptor model.

## Packages

| Package | What it provides | When you need it |
|---|---|---|
| `@navara/three` | `ThreeView` (default export), `Color`, geodetic math utils, `MeshDesc`/`EffectDesc`/`LightDesc` base classes, handle types | Always |
| `@navara/three_default_plugin` | `DefaultPlugin`, `DefaultDescriptions` (registers ~40 built-in descriptors) | Almost always |
| `@navara/three_default_descs` | Individual descriptor classes/types (`BoxMeshDesc`, `SSREffectDesc`, `SunLightDesc`, …) | Typed `addMesh<T>`/`addEffect<T>` calls, or manual registration without DefaultPlugin |
| `@navara/three_plugins` | `AttributionPlugin`, `PersonViewPlugin`, `OverlayPlugin`, `CesiumIonPlugin` | Per feature |
| `@navara/three_api` | Standalone GIS math (no view) | Pure geometry computation |

Most apps need only the first two.

## The canonical setup order (invariant)

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const view = new ThreeView<DefaultDescriptions>({ shadow: true }); // 1. construct
const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);                                     // 2. add ALL plugins — before init, or it throws
await view.init();                                                 // 3. async init (WASM + workers + pipeline)
defaultPlugin.addDefaultPhotorealScene();                          // 4. optional photoreal sky/sun/AA bundle
view.setCamera({ lng: 139.77, lat: 35.68, height: 10000, heading: 0, pitch: -30, roll: 0 });
const src = view.addSource({ type: "raster-tile", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 18 });
view.addLayer({ type: "raster", source: src });                    // 5. sources/layers/effects after init
```

When `DefaultPlugin` is used, parameterize the view as `new ThreeView<DefaultDescriptions>` so descriptor keys are typed.

## Start from a recipe when building a scene

For "make it look good" goals, use the proven compositions in [references/recipes.md](references/recipes.md) (e.g. the photoreal base scene: DefaultPlugin + photoreal scene + Re:Earth quantized-mesh terrain + EOX satellite imagery + attribution) instead of assembling pieces from scratch.

## Four capability tiers — pick the lowest that solves the problem

1. **Declarative API** — add sources and layers with plain config objects. Covers basemaps, terrain, vector data, 3D Tiles. → [references/declarative-api.md](references/declarative-api.md)
2. **Low-level API** — per-feature evaluation (`FeatureEvaluator`), picking, terrain sampling, geodetic/ECEF math. → [references/low-level-api.md](references/low-level-api.md)
3. **Plugins** — reusable purpose-built features (photoreal scene, first-person walk, DOM overlays, attribution), and how to write your own. → [references/plugins.md](references/plugins.md)
4. **Custom descriptors** — your own meshes/effects/lights, with access to the render pipeline, depth buffer, and normal/G-buffer (MRT). → [references/custom-desc.md](references/custom-desc.md)

## Critical gotchas (apply everywhere)

- **`addPlugin()` after `init()` throws.** All plugin `init()`s run in parallel during `view.init()`.
- **Update semantics differ:** `Layer.update()` replaces the *whole* config; `Source.update()` and mesh/effect/light handle `.update()` are *partial merges* (omitted fields preserved).
- **Sources are reference-counted:** `source.delete()` returns `false` while any layer still references it. Updating a source resets and reloads every referencing layer.
- **Layer render order = add order** (e.g. add terrain before the raster basemap draped on it).
- **Never write to `view.camera.raw` frustum fields** (`fov` etc.) — the engine overwrites them and Rust-side culling desyncs. Use the `view.camera.fov/near/far` setters.
- **Units:** mesh `position` is ECEF meters; `sampleTerrainHeight`/`observeTerrainHeightAt` take **radians** (use `degreeToRadian`); batch IDs are 24-bit.
- **Init-only options** cannot change after `init()`: `shadow`, `maxSse`, `segments`, `useNormal`.
- **Effect compatibility:** `hideUnderground: false` and `logarithmicDepthBuffer` break some effect descriptors — test, and prefer defaults.
- `picking: true` (constructor, default on) is required for the `pick` event and pickable meshes.
- **API stability tiers:** `ThreeView` = Tier 0 (stable). `Plugin` + `ViewContext` = Tier 1 (may break between minor versions). Keep app code on Tier 0 where possible.

## Where to verify — never guess API details

**Primary reference: the docs site — https://navara-docs.netlify.app/** (Japanese under `/ja/`). Sections: `/three/` (core API: sources, layers, materials, camera, events), `/three_default_descs/` (every built-in mesh/effect/light Descriptor and its options), `/three_default_plugin/`, `/three_plugins/`.

- **Do not guess material or config property names** — this skill shows patterns, not exhaustive option lists. Verify exact fields against the docs site, or the TypeScript definitions in `node_modules/@navara/*` (`.d.ts`).
- Working inside the Navara repository? The docs source is `docs/src/content/docs/` and runnable examples are `web/navara_three/example/pages/` — reference paths in this skill starting with `example/pages/` refer to that examples directory.
