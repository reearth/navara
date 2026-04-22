# Custom Descriptors & Plugin System

This document explains the plugin system and custom descriptor architecture in Navara.

## Motivation

Rendering descriptors (meshes, lights, effects) are purely Three.js constructs with no dependency on the GIS engine or WASM modules. Keeping them separate from `@navara/three` ensures that:

- **The core stays focused** on bridging the GIS engine to Three.js, without being inflated by rendering-only implementations.
- **GIS and rendering concerns stay decoupled** — GIS-driven descriptors (tiles, vector features) and rendering-only descriptors (decorative meshes, atmospheric effects, lights) have a clear boundary.
- **Custom and official descriptors are on equal footing** — external packages use the same public API as the default descriptors, so users can extend, replace, or compose descriptors freely.

## Descriptor Types

`ThreeView` provides three registration methods, each corresponding to a descriptor category:

| Method                             | Category | Purpose                                                            |
| ---------------------------------- | -------- | ------------------------------------------------------------------ |
| `view.registerMesh(name, class)`   | Mesh     | 3D objects added to the scene (rain, snow, sky, GLTF models, etc.) |
| `view.registerLight(name, class)`  | Light    | Light sources (sun, ambient, light probes)                         |
| `view.registerEffect(name, class)` | Effect   | Post-processing effects (SSAO, SSR, tone mapping, clouds, etc.)    |

All three are available to plugins, giving external packages the same capabilities as built-in descriptors.

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

Light, effect, and mesh descriptors are registered through the plugin system (e.g., `@navara/three_default_plugin`). Core effect descriptors (MRT, selective effects, final copy) are registered by `@navara/three` itself.

Multiple plugins can be composed together:

```typescript
view.addPlugin(new DefaultPlugin());
view.addPlugin(new MyPlugin());
await view.init();
```

## Implementing a Custom Descriptor

### Mesh descriptor

Extend `MeshDescDeclaration` (or `MeshDescDeclarationForSelectiveEffect` for bloom/outline support). Define a config type, implement `createMesh()`, and optionally override `onUpdateConfig()` for dynamic updates.

```typescript
import {
  MeshDescDeclaration,
  type MeshDescConfig,
  type MeshDescUpdate,
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

type MyMeshConfig = MeshDescConfig & MyMeshDescription;
type MyMeshUpdate = MeshDescUpdate & MyMeshDescription;

class MyMeshDesc extends MeshDescDeclaration<
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

See `MeshDescDeclaration` JSDoc and the `custom-shader` example for a complete tutorial.

### Instanced mesh descriptor

Extend `InstancedMeshDescDeclaration` to render many instances of the same geometry in a single draw call via Three.js `InstancedMesh`. Implement four abstract methods: `createGeometry()`, `createMaterial()`, `getChildConfigs()`, and `getInstanceColor()`. Optionally override `getInstanceScale()` to encode geometry-specific dimensions (e.g., width/height/depth) into the scale.

```typescript
import {
  InstancedMeshDescDeclaration,
  type InstancedChildConfig,
  type InstancedMeshDescConfig,
  type InstancedMeshDescUpdate,
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

type MyConfig = InstancedMeshDescConfig & { boxes?: BoxesDescription };
type MyUpdate = InstancedMeshDescUpdate & { boxes?: BoxesDescription };

class InstancedBoxMeshDesc extends InstancedMeshDescDeclaration<
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

See `InstancedBoxMeshDesc` and the `mesh-layers/instanced-mesh` example for a complete reference.

### Bundling descriptors into a plugin

A plugin registers descriptor classes so they can be used via `view.addMesh()`, `view.addLight()`, `view.addEffect()`:

```typescript
import { Plugin } from "@navara/core";
import type ThreeView from "@navara/three";

type CustomDeclarations = {
  mesh: MyMeshDescription;
  light: MyLightDescription;
  effect: MyEffectDescription;
};

class MyPlugin extends Plugin {
  async init(view: ThreeView<CustomDeclarations>) {
    view.registerMesh("myMesh", MyMeshDesc);
    view.registerLight("myLight", MyCustomLightDesc);
    view.registerEffect("myEffect", MyCustomEffectDesc);
  }
}
```

## `@navara/three_default_plugin`

`@navara/three_default_plugin` is a plugin that registers the default descriptors from `@navara/three_default_layers`. It also exports `DefaultDeclarations` — a structured type with `mesh`, `light`, and `effect` fields for type-safe declarations.

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultDeclarations } from "@navara/three_default_plugin";

const view = new ThreeView<DefaultDeclarations>({ /* options */ });
view.addPlugin(new DefaultPlugin());
await view.init();
```
