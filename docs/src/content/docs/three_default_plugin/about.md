---
title: About
description: Overview and features of three_default_plugin.
sidebar:
  order: 1
---

## What is three_default_plugin?

`three_default_plugin` is a plugin that uses the `Plugin` system of `navara_three` to register all layers provided by `three_default_layers` into `ThreeView` at once. Simply adding the `DefaultPlugin` class via `view.addPlugin()` makes all mesh, effect, and light layers available.

## Relationship with navara_three / three_default_layers

```
navara_three (core: ThreeView, Plugin, addPlugin, registerMesh/Effect/Light)
  ├── three_default_layers (layer implementations: 17 meshes, 12 effects, 4 lights)
  └── three_default_plugin (DefaultPlugin: bulk layer registration + utilities)
```

`navara_three` provides the mechanism for registering and managing layers (`registerMesh`, `registerEffect`, `registerLight`). `three_default_layers` provides the implementation of individual layer classes. `three_default_plugin` bridges these together and registers all default layers into `ThreeView`.

## Usage

### Basic Setup

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView();

// Add plugin before init()
view.addPlugin(plugin);
await view.init({ canvas: document.getElementById("canvas") });
```

The following layers are automatically registered during the plugin's `init()`:

**Mesh layers (17 types):** `rain`, `snow`, `sky`, `skyBox`, `stars`, `box`, `boxes`, `sphere`, `glowGlobe`, `cylinder`, `tube`, `plane`, `gltfModel`, `axesHelper`, `arrowHelper`, `arcLines`, `smoothLines`

**Effect layers (12 types):** `aerialPerspective`, `rainDrop`, `clouds`, `fogLight`, `lensFlare`, `ssao`, `ssr`, `depthOfField`, `colorGradingLUT`, `toneMapping`, `smaa`, `fxaa`

**Light layers (4 types):** `sun`, `ambient`, `skyLightProbe`, `lightProbe`

### addDefaultPhotorealLayers()

`DefaultPlugin` provides the `addDefaultPhotorealLayers()` method for easily building photorealistic 3D map scenes. By calling it after `view.init()`, sky, stars, sunlight, atmospheric effects, and more are automatically added.

```typescript
const plugin = new DefaultPlugin();
const view = new ThreeView();
view.addPlugin(plugin);
await view.init({ canvas: document.getElementById("canvas") });

// Set up a photorealistic scene in one call
const layers = plugin.addDefaultPhotorealLayers();
// Returns layers.sky, layers.sun, layers.aerialPerspective, ...
```

Layers added:

| Layer | Type | Description |
|---------|------|------|
| `sky` | mesh | Sky rendering |
| `skyEnv` | mesh | Sky for environment maps |
| `stars` | mesh | Star rendering |
| `skyLightProbe` | light | Environment light based on the sky |
| `sun` | light | Sunlight |
| `aerialPerspective` | effect | Aerial perspective effect |
| `lensFlare` | effect | Lens flare (desktop only) |
| `toneMapping` | effect | Tone mapping |
| `antialiasing` | effect | SMAA (desktop) / FXAA (mobile) |

On mobile environments, lens flare is skipped for performance, and the lightweight FXAA is used for antialiasing.
