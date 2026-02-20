# Custom Layers & Plugin System

This document explains the plugin system and custom layer architecture in Navara.

## Motivation

Rendering layers (meshes, lights, effects) are purely Three.js constructs with no dependency on the GIS engine or WASM modules. Keeping them separate from `@navara/three` ensures that:

- **The core stays focused** on bridging the GIS engine to Three.js, without being inflated by rendering-only implementations.
- **GIS and rendering concerns stay decoupled** — GIS-driven layers (tiles, vector features) and rendering-only layers (decorative meshes, atmospheric effects, lights) have a clear boundary.
- **Custom and official layers are on equal footing** — external packages use the same public API as the default layers, so users can extend, replace, or compose layers freely.

## Layer Types

`ThreeView` provides three registration methods, each corresponding to a layer category:

| Method | Category | Purpose |
|---|---|---|
| `view.registerMesh(name, class)` | Mesh | 3D objects added to the scene (rain, snow, sky, GLTF models, etc.) |
| `view.registerLight(name, class)` | Light | Light sources (sun, ambient, light probes) |
| `view.registerEffect(name, class)` | Effect | Post-processing effects (SSAO, SSR, tone mapping, clouds, etc.) |

All three are available to plugins, giving external packages the same capabilities as built-in layers.

## Plugin System

### Plugin base class (`@navara/core`)

A minimal `Plugin` base class that any package can extend:

```typescript
export class Plugin {
  async init(_view: unknown): Promise<void> {}
}
```

### Plugin lifecycle (`@navara/three`)

Plugins are registered before initialization and initialized during `view.init()`:

```typescript
view.addPlugin(plugin);   // Register before init()
await view.init();        // Calls plugin.init(view) for each registered plugin
```

Light and effect layers are registered by `@navara/three` itself, while mesh layers are provided through the plugin system like `@navara/three_default_plugin`, for example.

Multiple plugins can be composed together:

```typescript
view.addPlugin(new DefaultPlugin());
view.addPlugin(new MyPlugin());
await view.init();
```

## Implementing a Custom Layer

### Mesh layer

Extend `MeshLayerDeclaration` (or `MeshLayerDeclarationForSelectiveEffect` for bloom/outline support). Define a config type, implement `createMesh()`, and optionally override `onUpdateConfig()` for dynamic updates.

```typescript
import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import { Mesh, SphereGeometry, MeshStandardMaterial } from "three";

type MyMeshDescription = {
  myMesh?: {
    radius?: number;
    color?: Color;
  };
};

type MyMeshConfig = MeshLayerConfig & MyMeshDescription;
type MyMeshUpdate = MeshLayerUpdate & MyMeshDescription;

class MyMeshLayer extends MeshLayerDeclaration<
  MyMeshConfig,
  MyMeshUpdate,
  Mesh<SphereGeometry, MeshStandardMaterial>
> {
  private config: MyMeshConfig;

  constructor(view: ViewContext, config: MyMeshConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.myMesh ?? {};
    const geometry = new SphereGeometry(cfg.radius ?? 1);
    const material = new MeshStandardMaterial({
      color: cfg.color?.raw ?? 0xffffff,
    });
    return new Mesh(geometry, material);
  }

  onUpdateConfig(updates: MyMeshUpdate): void {
    if (updates.myMesh && this._instance) {
      if (updates.myMesh.color !== undefined) {
        this._instance.material.color.set(updates.myMesh.color.raw);
      }
      this.emit("_needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

See `MeshLayerDeclaration` JSDoc and the `custom-shader` example for a complete tutorial.

### Bundling layers into a plugin

A plugin registers layer classes so they can be used via `view.addLayer()`:

```typescript
import { Plugin } from "@navara/core";
import type ThreeView from "@navara/three";

class MyPlugin extends Plugin {
  async init(view: ThreeView) {
    view.registerMesh("myMesh", MyMeshLayer);
    view.registerLight("myLight", MyCustomLightLayer);
    view.registerEffect("myEffect", MyCustomEffectLayer);
  }
}
```

## `@navara/three_default_plugin`

`@navara/three_default_plugin` is a plugin that registers the 18 mesh layers from `@navara/three_default_layers` (rain, snow, sky, box, sphere, GLTF model, etc.). It also exports `DefaultMeshLayerDeclarationDescription` — a union type of all default mesh layer configs for type-safe layer declarations.

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultMeshLayerDeclarationDescription } from "@navara/three_default_plugin";

const view = new ThreeView<DefaultMeshLayerDeclarationDescription>({ /* options */ });
view.addPlugin(new DefaultPlugin());
await view.init();
```
