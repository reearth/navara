# Custom Layers & Plugin System

This document explains the plugin system and custom layer architecture in Navara.

## Motivation

Rendering layers (meshes, lights, effects) are purely Three.js constructs with no dependency on the GIS engine or WASM modules. Keeping them separate from `@navara/three` ensures that:

- **The core stays focused** on bridging the GIS engine to Three.js, without being inflated by rendering-only implementations.
- **GIS and rendering concerns stay decoupled** — GIS-driven layers (tiles, vector features) and rendering-only layers (decorative meshes, atmospheric effects, lights) have a clear boundary.
- **Custom and official layers are on equal footing** — external packages use the same public API as the default layers, so users can extend, replace, or compose layers freely.

## Layer Types

`ThreeView` provides three registration methods, each corresponding to a layer category:

| Method                             | Category | Purpose                                                            |
| ---------------------------------- | -------- | ------------------------------------------------------------------ |
| `view.registerMesh(name, class)`   | Mesh     | 3D objects added to the scene (rain, snow, sky, GLTF models, etc.) |
| `view.registerLight(name, class)`  | Light    | Light sources (sun, ambient, light probes)                         |
| `view.registerEffect(name, class)` | Effect   | Post-processing effects (SSAO, SSR, tone mapping, clouds, etc.)    |

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

Light, effect, and mesh layers are registered through the plugin system (e.g., `@navara/three_default_plugin`). Core effect layers (MRT, selective effects, final copy) are registered by `@navara/three` itself.

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
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

See `MeshLayerDeclaration` JSDoc and the `custom-shader` example for a complete tutorial.

### Instanced mesh layer

Extend `InstancedMeshLayerDeclaration` to render many instances of the same geometry in a single draw call via Three.js `InstancedMesh`. Implement four abstract methods: `createGeometry()`, `createMaterial()`, `getChildConfigs()`, and `getInstanceColor()`. Optionally override `getInstanceScale()` to encode geometry-specific dimensions (e.g., width/height/depth) into the scale.

```typescript
import {
  InstancedMeshLayerDeclaration,
  type InstancedChildConfig,
  type InstancedMeshLayerConfig,
  type InstancedMeshLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import { BoxGeometry, Color as ThreeColor, MeshLambertMaterial, Vector3 } from "three";

type BoxChildConfig = InstancedChildConfig & {
  width?: number;
  height?: number;
  depth?: number;
  color?: Color;
};

type BoxesDescription = {
  color?: Color;
  children?: BoxChildConfig[];
};

type MyConfig = InstancedMeshLayerConfig & { boxes?: BoxesDescription };
type MyUpdate = InstancedMeshLayerUpdate & { boxes?: BoxesDescription };

class InstancedBoxMeshLayer extends InstancedMeshLayerDeclaration<
  BoxGeometry, MeshLambertMaterial, MyConfig, MyUpdate, BoxChildConfig
> {
  private config: MyConfig;

  constructor(view: ViewContext, config: MyConfig) {
    super(view, config);
    this.config = config;
  }

  protected createGeometry() { return new BoxGeometry(1, 1, 1); }

  protected createMaterial() {
    return new MeshLambertMaterial({ color: this.config.boxes?.color?.raw ?? 0xffffff });
  }

  protected getChildConfigs() { return this.config.boxes?.children ?? []; }

  protected getInstanceColor(config: BoxChildConfig) {
    return config.color ? new ThreeColor(config.color.raw) : undefined;
  }

  // Encode width/height/depth as scale
  protected override getInstanceScale(config: BoxChildConfig, target: Vector3) {
    const s = config.scale;
    target.set(
      (config.width ?? 1) * (s?.x ?? 1),
      (config.height ?? 1) * (s?.y ?? 1),
      (config.depth ?? 1) * (s?.z ?? 1),
    );
  }
}
```

After creation, instances can be managed dynamically via `add()`, `removeAt()`, `updateAt()`, `clear()`, and `count`. The internal buffer grows automatically when capacity is exceeded.

See `InstancedBoxMeshLayer` and the `mesh-layers/instanced-mesh` example for a complete reference.

### Bundling layers into a plugin

A plugin registers layer classes so they can be used via `view.addLayer()`:

```typescript
import { Plugin } from "@navara/core";
import type ThreeView from "@navara/three";

type CustomLayerDescriptions = 
  | MyMeshDescription
  | ...

class MyPlugin extends Plugin {
  async init(view: ThreeView<CustomLayerDescriptions>) {
    view.registerMesh("myMesh", MyMeshLayer);
    view.registerLight("myLight", MyCustomLightLayer);
    view.registerEffect("myEffect", MyCustomEffectLayer);
  }
}
```

## `@navara/three_default_plugin`

`@navara/three_default_plugin` is a plugin that registers the default layers from `@navara/three_default_layers`. It also exports `DefaultLayerDescriptions` — a union type of all default mesh layer configs for type-safe layer declarations.

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";

const view = new ThreeView<DefaultLayerDescriptions>({ /* options */ });
view.addPlugin(new DefaultPlugin());
await view.init();
```
