---
title: Custom Layer
description: How to implement custom layers
sidebar:
  order: 21
---

In navara_three, you can implement your own mesh, effect, and light layers. For an overview of the layer concept, see [About Layer](../../../three/introduction/about-layer/).

## Layer Base Classes

Depending on the layer type, you inherit from the corresponding base class to implement your layer.

| Layer Type     | Base Class                      | Factory Method                          | Registration Method     |
| -------------- | ------------------------------- | --------------------------------------- | ----------------------- |
| Mesh           | `MeshLayerDeclaration`          | `createMesh()`                          | `view.registerMesh()`   |
| Instanced Mesh | `InstancedMeshLayerDeclaration` | `createGeometry()` + `createMaterial()` | `view.registerMesh()`   |
| Effect         | `EffectLayerDeclaration`        | `createPass()`                          | `view.registerEffect()` |
| Light          | `LightLayerDeclaration`         | `createLight()`                         | `view.registerLight()`  |

All base classes inherit from `LayerDeclaration` and share a common lifecycle.

## Common Lifecycle

| Method                           | Timing                           | Description                                                                                            |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `constructor(view, ctx, config)` | When the layer is created        | Receives the ThreeView, ViewContext, and configuration                                                 |
| `onCreate()`                     | When `addMesh()`/`addLight()`/`addEffect()` is called | Calls the factory method to create an instance and adds it to the scene. Implemented by the base class |
| `onUpdateConfig(updates)`        | When `handle.update()` is called | Processes partial configuration updates                                                                |
| `onDestroy()`                    | When `handle.delete()` is called | Releases resources and removes from the scene                                                          |
| `update(time)`                   | Every frame (optional)           | Animation processing. Only called if implemented                                                       |
| `onResize(width, height)`        | On viewport resize (optional)    | Mesh layers only. Only called if implemented                                                           |

## Common Properties

| Property    | Type                    | Description                                                                                |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `view`      | `ThreeView`             | The ThreeView instance providing access to camera, atmosphere, globe, and other view state |
| `ctx`       | `ViewContext`           | The view context providing access to scenes, passes, and rendering internals               |
| `_instance` | `Instance \| undefined` | The created Three.js object                                                                |
| `id`        | `string`                | Unique identifier of the layer                                                             |
| `visible`   | `boolean`               | Show/hide                                                                                  |

### view and ctx

Custom layers access internal APIs through two properties: `this.view` and `this.ctx`.

- **`this.view`** (`ThreeView`) — High-level view state: camera, atmosphere, globe
- **`this.ctx`** (`ViewContext`) — Rendering internals: scenes, post-processing passes, buffers, textures

#### view Properties

See [ThreeView Properties](../../../three/api/threeview-properties/).

#### ctx Properties

| Property                 | Description                                   |
| ------------------------ | --------------------------------------------- |
| `ctx.scenes.opaque`      | Scene for opaque objects                      |
| `ctx.scenes.transparent` | Scene for transparent objects                 |
| `ctx.scenes.mrt`         | Scene for selective effects (Bloom / Outline) |
| `ctx.scenes.skyEnvMap`   | Scene for environment maps                    |
| `ctx.scenes.light`       | Scene for lights                              |
| `ctx.scenes.draped`      | Scene for terrain-draped meshes               |

#### Pass Management

| Method                                         | Description                           |
| ---------------------------------------------- | ------------------------------------- |
| `ctx.getPass(name)`                            | Get a post-processing pass by name    |
| `ctx.addPass(name, pass)`                      | Add a post-processing pass            |
| `ctx.insertPassBefore(targetName, name, pass)` | Insert a pass before the target pass  |
| `ctx.insertPassAfter(targetName, name, pass)`  | Insert a pass after the target pass   |
| `ctx.removePass(name)`                         | Remove a post-processing pass by name |

#### Renderer Access

| Method                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| `ctx.getRenderer()`    | Get the WebGLRenderer instance                |
| `ctx.getInputBuffer()` | Get the input buffer from the effect composer |

#### Buffer / Texture Access

| Method                        | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `ctx.getRenderTarget()`       | Get the main render target (includes G-buffer)   |
| `ctx.getGlobeDepthTexture()`  | Get the globe depth texture for post-processing  |
| `ctx.getGlobeNormalTexture()` | Get the globe normal texture for post-processing |
| `ctx.getNormalTexture()`      | Get the scene normal texture from the G-buffer   |
| `ctx.getEffectIdsTexture()`   | Get the effect IDs texture from the G-buffer     |
| `ctx.getEmissiveTexture()`    | Get the emissive texture from the G-buffer       |

#### Shadow (Experimental)

| Method                               | Description                        |
| ------------------------------------ | ---------------------------------- |
| `ctx.applyShadowMaterial(material)`  | Apply CSM shadows to a material    |
| `ctx.removeShadowMaterial(material)` | Remove CSM shadows from a material |

## Custom Mesh Layer

### Type Parameters

```typescript
class MyMeshLayer extends MeshLayerDeclaration<
  Config,      // Layer configuration type (extends MeshLayerConfig)
  UpdateConfig, // Update configuration type (extends MeshLayerUpdate)
  InstanceObj,  // Three.js object type (extends Object3D)
> {}
```

### Defining Configuration Types

```typescript
import type { MeshLayerConfig, MeshLayerUpdate } from "@navara/three";

type MyMeshDescription = {
  myMesh?: {
    radius?: number;
    color?: Color;
  };
};

type MyMeshConfig = MeshLayerConfig & MyMeshDescription;
type MyMeshUpdate = MeshLayerUpdate & MyMeshDescription;
```

### Properties Managed by the Base Class

`MeshLayerDeclaration` automatically handles `position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, and `visible`. For a full description of these properties, transform composition modes, and picking behavior, see [MeshLayerDeclaration](../../../three_default_layers/mesh-layer/mesh-layer-base).

### Specifying the Render Pass

You can override `getPassKey()` to change the scene where the mesh is rendered.

| PassKey         | Description                             |
| --------------- | --------------------------------------- |
| `"opaque"`      | Opaque rendering (default)              |
| `"transparent"` | Transparent rendering                   |
| `"mrt"`         | For selective effects (Bloom / Outline) |
| `"skyEnvMap"`   | For environment maps                    |
| `"draped"`      | For terrain-draped rendering            |

### Implementation Example

```typescript
import ThreeView, {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
} from "three";

// Define configuration types
type MySphereMeshDescription = {
  mySphere?: {
    radius?: number;
    color?: Color;
    castShadow?: boolean;
  };
};
type MySphereMeshConfig = MeshLayerConfig & MySphereMeshDescription;
type MySphereMeshUpdate = MeshLayerUpdate & MySphereMeshDescription;

export class MySphereMeshLayer extends MeshLayerDeclaration<
  MySphereMeshConfig,
  MySphereMeshUpdate,
  Mesh<SphereGeometry, MeshStandardMaterial>
> {
  private config: MySphereMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MySphereMeshConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  // Create and return the Three.js object
  createMesh() {
    const cfg = this.config.mySphere ?? {};
    const geometry = new SphereGeometry(cfg.radius ?? 1);
    const material = new MeshStandardMaterial({
      color: cfg.color?.raw ?? 0xffffff,
    });
    const mesh = new Mesh(geometry, material);

    // Enable shadows if configured
    if (cfg.castShadow) {
      mesh.castShadow = true;
      this.ctx.applyShadowMaterial(material);
    }

    return mesh;
  }

  // Handle partial updates
  onUpdateConfig(updates: MySphereMeshUpdate) {
    if (updates.mySphere && this._instance) {
      if (updates.mySphere.radius !== undefined) {
        // Call recreate() when geometry needs to be recreated
        this.recreate();
      }
      if (updates.mySphere.color !== undefined) {
        this._instance.material.color.set(updates.mySphere.color.raw);
      }
      this.emit("needsUpdate");
    }
    // Base class handling (position, scale, rotation, visible)
    super.onUpdateConfig(updates);
  }

  // Release resources
  onDestroy() {
    if (this._instance) {
      this._instance.geometry.dispose();
      this._instance.material.dispose();
    }
    super.onDestroy();
  }
}
```

### Registration and Usage

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView({});
view.registerMesh("mySphere", MySphereMeshLayer);
await view.init();

const handle = view.addMesh<MySphereMeshLayer>({
  mySphere: { radius: 100, color: new Color().setHex(0x00aaff) },
  position: { x: 0, y: 0, z: 6378137 },
});

// Partial update
handle.update({ mySphere: { color: new Color().setHex(0xff0000) } });
```

### Per-Frame Animation

Implementing the `update()` method causes it to be called every frame.

```typescript
export class RotatingBoxLayer extends MeshLayerDeclaration</* ... */> {
  createMesh() {
    // ...
  }

  // Called every frame
  update(time: number) {
    if (this._instance) {
      this._instance.rotation.y = time * 0.001;
    }
  }
}
```

## Custom Instanced Mesh Layer

For rendering many copies of the same geometry in a single draw call, use `InstancedMeshLayerDeclaration`. All instances share one geometry and material, with per-instance variation through `instanceMatrix` and `instanceColor`.

### Type Parameters

```typescript
class MyInstancedLayer extends InstancedMeshLayerDeclaration<
  TGeometry,    // Three.js BufferGeometry type
  TMaterial,    // Three.js Material type
  Config,       // Layer configuration type (extends InstancedMeshLayerConfig)
  UpdateConfig, // Update configuration type (extends InstancedMeshLayerUpdate)
  ChildConfig,  // Per-instance configuration type (extends InstancedChildConfig)
> {}
```

### InstancedChildConfig

Common transform fields for individual instances:

| Property   | Type      | Description                                                                  |
| ---------- | --------- | ---------------------------------------------------------------------------- |
| `position` | `XYZ`     | Local position relative to the parent group                                  |
| `rotation` | `XYZ`     | Local rotation (Euler angles in radians)                                     |
| `scale`    | `XYZ`     | Local scale                                                                  |
| `matrix`   | `Matrix4` | Pre-computed transform matrix. When set, position/rotation/scale are ignored |

### Abstract Methods

| Method                     | Return Type               | Description                                                         |
| -------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `createGeometry()`         | `TGeometry`               | Create the shared geometry for all instances                        |
| `createMaterial()`         | `TMaterial`               | Create the shared material for all instances                        |
| `getChildConfigs()`        | `ChildConfig[]`           | Extract the initial array of instance configs from the layer config |
| `getInstanceColor(config)` | `ThreeColor \| undefined` | Extract the per-instance color, or undefined for default white      |

### Optional Override Methods

| Method                             | Description                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `getInstanceScale(config, target)` | Compute per-instance scale. Override to incorporate geometry-specific dimensions (e.g., width/height/depth) |
| `composeInstanceMatrix(config)`    | Compose the transform matrix for one instance. Override for custom transform logic                          |

### Instance Management Methods

| Method                    | Signature                                               | Description                                 |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `add(config)`             | `(config: ChildConfig) => number`                       | Add a new instance. Returns the index       |
| `removeAt(index)`         | `(index: number) => void`                               | Remove by index (swap-with-last, O(1))      |
| `updateAt(index, config)` | `(index: number, config: Partial<ChildConfig>) => void` | Update an instance at the given index       |
| `clear()`                 | `() => void`                                            | Remove all instances                        |
| `replaceAll(configs)`     | `(configs: ChildConfig[]) => void`                      | Batch replace all instances (single update) |
| `count`                   | `number` (getter)                                       | Number of active instances                  |

### Implementation Example

```typescript
import ThreeView, {
  InstancedMeshLayerDeclaration,
  type InstancedMeshLayerConfig,
  type InstancedMeshLayerUpdate,
  type InstancedChildConfig,
  type ViewContext,
  Color,
} from "@navara/three";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Color as ThreeColor,
} from "three";

// Per-instance configuration
type MyBoxChild = InstancedChildConfig & {
  color?: Color;
};

// Layer configuration
type MyBoxesConfig = InstancedMeshLayerConfig & {
  boxes?: { children?: MyBoxChild[] };
};
type MyBoxesUpdate = InstancedMeshLayerUpdate & {
  boxes?: { children?: MyBoxChild[] };
};

export class MyBoxesLayer extends InstancedMeshLayerDeclaration<
  BoxGeometry,
  MeshStandardMaterial,
  MyBoxesConfig,
  MyBoxesUpdate,
  MyBoxChild
> {
  private config: MyBoxesConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MyBoxesConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createGeometry() {
    return new BoxGeometry(1, 1, 1);
  }

  createMaterial() {
    return new MeshStandardMaterial();
  }

  getChildConfigs(): MyBoxChild[] {
    return this.config.boxes?.children ?? [];
  }

  getInstanceColor(config: MyBoxChild): ThreeColor | undefined {
    return config.color ? new ThreeColor(config.color.raw) : undefined;
  }
}
```

### Registration and Usage

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({});
view.registerMesh("myBoxes", MyBoxesLayer);
await view.init();

const handle = view.addMesh<MyBoxesLayer>({
  boxes: {
    children: [
      { position: { x: 0, y: 0, z: 100 }, color: new Color().setHex(0xff0000) },
      { position: { x: 200, y: 0, z: 100 }, color: new Color().setHex(0x00ff00) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});

// Add an instance dynamically
handle.ref.add({ position: { x: 400, y: 0, z: 100 }, color: new Color().setHex(0x0000ff) });

// Update instance at index 0
handle.ref.updateAt(0, { color: new Color().setHex(0xffff00) });

// Remove instance at index 1
handle.ref.removeAt(1);
```

## Custom Effect Layer

### Type Parameters

```typescript
class MyEffectLayer extends EffectLayerDeclaration<
  Config,      // Layer configuration type (extends EffectLayerConfig)
  UpdateConfig, // Update configuration type (extends EffectLayerUpdate)
  InstanceObj,  // Post-processing pass type
> {}
```

### Static Properties (Pipeline Ordering)

Effect layers have static properties that control their insertion position within the render pipeline.

| Property           | Type       | Description                                                                           |
| ------------------ | ---------- | ------------------------------------------------------------------------------------- |
| `key`              | `string`   | **Required**. Unique key name for the effect                                          |
| `insertAfter`      | `string[]` | Insert after the specified effects (preferred)                                        |
| `insertBefore`     | `string[]` | Insert before the specified effects (fallback if `insertAfter` targets are not found) |
| `allowDuplication` | `boolean`  | Whether to allow multiple instances of the same effect                                |

The insertion order is determined by priority: `insertAfter` -> `insertBefore` -> append to end.

### Implementation Example

```typescript
import ThreeView, {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
} from "@navara/three";

type MyEffectDescription = {
  myEffect?: {
    intensity?: number;
  };
};
type MyEffectConfig = EffectLayerConfig & MyEffectDescription;
type MyEffectUpdate = EffectLayerUpdate & MyEffectDescription;

export class MyEffectLayer extends EffectLayerDeclaration<
  MyEffectConfig,
  MyEffectUpdate,
  MyPostProcessingPass
> {
  // Control ordering within the pipeline
  static key = "myEffect";
  static insertAfter = ["clouds"];
  static insertBefore = ["transparent"];

  private config: MyEffectConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MyEffectConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  // Create and return the post-processing pass
  createPass() {
    const cfg = this.config.myEffect ?? {};
    return new MyPostProcessingPass({
      intensity: cfg.intensity ?? 1.0,
    });
  }

  onUpdateConfig(updates: MyEffectUpdate) {
    if (updates.myEffect && this._instance) {
      if (updates.myEffect.intensity !== undefined) {
        this._instance.intensity = updates.myEffect.intensity;
      }
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

### Referencing Other Effect Layers

You can reference other registered effect layers using `findLayer()`.

```typescript
createPass() {
  const ssao = this.findLayer<SSAOEffectLayer>("ssao");
  // ...
}
```

## Custom Light Layer

### Type Parameters

```typescript
class MyLightLayer extends LightLayerDeclaration<
  Config,      // Layer configuration type (extends LightLayerConfig)
  UpdateConfig, // Update configuration type (extends LightLayerUpdate)
  InstanceObj,  // Three.js Light type
> {}
```

### Properties Managed by the Base Class

| Property   | Type          | Description    |
| ---------- | ------------- | -------------- |
| `position` | `{ x, y, z }` | Light position |
| `visible`  | `boolean`     | Show/hide      |

Lights are automatically added to the `ctx.scenes.light` scene.

### Implementation Example

```typescript
import ThreeView, {
  LightLayerDeclaration,
  type LightLayerConfig,
  type LightLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import { PointLight } from "three";

type MyPointLightDescription = {
  myPointLight?: {
    color?: Color;
    intensity?: number;
    distance?: number;
  };
};
type MyPointLightConfig = LightLayerConfig & MyPointLightDescription;
type MyPointLightUpdate = LightLayerUpdate & MyPointLightDescription;

export class MyPointLightLayer extends LightLayerDeclaration<
  MyPointLightConfig,
  MyPointLightUpdate,
  PointLight
> {
  private config: MyPointLightConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MyPointLightConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createLight() {
    const cfg = this.config.myPointLight ?? {};
    const light = new PointLight(
      cfg.color?.raw ?? 0xffffff,
      cfg.intensity ?? 1,
      cfg.distance ?? 0,
    );
    return light;
  }

  onUpdateConfig(updates: MyPointLightUpdate) {
    if (updates.myPointLight && this._instance) {
      if (updates.myPointLight.color !== undefined) {
        this._instance.color.set(updates.myPointLight.color.raw);
      }
      if (updates.myPointLight.intensity !== undefined) {
        this._instance.intensity = updates.myPointLight.intensity;
      }
      if (updates.myPointLight.distance !== undefined) {
        this._instance.distance = updates.myPointLight.distance;
      }
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

## LayerHandle

The `LayerHandle<T>` returned from `view.addMesh()`, `view.addLight()`, or `view.addEffect()` is a handle for controlling the layer.

| Property / Method | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | `string`  | Unique identifier of the layer           |
| `visible`         | `boolean` | Get/set show/hide                        |
| `ref`             | `T`       | Direct access to the base layer instance |
| `update(updates)` | `void`    | Partial configuration update             |
| `delete()`        | `void`    | Delete the layer. Calls `onDestroy()`    |

## Implementing Picking in Custom Layers

For an overview of picking from the user's perspective, see [MeshLayerDeclaration — Picking](../../../three_default_layers/mesh-layer/mesh-layer-base/#picking). This section covers how to implement picking support when authoring a custom layer.

### Turnkey Picking with PickableMeshWrapper

For layers that use standard Three.js materials (`MeshStandardMaterial`, `MeshLambertMaterial`, etc.) or `ShaderMaterial`, wrap the mesh in a `PickableMeshWrapper`. It automatically injects the picking shader code.

```typescript
import ThreeView, {
  MeshLayerDeclaration,
  PickableMeshWrapper,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import { Mesh, BoxGeometry, MeshStandardMaterial } from "three";

type MyConfig = MeshLayerConfig & { myBox?: { color?: Color } };
type MyUpdate = MeshLayerUpdate & { myBox?: { color?: Color } };

class MyPickableBoxLayer extends MeshLayerDeclaration<
  MyConfig, MyUpdate, Mesh
> {
  private config: MyConfig;
  private pickWrapper?: PickableMeshWrapper;

  constructor(view: ThreeView, ctx: ViewContext, config: MyConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  get batchId(): number | undefined {
    return this.pickWrapper?.batchId;
  }

  createMesh() {
    const mesh = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: this.config.myBox?.color?.raw ?? 0xffffff }),
    );

    if (this.config.pickable) {
      this.pickWrapper = new PickableMeshWrapper(mesh, this.ctx);
      this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    }

    return mesh;
  }

  onDestroy() {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
    }
    super.onDestroy();
  }
}
```

### Instanced Mesh Picking

For instanced mesh layers, use `PickableInstancedMeshWrapper`. It assigns a unique batch ID per instance, enabling you to identify which individual instance was clicked.

```typescript
import {
  InstancedMeshLayerDeclaration,
  PickableInstancedMeshWrapper,
} from "@navara/three";

class MyPickableInstancedLayer extends InstancedMeshLayerDeclaration</* ... */> {
  private pickWrapper?: PickableInstancedMeshWrapper;

  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
  }

  override onCreate() {
    super.onCreate();
    if (this.config.pickable) {
      this.pickWrapper = new PickableInstancedMeshWrapper(
        this.raw, this.count, this.ctx,
      );
      this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    }
  }

  protected override onInstanceAdded(index: number) {
    this.pickWrapper?.addInstance();
  }

  protected override onInstanceRemoved(index: number, wasLast: boolean) {
    this.pickWrapper?.removeInstanceAt(index);
  }

  protected override onInstanceMeshReplaced(newMesh: InstancedMesh) {
    this.pickWrapper?.syncMesh(newMesh);
  }

  onDestroy() {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
    }
    super.onDestroy();
  }
}
```

### Custom Picking with PickableMesh

For layers with fully custom shaders, implement the `PickableMesh` interface directly. Your fragment shader must encode the batch ID as an RGB color when the picking uniform is active.

```typescript
import { type PickableMesh } from "@navara/three";

class CustomPickable extends Object3D implements PickableMesh {
  batchId: number;
  private mesh: Mesh;

  constructor(mesh: Mesh, ctx: ViewContext) {
    super();
    this.mesh = mesh;
    this.batchId = ctx.genGlobalBatchId() ?? 0;
    mesh.material.uniforms.uBatchId.value = this.batchId;
  }

  onBeforePicking() {
    this.mesh.material.uniforms.uPicking.value = 1;
  }

  onAfterPicking() {
    this.mesh.material.uniforms.uPicking.value = 0;
  }

  getRenderable() {
    return this.mesh;
  }
}
```

The batch ID encoding in the fragment shader:

```glsl
vec3 batchIdToColor(float id) {
  float r = floor(id / 65536.0);
  float g = floor(mod(id / 256.0, 256.0));
  float b = mod(id, 256.0);
  return vec3(r, g, b) / 255.0;
}

// In the main function:
if (uPicking > 0.0) {
  gl_FragColor = vec4(batchIdToColor(uBatchId), 1.0);
  return;
}
```

### ViewContext Picking API

| Method                                          | Description                                |
| ----------------------------------------------- | ------------------------------------------ |
| `ctx.genGlobalBatchId()`                        | Generate a unique batch ID for picking     |
| `ctx.registerPickableMesh(key, mesh)`           | Register a pickable mesh                   |
| `ctx.unregisterPickableMesh(key)`               | Unregister a pickable mesh                 |

## Related Resources

- [About Layer](../../../three/introduction/about-layer/) - Layer concepts and types
- [About Plugin](../../../three/introduction/about-plugin/) - Plugin system concepts
- [Plugin API](../../../three/core/plugin/) - How to implement plugins
- [three_default_layers](../../../three_default_layers/about/) - Default layer implementation examples
