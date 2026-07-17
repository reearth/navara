# Plugins — reusing purpose-built features

A plugin bundles descriptor registrations and/or high-level behavior behind one object. Lifecycle:

1. Construct the plugin.
2. `view.addPlugin(plugin)` — **must happen before `view.init()`** (after → throws).
3. During `await view.init()`, every plugin's `init(view, ctx)` runs **in parallel** (`Promise.all`).
4. After init, call the plugin's post-init methods.

## Built-in plugins

| Plugin | Package | Purpose / key API |
|---|---|---|
| `DefaultPlugin` | `@navaramap/three_default_plugin` | Registers ~40 built-in descriptors; provides `DefaultDescriptions` type; `addDefaultPhotorealScene()` |
| `AttributionPlugin` | `@navaramap/three_plugins` | Zoom-aware credit UI: `attribution.show([{ attribution, attributionUrl }, { attributionHtml }, ...])` — see recipes.md for a full call |
| `PersonViewPlugin` | `@navaramap/three_plugins` | WASD first/third-person walk with GLTF character: `.start()`, `.teleport()`, `.setViewMode()` |
| `OverlayPlugin` | `@navaramap/three_plugins` | World→screen DOM overlays: `.setPositions([...])`, `.onUpdate(({ projected }) => ...)` |
| `CesiumIonPlugin` | `@navaramap/three_plugins` | Cesium Ion assets (quantized-mesh terrain) |
| `MapLibreStylePlugin` | `@navaramap/maplibre_style` | Render a MapLibre style JSON: `new MapLibreStylePlugin(styleJson)` |

## addDefaultPhotorealScene()

```typescript
const scene = defaultPlugin.addDefaultPhotorealScene();   // after view.init()
// → handles: { sky, stars, sun, skyLightProbe, aerialPerspective, toneMapping, lensFlare, antialiasing }
scene.sun.update({ sun: { castShadow: true } });   // tweak individual pieces via their handles
```

It is mobile-aware (respects `mobileOptimization`) — note `lensFlare` is `undefined` on mobile, so guard before using that handle. Prefer this over hand-assembling sky/sun/AA effects. For the full photoreal *base scene* composition (terrain + imagery + attribution), see [recipes.md](recipes.md).

## Composing plugins

```typescript
view.addPlugin(defaultPlugin);
view.addPlugin(new PersonViewPlugin({ ... }));
const overlay = new OverlayPlugin({ maxDistance: 100_000 });
view.addPlugin(overlay);
await view.init();
overlay.setPositions(landmarks.map((l) => ({ id: l.id, lng: l.lng, lat: l.lat, alt: l.alt })));
overlay.onUpdate(({ projected }) => {
  const pos = projected.get(id);            // { x, y, distance }
  moveOverlayElement(el, pos.x, pos.y);
});
```

Plugin docs: https://navara-docs.netlify.app/three_plugins/about/ — runnable references in the Navara repo: `example/pages/plugins/overlay-marker/`, `example/pages/use-cases/interior-explore/` (PersonViewPlugin walkthrough of building interiors).

## Writing your own plugin

Extend `Plugin<TView, TCtx>` and implement the single hook `init(view, ctx)`. Typical work inside `init`: bulk-register mesh/effect/light descriptor classes, wire event listeners, expose high-level methods on the plugin instance.

```typescript
import { Plugin } from "@navaramap/three";

export class MyPlugin extends Plugin {
  async init(view, ctx) {
    view.registerEffect("myEffect", MyEffectDesc);
    // stash view/ctx for post-init methods
  }
}
```

**Stability note:** `Plugin` and `ViewContext` are Tier 1 API — they may break between minor versions (vs. Tier 0 `ThreeView`, which is stable). Fine for plugins you maintain alongside Navara; document the coupling.
