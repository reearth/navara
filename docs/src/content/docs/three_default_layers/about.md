---
title: About
description: Overview and features of three_default_layers.
sidebar:
  order: 1
---

## What is three_default_layers?

`three_default_layers` is a default layer implementation package for the layer system provided by `navara_three`. It offers commonly used layers such as 3D meshes, post-processing effects, and lighting in a ready-to-use form.

## Relationship with navara_three

`navara_three` is the core library that manages adding and managing layers, but it does not include implementations of individual layers. `three_default_layers` provides the concrete implementations for mesh layers, effect layers, and light layers.

```
navara_three (core)
  └── three_default_layers (default layer implementations)
        ├── Mesh Layer (3D meshes)
        ├── Effect Layer (post-processing)
        └── Light Layer (lighting)
```

## Usage

To use layers from `three_default_layers`, you need to register the layer classes with `view.registerMesh()` / `view.registerEffect()` / `view.registerLight()` before calling `view.addMesh()` / `view.addEffect()` / `view.addLight()`.

```typescript
import ThreeView from "@navara/three";
import { BoxMeshLayer, FXAAEffectLayer, SunLightLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// Register layer classes
view.registerMesh("box", BoxMeshLayer);
view.registerEffect("fxaa", FXAAEffectLayer);
view.registerLight("sun", SunLightLayer);

await view.init({ canvas: document.getElementById("canvas") });

// Use after registration
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addEffect({ fxaa: {} });
view.addLight({ sun: { intensity: 1.0 } });
```

:::tip
If you want to register all default layers at once, it is convenient to use `DefaultPlugin` from [three_default_plugin](../../../three_default_plugin/about/).
:::

## Types of Provided Layers

### Mesh Layers

Layers that add 3D mesh objects to the scene. They support basic shapes such as boxes, spheres, and cylinders, as well as loading glTF models.

```typescript
import { BoxMeshLayer, GLTFModelLayer } from "@navara/three_default_layers";

view.registerMesh("box", BoxMeshLayer);
view.registerMesh("gltfModel", GLTFModelLayer);

// Use after registration
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addMesh({ gltfModel: { url: "model.glb" } });
```

See the [Mesh Layer Reference](../../../three_default_layers/mesh-layer/about/) for details.

### Effect Layers

Layers that apply post-processing effects. They provide a rich set of effects including anti-aliasing, SSAO, SSR, and more.

```typescript
import { FXAAEffectLayer, SSAOEffectLayer } from "@navara/three_default_layers";

view.registerEffect("fxaa", FXAAEffectLayer);
view.registerEffect("ssao", SSAOEffectLayer);

// Use after registration
view.addEffect({ fxaa: {} });
view.addEffect({ ssao: {} });
```

See the [Effect Layer Reference](../../../three_default_layers/effect-layer/about/) for details.

### Light Layers

Layers that manage scene lighting. They provide sunlight, ambient light, light probes, and more.

```typescript
import { SunLightLayer, AmbientLightLayer } from "@navara/three_default_layers";

view.registerLight("sun", SunLightLayer);
view.registerLight("ambient", AmbientLightLayer);

// Use after registration
view.addLight({ sun: { intensity: 1.0, castShadow: true } });
view.addLight({ ambient: { intensity: 0.3 } });
```

See the [Light Layer Reference](../../../three_default_layers/light-layer/about/) for details.
