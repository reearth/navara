---
name: navara-usage
description: >
  Best practices for building 3D map applications with Navara (@navaramap/three).
  Use whenever writing or reviewing code that uses ThreeView, sources/layers/materials,
  plugins, mesh/effect/light descriptors, feature evaluation, picking, or geodetic math —
  in application code, examples, or documentation code snippets.
---

# Using Navara (@navaramap/three)

Navara is a 3D globe map engine: reusable GIS logic lives in a Rust/WASM core, and drawing is delegated to a swappable CG-rendering library. `@navaramap/three` is the Three.js-based binding (currently the only one; more rendering engines are planned — avoid wording that fixes Navara to Three.js in prose). Its public API is `ThreeView` plus a declarative Source/Layer/Descriptor model.

## Packages

| Package                           | What it provides                                                                                                                                                                        | When you need it                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@navaramap/three`                | `ThreeView` (default export), `Color`, geodetic math utils, `MeshDesc`/`EffectDesc`/`LightDesc` base classes, handle types, built-in attribution UI (`view.attribution`, on by default) | Always                                                                                |
| `@navaramap/three-default-plugin` | `DefaultPlugin`, `DefaultDescriptions` (registers ~40 built-in descriptors)                                                                                                             | Almost always                                                                         |
| `@navaramap/three-default-descs`  | Individual descriptor classes/types (`BoxMeshDesc`, `SSREffectDesc`, `SunLightDesc`, …)                                                                                                 | Typed `addMesh<T>`/`addEffect<T>` calls, or manual registration without DefaultPlugin |
| `@navaramap/three-plugins`        | `PersonViewPlugin`, `OverlayPlugin`, `CesiumIonPlugin`, `TileJsonPlugin`                                                                                                                | Per feature                                                                           |
| `@navaramap/three-api`            | Standalone GIS math (no view)                                                                                                                                                           | Pure geometry computation                                                             |

Most apps need only the first two.

## The canonical setup order (invariant)

```typescript
import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

const view = new ThreeView<DefaultDescriptions>({ shadow: true }); // 1. construct
const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin); // 2. add ALL plugins — before init, or it throws
await view.init(); // 3. async init (WASM + workers + pipeline)
defaultPlugin.addDefaultPhotorealScene(); // 4. optional photoreal sky/sun/AA bundle
view.setCamera({
  lng: 139.77,
  lat: 35.68,
  height: 10000,
  heading: 0,
  pitch: -30,
  roll: 0,
});
const src = view.addSource({
  type: "raster-tile",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: src }); // 5. sources/layers/effects after init
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
- **Updates are partial merges:** `Layer.update()`, `Source.update()` and mesh/effect/light handle `.update()` all merge into the current config — omitted materials and omitted fields within a material are preserved (verified: `layer.update({ point: { color } })` keeps `size`/`clampToGround`). Note: `Layer.update()`'s JSDoc says "the entire configuration is replaced" — that text is outdated; trust the merge behavior shown in its own `@example`.
- **Sources are reference-counted:** `source.delete()` returns `false` while any layer still references it. Updating a source resets and reloads every referencing layer.
- **Layer render order = add order** (e.g. add terrain before the raster basemap draped on it).
- **`elevationHeatmap`: omitting `logBoundary` breaks software-GL backends.** `Math.log(mat.logBoundary)` (navara_three `mesh/tile/index.ts`) turns the missing value into a NaN uniform, and the branch-free ternary in `elevation_pars_fragment.glsl` evaluates the log path even with `logarithmic` false. ANGLE Metal flushes the NaN (renders fine); SwiftShader — i.e. headless Playwright, the screenshot pipeline, CI — propagates it and every pixel renders one constant color (verified 2026-07 on both backends with identical code). Until the engine guards that computation, pass `logBoundary` explicitly when headless captures matter. The material itself is unlit and needs no terrain layer or lights; `globe.elevationColormap` supplies the colors.
- **Deferred lighting recipe:** set `view.lit = false` so materials output albedo while the lit pipeline keeps writing normals and the shadow buffer, then re-light in a late post pass from `getNormalTexture()` + `getShadowTexture()`. A per-mesh/material `lit: true` opts something out, and the shadow buffer's G channel is the per-pixel mask for it — transparent unlit materials cannot be masked this way (they are already blended into the albedo). Toggling `lit` recompiles, so it is a config switch, not a per-frame control. Worked effect: `example/pages/debug/buffers/run.ts`; option semantics: docs `three/api/threeview-properties#lit`.
- **`aerialPerspective.irradiance: true` IS a deferred lighting pass — always pair it with `view.lit = false`.** It sets `sunLight`/`skyLight` on the `AerialPerspectiveEffect`, which re-lights the G-buffer from the precomputed atmosphere using the normal buffer. With `view.lit` left at its default `true` the scene is lit twice (forward + atmosphere) and washes out, which is what forces the unnaturally high exposures (10+) seen in older snippets; unlit + irradiance sits around 3. Verified 2026-08: the deferred pass does **not** consume the shadow G-buffer, so `sun.castShadow` cascaded shadows vanish under `lit = false` (cloud shadows survive — the effect samples those from `atmosphere.shadow`). Close-up scenes that need cast shadows or transparency keep `irradiance: false` and the default `lit`.
- **`SnowMeshDesc` / `RainMeshDesc` `maxHeight` is an opacity fade, not a spawn ceiling.** Every frame the material opacity is multiplied by `max(1 - cameraHeight / maxHeight, 0)`, so with the default `maxHeight: 3000` a camera at or above 3 km renders *zero* visible snow while everything still runs — a silent empty screenshot. Particles also spawn in an `areaWidth` x `areaHeight` box around the camera and `size` is world-space (`sizeAttenuation`), so flakes only read at their nominal size when the camera is inside the weather, not looking at it from above.
- **`sun.shadowFar` defaults to 50 km**, spreading the 4 cascades so wide that person- or car-scale shadows never resolve. For character/street-level scenes use `shadowFar: ~1000` with `shadowLambda: 1` (fully logarithmic split) — that is what makes a walking character cast a visible shadow (`example/pages/examples/plugin/person-view`).
- **Never reconstruct a G-buffer normal with `xy * 2 - 1`** — it is octahedral; decode with `unpackVec2ToNormal` from `NORMAL_PACKING_SHADER`. The wrong reconstruction looks plausible and costs a long debugging session. Known inconsistency to watch for: `instancedSprite.frag.glsl` / `sdfText.frag.glsl` define a LOCAL `xy*0.5+0.5` packer that does not match.
- **Allocating any optional G-buffer silently re-routes meshes into the MRT pass** (so their own normal/shadow/mask is written instead of the terrain's showing through). Expect the first `addEffect` that needs a buffer to recompile and to shift where meshes render. Self-shadow acne (striping) on large mesh faces in the shadow buffer is tamed with `sun: { shadowNormalBias: ~3 }`.
- **A custom effect should inherit scene config, not re-declare it** — `ctx.findLight("sun")` / `findEffect` / `findMesh` resolve active descs by registered key, so a lighting effect reads the sun's real intensity and `view.atmosphere.sunDirection` instead of growing its own options.
- **Toggling terrain on/off: delete/re-add the layer.** `terrainLayer.update({ terrain: { show: false } })` has no visible effect (verified 2026-07); `layer.delete()` drops the surface to the flat ellipsoid and draped raster layers re-drape automatically.
- **Handle events vs desc events:** mesh/light/effect handles (`BaseHandle`) only emit `deleted` — desc-specific events (`load` / `error` / `animationReady` on GLTF, instanced-GLTF and splat descs) live on the desc, so subscribe via `handle.ref.on("load", ...)`.
- **Never write to `view.camera.raw` frustum fields** (`fov` etc.) — the engine overwrites them and Rust-side culling desyncs. Use the `view.camera.fov/near/far` setters.
- **Units:** mesh `position` is ECEF meters; `sampleTerrainHeight`/`observeTerrainHeightAt`/`sampleTerrainMostDetailed` take **radians** (use `degreeToRadian`); batch IDs are 24-bit.
- **Ground placement needs `sampleTerrainMostDetailed`:** the synchronous `sampleTerrainHeight` reads only render-resident tiles, so from a distant camera it returns a coarse-LOD height (tens of meters off) — `await view.sampleTerrainMostDetailed(source, positions)` (source = the registered terrain source's handle or id, always explicit) fetches the source's max-LOD tiles regardless of the camera. See [references/low-level-api.md](references/low-level-api.md).
- **Mesh placement is Cartesian (ECEF) by default:** raw `position`/`rotation`/`scale` are earth-centered ECEF meters, so a bare `position` won't sit upright at a lng/lat. For geographic placement set `matrixWorld` to a tangent-frame matrix — then `position`/`rotation`/`scale` become offsets _within_ that frame. Pick the frame function whose axis orientation you want (all exported from `@navaramap/three`): `eastNorthUpToFixedFrame` (ENU), `northEastDownToFixedFrame` (NED), `northUpEastToFixedFrame` (NUE), `northWestUpToFixedFrame` (NWU). See [references/low-level-api.md](references/low-level-api.md).
- **Init-only options** cannot change after `init()`: `shadow`, `maxSse`, `segments`, `useNormal`.
- **Optional G-buffers: declare, never assume.** They exist only while an active effect lists them in `static requiredBuffers`, so read them through the `ViewContext`/`MRTPassEffectDesc` getters (`undefined` when disabled) and **re-fetch every frame** — a config change rebuilds the attachments. Never hardcode an attachment index; they are packed and shift. Switching the set reallocates attachments and recompiles shaders, so add an effect once and tune via `handle.update()` rather than add/remove per frame. Only MRT-pass fragments write the G-buffer at all — a mesh sitting in the opaque/transparent scene contributes nothing to it.
- **Effect compatibility:** `hideUnderground: false` and `logarithmicDepthBuffer` break some effect descriptors — test, and prefer defaults.
- `picking: true` (constructor, default on) is required for the `pick` event and pickable meshes.
- **API stability tiers:** `ThreeView` = Tier 0 (stable). `Plugin` + `ViewContext` = Tier 1 (may break between minor versions). Keep app code on Tier 0 where possible.
- **Runtime assets (atmosphere/cloud/noise/water) bundle automatically** — each file is referenced via a static `new URL(..., import.meta.url)`, so Vite/webpack emit them into the app build; no copying or config needed. To self-host instead, pass `atmosphereAssetsUrl` (Atmosphere) / `assetsUrl` (Clouds) pointing at a directory that keeps the **original filenames** (`transmittance.exr`, `local_weather.png`, …); both default to `undefined` = bundled assets. There are no directory URL constants (appending filenames to a directory can't survive bundler hashing) — only per-file constants exist (`ATMOSPHERE_TRANSMITTANCE_URL`, `CLOUD_LOCAL_WEATHER_URL`, `STBN_URL`, `WATER_NORMAL_URL`, `STARS_ASSETS_URL`, …).

## Lighting — when it's needed and which light to add

Lighting only affects surfaces that carry **normals**. Anything without normals is shaded uniformly (fullbright) and needs no light. But once normals are present, **no light means the surface renders black**. Add at least one light when you have:

- meshes / GLTF models that ship vertex normals
- `quantized-mesh` terrain loaded with `requestVertexNormals: true`
- `raster-dem` terrain rendered with a `hillshade` material
- the bare globe when the view was constructed with `useNormal: true` (init-only) — needed for the sun to shade the globe when no terrain or hillshade layer supplies normals

Built-in lights — register via `DefaultPlugin`, then `view.addLight<T>({ ... })`:

| Descriptor          | Key             | Use                                                                                          |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `AmbientLightDesc`  | `ambient`       | flat fill — raise overall brightness or light everything uniformly; no direction, no shadows |
| `LightProbeDesc`    | `lightProbe`    | pseudo-IBL from spherical-harmonics coefficients (e.g. a baked night ambient)                |
| `SkyLightProbeDesc` | `skyLightProbe` | dynamic sky ambient that follows the sun through the atmosphere system                       |
| `SunLightDesc`      | `sun`           | directional sun; its direction is derived from `atmosphere.date`, and it casts CSM shadows   |

`addDefaultPhotorealScene()` already adds a `sun` + `skyLightProbe` — start there for realistic scenes and add `ambient`/`lightProbe` to taste.

**`atmosphere.date` is local-time-sensitive.** It's a plain JS `Date`, so `new Date("2024-06-21T12:00:00")` is read in the _device's_ timezone — the sun lands in a different place per machine. Pin a global instant with an explicit UTC string (`new Date("2024-06-21T12:00:00Z")`). To hold the same time-of-day or sun elevation while flying the camera to another country, don't recompute by hand — use `view.atmosphere.setDateFromCameraAt({ lng })` (keeps local solar time) or `setElevationFromCameraAt({ lat, lng })` (keeps sun elevation).

## Where to verify — never guess API details

**Primary reference: the docs site — https://navara-docs.reearth.workers.dev//** (Japanese under `/ja/`). Sections: `/three/` (core API: sources, layers, materials, camera, events), `/three_default_descs/` (every built-in mesh/effect/light Descriptor and its options), `/three_default_plugin/`, `/three_plugins/`.

- **Do not guess material or config property names** — this skill shows patterns, not exhaustive option lists. Verify exact fields against the docs site, or the TypeScript definitions in `node_modules/@navaramap/*` (`.d.ts`).
- Working inside the Navara repository? The docs source is `docs/src/content/docs/` and runnable examples are `web/navara_three/example/pages/` — reference paths in this skill starting with `example/pages/` refer to that examples directory.
