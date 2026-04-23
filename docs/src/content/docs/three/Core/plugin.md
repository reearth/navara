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
| `TView`   | The type of the view passed to `init()`. Typically `ThreeView` or `ThreeView<MyDeclarations>`. |
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

Here is an example of a basic plugin that encapsulates Descriptor registration.

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import {
  BoxMeshDesc,
  SphereMeshDesc,
  SunLightDesc,
  AmbientLightDesc,
  FXAAEffectDesc,
} from "@navara/three_default_descs";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    // Register mesh descriptors
    view.registerMesh("box", BoxMeshDesc);
    view.registerMesh("sphere", SphereMeshDesc);

    // Register light descriptors
    view.registerLight("sun", SunLightDesc);
    view.registerLight("ambient", AmbientLightDesc);

    // Register effect descriptors
    view.registerEffect("fxaa", FXAAEffectDesc);
  }
}
```

```typescript
// Usage example
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// Descriptors registered by the plugin are now available
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addLight({ sun: { intensity: 1.0 } });
```

### Plugin Providing a High-Level API

In addition to registering descriptors within `init()`, you can also provide methods to be called after initialization.

```typescript
import ThreeView, { Plugin, type ViewContext, type MeshHandle, type LightHandle } from "@navara/three";
import {
  SkyMeshDesc,
  SunLightDesc,
  AmbientLightDesc,
  ToneMappingEffectDesc,
  FXAAEffectDesc,
} from "@navara/three_default_descs";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  private view?: ThreeView;

  async init(view: ThreeView, _ctx: ViewContext) {
    this.view = view;

    view.registerMesh("sky", SkyMeshDesc);
    view.registerLight("sun", SunLightDesc);
    view.registerLight("ambient", AmbientLightDesc);
    view.registerEffect("toneMapping", ToneMappingEffectDesc);
    view.registerEffect("fxaa", FXAAEffectDesc);
  }

  /** Add basic lighting and effects to the scene */
  setupScene(): {
    sky: MeshHandle<SkyMeshDesc>;
    sun: LightHandle<SunLightDesc>;
  } {
    if (!this.view) throw new Error("Plugin is not initialized");

    const sky = this.view.addMesh<SkyMeshDesc>({ sky: {} });
    const sun = this.view.addLight<SunLightDesc>({
      sun: { intensity: 1.0, castShadow: true },
    });
    this.view.addLight({ ambient: { intensity: 0.3 } });
    this.view.addEffect({ toneMapping: {} });
    this.view.addEffect({ fxaa: {} });

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

### Plugin with Custom Descriptors

You can also create plugins that register custom descriptors you have implemented (see [Custom Descriptor](../../../three/api/custom-desc/)).

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import { MyCustomMeshDesc } from "./layers/MyCustomMeshDesc";
import { MyCustomEffectDesc } from "./layers/MyCustomEffectDesc";

class MyCustomPlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    view.registerMesh("myCustomMesh", MyCustomMeshDesc);
    view.registerEffect("myCustomEffect", MyCustomEffectDesc);
  }
}
```

## Related Resources

- [About Plugin](../../../three/introduction/about-plugin/) - Plugin system concepts
- [Custom Descriptor](../../../three/core/custom-desc/) - How to implement custom descriptors
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin details
