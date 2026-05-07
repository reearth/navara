---
title: About
description: Overview and features of three_plugins.
sidebar:
  order: 1
---

## What is three_plugins?

`three_plugins` is a collection of use-case specific plugins for `navara_three`. While the core library provides the `Plugin` base class and `three_default_plugin` handles descriptor registration, `three_plugins` provides higher-level plugins that solve specific use cases out of the box.

## Relationship with Other Packages

```text
navara_three (core: ThreeView, Plugin, addPlugin)
  ├── three_default_descs (descriptor implementations)
  ├── three_default_plugin (DefaultPlugin: bulk descriptor registration)
  └── three_plugins (use-case specific plugins)
        ├── FlyingModelPlugin (keyboard-driven GLTF model flight)
        └── OverlayPlugin (world-to-screen HTML overlay projection)
```

`three_plugins` depends on `navara_three` for the `Plugin` base class and core APIs, and on `three_default_plugin` for the `DefaultDescriptions` type. Each plugin is independent — you can use one without the other.

## Installation

```typescript
import { FlyingModelPlugin, OverlayPlugin, moveOverlayElement } from "@navara/three_plugins";
```

## Available Plugins

### FlyingModelPlugin

A keyboard-controlled GLTF model flight simulator. Loads any animated GLTF model onto the globe, moves it via WASD / arrow keys with a chase camera, and broadcasts position state on every frame. See [FlyingModelPlugin](../flyingmodelplugin/) for details.

### OverlayPlugin

Projects geographic positions (lat/lng/alt) to screen coordinates on every render frame, enabling HTML overlays that track world positions. See [OverlayPlugin](../overlayplugin/) for details.

## Usage

Both plugins follow the standard plugin lifecycle: create an instance, register it with `view.addPlugin()` before `view.init()`, and then use plugin-specific methods after initialization.

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { FlyingModelPlugin, OverlayPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container, animation: true });

const defaultPlugin = new DefaultPlugin();
const flyingModel = new FlyingModelPlugin({
  modelUrl: "/glTF/bird/scene.gltf",
  animation: {
    idleClip: "Gliding",
    dashClip: "Flapping",
    speed: 1.0,
    crossfadeDuration: 0.3,
  },
});
const overlay = new OverlayPlugin({ maxDistance: 100_000 });

view.addPlugin(defaultPlugin);
view.addPlugin(flyingModel);
view.addPlugin(overlay);

await view.init();

flyingModel.start();
```

## Related Resources

- [About Plugin](../../three/introduction/about-plugin/) — Plugin system concepts
- [Plugin API](../../three/core/plugin/) — How to implement plugins
- [three_default_plugin](../../three_default_plugin/about/) — DefaultPlugin details
