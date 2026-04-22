---
title: About Plugin
description: An explanation of the plugin system concept.
sidebar:
  order: 5
---

## Why is a Plugin System Needed?

Navara is designed to enable diverse GIS visualizations.

Traditional map engines had fixed expressions with very limited CG flexibility, and there were cases where using a general-purpose rendering engine like Three.js was more efficient. However, handling GIS with only a general-purpose rendering engine requires highly advanced technical skills, and maintaining extensibility is also difficult.

Therefore, navara_three introduces a plugin system to **efficiently process GIS data while leveraging the flexibility of a general-purpose rendering engine**. The plugin system allows developers to freely add effect expressions and meshes, enabling more diverse visual representations.

## Plugin Use Cases

The plugin system is designed to be usable for as many general-purpose scenarios as possible. For example, the following use cases are conceivable:

- **Automating setup** -- A plugin that bulk-registers custom descriptors implemented by developers
- **Interactive map operations** -- A plugin that draws lines and areas on the map
- **Supporting new data formats** -- A plugin that loads proprietary GIS formats as GeoJSON layers

## Architecture

navara_three is responsible for abstracting advanced GIS-related processing as APIs. Features loosely related to GIS are extracted as external modules, which use the APIs exposed by navara_three to implement their functionality.

```
navara_three (core)
  ├── Abstracts advanced processing such as GIS data handling, coordinate transformations, and tile management
  ├── Layer API (addLayer, addMesh, addEffect, addLight, registerMesh, registerEffect, registerLight)
  └── Plugin API (addPlugin, Plugin class)

three_default_layers (external module)
  └── Implements Three.js-specific meshes, effects, and lights as descriptors

three_default_plugin (external module)
  └── Provides bulk registration of default descriptors and a high-level API via DefaultPlugin
```

For example, the [three_default_layers](../../../three_default_layers/about/) package implements Three.js-specific meshes, effects, and lights using the navara_three Descriptor API. Furthermore, [three_default_plugin](../../../three_default_plugin/about/) bulk-registers these and provides a high-level API for easily setting up photorealistic scenes.

navara_three aims to be a module with the highest possible versatility, but the trade-off is that the API becomes more advanced. The plugin system abstracts this into a high-level API, allowing developers to use it simply.

## Plugin Lifecycle

Plugins operate in the following order:

1. **Create the plugin** -- Instantiate the plugin
2. **Register** -- Register the plugin with `view.addPlugin()` (must be done **before** `view.init()`)
3. **Initialize** -- When `view.init()` is called, the `init()` of all registered plugins is automatically executed
4. **Use** -- After initialization, the methods and descriptors provided by the plugin are available

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// 1. Create a plugin instance
const plugin = new DefaultPlugin();

// 2. Register the plugin before view.init()
const view = new ThreeView({});
view.addPlugin(plugin);

// 3. Plugin's init() is automatically called within init()
await view.init();

// 4. After initialization, plugin methods are available
const layers = plugin.addDefaultPhotorealScene();
```

:::caution
`view.addPlugin()` must be called **before** `view.init()`. Calling it after initialization will result in an error.
:::

## DefaultPlugin

The `DefaultPlugin` provided by the [three_default_plugin](../../../three_default_plugin/about/) package is a plugin that bulk-registers all 32 Descriptors from [three_default_layers](../../../three_default_layers/about/) (16 mesh types, 12 effect types, 4 light types). For most projects, this alone is sufficient.

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// All default descriptors are now available
view.addMesh({ sky: {} });
view.addLight({ sun: { intensity: 1.0 } });
view.addEffect({ toneMapping: {} });
```

For details, see the [three_default_plugin documentation](../../../three_default_plugin/about/).

## Related Resources

- [About Layer](../../../three/introduction/about-layer/) - Layer concepts and types
- [Plugin API](../../../three/core/plugin/) - How to implement plugins
- [Custom Descriptor](../../../three/core/custom-layer/) - How to implement custom descriptors
- [three_default_layers](../../../three_default_layers/about/) - Default Descriptor implementations
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin details
