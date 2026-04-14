---
title: Plugin
description: How to implement plugins
sidebar:
  order: 22
---

This section describes the API for implementing plugins. For an overview of the plugin system concepts, see [About Plugin](../../../three/introduction/about-plugin/).

## Plugin Class

All plugins are implemented by inheriting from the `Plugin` abstract class.

```typescript
import { Plugin } from "@navara/three";

abstract class Plugin<TView = unknown, TCtx = unknown> {
  abstract init(view: TView, ctx: TCtx): Promise<void>;
}
```

The `Plugin` class is intentionally designed as a minimal interface, providing only the `init()` method.

| Method            | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `init(view, ctx)` | Plugin initialization. Automatically called during `view.init()`         |

### Generics

| Parameter | Description |
| --------- | ----------- |
| `TView`   | The type of the view passed to `init()`. Typically `ThreeView` or `ThreeView<MyLayerDescriptions>`. |
| `TCtx`    | The type of the context passed to `init()`. Use `ViewContext` to access the renderer, buffers, and pass management APIs. |

## Lifecycle

Plugins operate at the following stages:

1. `view.addPlugin(plugin)` -- Register the plugin (must be called **before** `view.init()`)
2. `view.init()` -- The `init()` of all registered plugins is executed **in parallel**

```
view.addPlugin(pluginA)
view.addPlugin(pluginB)
await view.init()
  ├── Render pass initialization
  ├── Promise.all([pluginA.init(view, ctx), pluginB.init(view, ctx)])  ← parallel execution
  └── Main loop starts
```

:::caution
`view.addPlugin()` must be called **before** `view.init()`. Calling it after initialization will result in an error.
:::

## Implementing Custom Plugins

### Basic Plugin

Here is an example of a basic plugin that encapsulates layer registration.

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import {
  BoxMeshLayer,
  SphereMeshLayer,
  SunLightLayer,
  AmbientLightLayer,
  FXAAEffectLayer,
} from "@navara/three_default_layers";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    // Register mesh layers
    view.registerMesh("box", BoxMeshLayer);
    view.registerMesh("sphere", SphereMeshLayer);

    // Register light layers
    view.registerLight("sun", SunLightLayer);
    view.registerLight("ambient", AmbientLightLayer);

    // Register effect layers
    view.registerEffect("fxaa", FXAAEffectLayer);
  }
}
```

```typescript
// Usage example
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// Layers registered by the plugin are now available
view.addLayer({ type: "mesh", box: { width: 100, height: 100, depth: 100 } });
view.addLayer({ type: "light", sun: { intensity: 1.0 } });
```

### Plugin Providing a High-Level API

In addition to registering layers within `init()`, you can also provide methods to be called after initialization.

```typescript
import ThreeView, { Plugin, type ViewContext, type LayerHandle } from "@navara/three";
import {
  SkyMeshLayer,
  SunLightLayer,
  AmbientLightLayer,
  ToneMappingEffectLayer,
  FXAAEffectLayer,
} from "@navara/three_default_layers";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  private view?: ThreeView;

  async init(view: ThreeView, _ctx: ViewContext) {
    this.view = view;

    view.registerMesh("sky", SkyMeshLayer);
    view.registerLight("sun", SunLightLayer);
    view.registerLight("ambient", AmbientLightLayer);
    view.registerEffect("toneMapping", ToneMappingEffectLayer);
    view.registerEffect("fxaa", FXAAEffectLayer);
  }

  /** Add basic lighting and effects to the scene */
  setupScene(): {
    sky: LayerHandle<SkyMeshLayer>;
    sun: LayerHandle<SunLightLayer>;
  } {
    if (!this.view) throw new Error("Plugin is not initialized");

    const sky = this.view.addLayer<SkyMeshLayer>({ type: "mesh", sky: {} });
    const sun = this.view.addLayer<SunLightLayer>({
      type: "light",
      sun: { intensity: 1.0, castShadow: true },
    });
    this.view.addLayer({ type: "light", ambient: { intensity: 0.3 } });
    this.view.addLayer({ type: "effect", toneMapping: {} });
    this.view.addLayer({ type: "effect", fxaa: {} });

    return { sky, sun };
  }
}
```

```typescript
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// Call plugin methods after initialization
const { sky, sun } = plugin.setupScene();
```

### Plugin with Custom Layers

You can also create plugins that register custom layers you have implemented (see [Custom Layer](../../../three/api/custom-layer/)).

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import { MyCustomMeshLayer } from "./layers/MyCustomMeshLayer";
import { MyCustomEffectLayer } from "./layers/MyCustomEffectLayer";

class MyCustomPlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    view.registerMesh("myCustomMesh", MyCustomMeshLayer);
    view.registerEffect("myCustomEffect", MyCustomEffectLayer);
  }
}
```

## Related Resources

- [About Plugin](../../../three/introduction/about-plugin/) - Plugin system concepts
- [Custom Layer](../../../three/core/custom-layer/) - How to implement custom layers
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin details
