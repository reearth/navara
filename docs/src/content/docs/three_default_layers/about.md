---
title: About
description: Overview and features of three_default_layers.
sidebar:
  order: 1
---

## What is three_default_layers?

`three_default_layers` is a default layer implementation package for the layer system provided by `navara_three`. It offers commonly used layers such as 3D meshes, post-processing effects, and lighting in a ready-to-use form.

## Relationship with navara_three

`navara_three` is the core library that manages adding and managing layers, but it does not include implementations of individual layers. `three_default_layers` provides the concrete implementations for mesh descriptors, effect descriptors, and light descriptors.

```
navara_three (core)
  └── three_default_layers (default layer implementations)
        ├── Mesh Desc (3D meshes)
        ├── Effect Desc (post-processing)
        └── Light Desc (lighting)
```

## Usage

To use layers from `three_default_layers`, you need to register the descriptor classes with `view.registerMesh()` / `view.registerEffect()` / `view.registerLight()` before calling `view.addMesh()` / `view.addEffect()` / `view.addLight()`.

```typescript
import ThreeView from "@navara/three";
import { BoxMeshDesc, FXAAEffectDesc, SunLightDesc } from "@navara/three_default_layers";

const view = new ThreeView();

// Register descriptor classes
view.registerMesh("box", BoxMeshDesc);
view.registerEffect("fxaa", FXAAEffectDesc);
view.registerLight("sun", SunLightDesc);

await view.init({ canvas: document.getElementById("canvas") });

// Use after registration
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addEffect({ fxaa: {} });
view.addLight({ sun: { intensity: 1.0 } });
```

:::tip
If you want to register all default descriptors at once, it is convenient to use `DefaultPlugin` from [three_default_plugin](../../../three_default_plugin/about/).
:::

## Types of Provided Layers

### Mesh Descs

Layers that add 3D mesh objects to the scene. They support basic shapes such as boxes, spheres, and cylinders, as well as loading glTF models.

```typescript
import { BoxMeshDesc, GLTFModelDesc } from "@navara/three_default_layers";

view.registerMesh("box", BoxMeshDesc);
view.registerMesh("gltfModel", GLTFModelDesc);

// Use after registration
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addMesh({ gltfModel: { url: "model.glb" } });
```

See the [Mesh Desc Reference](../../../three_default_layers/mesh-desc/about/) for details.

### Effect Descs

Layers that apply post-processing effects. They provide a rich set of effects including anti-aliasing, SSAO, SSR, and more.

```typescript
import { FXAAEffectDesc, SSAOEffectDesc } from "@navara/three_default_layers";

view.registerEffect("fxaa", FXAAEffectDesc);
view.registerEffect("ssao", SSAOEffectDesc);

// Use after registration
view.addEffect({ fxaa: {} });
view.addEffect({ ssao: {} });
```

See the [Effect Desc Reference](../../../three_default_layers/effect-desc/about/) for details.

### Light Descs

Layers that manage scene lighting. They provide sunlight, ambient light, light probes, and more.

```typescript
import { SunLightDesc, AmbientLightDesc } from "@navara/three_default_layers";

view.registerLight("sun", SunLightDesc);
view.registerLight("ambient", AmbientLightDesc);

// Use after registration
view.addLight({ sun: { intensity: 1.0, castShadow: true } });
view.addLight({ ambient: { intensity: 0.3 } });
```

See the [Light Desc Reference](../../../three_default_layers/light-desc/about/) for details.
