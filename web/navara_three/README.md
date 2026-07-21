# @navaramap/three

Navara is a 3D globe map engine. Reusable GIS logic (tiling, terrain, styling, culling) lives in a Rust/WASM core, and drawing is delegated to a swappable rendering backend. This package is the Three.js-based binding — its public API is `ThreeView` plus a declarative Source/Layer/Descriptor model.

## Install

```bash
pnpm add @navaramap/three @navaramap/three_default_plugin three postprocessing
```

`three` and `postprocessing` are peer dependencies. Most apps also want `@navaramap/three_default_plugin`, which registers the built-in mesh/effect/light descriptors.

## Quick Start

Plugins must be added before `init()`, and sources/layers/effects after it:

```typescript
import ThreeView from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";

const view = new ThreeView<DefaultDescriptions>({ shadow: true }); // 1. construct
const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin); // 2. add ALL plugins before init
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

const source = view.addSource({
  type: "raster-tile",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source });

// Credit the data through the built-in attribution UI (enabled by default).
view.attribution?.add([
  {
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
]);
```

Beyond the declarative Source/Layer API, `ThreeView` exposes per-feature styling (`FeatureEvaluator`), picking, terrain sampling, geodetic/ECEF math utilities, a plugin system, and custom mesh/effect/light descriptors with access to the render pipeline.

## Related packages

- [`@navaramap/three_default_plugin`](../navara_three_default_plugin) — registers all built-in descriptors at once
- [`@navaramap/three_default_descs`](../navara_three_default_descs) — the individual descriptor classes and their config types
- [`@navaramap/three_plugins`](../navara_three_plugins) — optional feature plugins (first-person walk, DOM overlays, Cesium ion, TileJSON)
- [`@navaramap/three_react`](../navara_three_react) — React bindings

## Documentation

Full documentation, including every source/layer/material option and runnable examples, is at https://navara-docs.netlify.app/.

## License

MIT OR Apache-2.0
