---
title: InstancedGltfModelMeshDesc
description: GPU-instanced GLTF model mesh descriptor for navara_three
sidebar:
  order: 107
---

The `InstancedGltfModelMeshDesc` class is a mesh descriptor that loads a single GLTF/GLB model and renders multiple transformed copies (instances) of it. It loads the GLTF once, then fans out every `Mesh` node into a sibling `InstancedMesh` sharing one per-instance matrix slot per model instance.

In addition to the properties below, the common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

The descriptor selects one of two internal rendering paths automatically based on the GLTF contents:

- **Non-skinned path (instanced):** every `Mesh` node becomes an `InstancedMesh`. All instances share one `AnimationMixer` running on the source scene; per-frame, each source mesh's `matrixWorld` is re-sampled and every instance's matrix is rewritten as `T_i * sourceLocal_s`. Node-TRS and morph-target animations both play back correctly.
- **Skinned path (per-instance clone fallback):** because three.js's `InstancedMesh` cannot apply skinning, skinned GLTFs fall back to one `SkeletonUtils.clone` per instance, each with its own `AnimationMixer`. This gives up instanced rendering for the skinned parts, but keeps the same desc API and plays shared clips in lockstep across clones.

The mesh uses Relative-To-Eye (RTE) precision, so it can be anchored anywhere on the globe without floating-point precision artifacts.

:::warning
Picking is only supported on the non-skinned path. On the skinned path, `batchIds` is empty.
:::

## Shared Properties (InstancedModelsDescription)

Specified in the `models` config object.

### url

**Type:** `string`

**Description:** URL of the GLTF/GLB model to load.

**Example:**

```typescript
{
  gltfModels: {
    url: "/models/tree.glb",
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the instances cast shadows.

**Default:** `false`

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the instances receive shadows.

**Default:** `false`

### animationActiveClip

**Type:** `string` (optional)

**Description:** Name of the animation clip to play. The clip is shared across all instances. The list of available clips is exposed via `handle.ref.animationClips` after the model loads.

### animationSpeed

**Type:** `number`

**Description:** Animation playback speed multiplier. Shared across all instances.

**Default:** `1`

### animationLoop

**Type:** `boolean`

**Description:** Whether the active animation clip loops.

**Default:** `true`

### animationAutoPlay

**Type:** `boolean`

**Description:** Auto-start the configured clip on load.

**Default:** `false`

## Per-Instance Properties (ModelChildConfig)

Properties for each individual model instance, specified in the `children` array. The transform is applied to every sub-mesh of that instance.

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local position relative to the parent group.

**Default:** `{ x: 0, y: 0, z: 0 }`

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local rotation (Euler angles in radians).

**Default:** `undefined`

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** Specifies the local scale.

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** Specifies a pre-computed transform matrix. When set, `position`, `rotation`, and `scale` are ignored.

**Default:** `undefined`

## Config

### pickable

**Type:** `boolean` (optional)

**Description:** Enables picking for individual instances. Only effective on the non-skinned path.

**Default:** `false`

## Events

Subscribe via `handle.on(event, handler)`.

### load

**Description:** Emitted when the GLTF has finished loading and instances are initialized.

**Handler Type:**

```typescript
() => void
```

### needsUpdate

**Description:** Emitted when the descriptor's instance state changes (add/remove/update/replace/clear).

**Handler Type:**

```typescript
() => void
```

## Instance Management

### handle.ref.add(config)

Adds a new instance. Returns the index of the added instance. Capacity grows automatically on the non-skinned path.

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  scale: { x: 2, y: 2, z: 2 },
});
```

### handle.ref.removeAt(index)

Removes an instance by index. Uses swap-with-last for O(1) removal; instance order is not preserved.

```typescript
handle.ref.removeAt(1);
```

### handle.ref.updateAt(index, config)

Updates an instance at the given index with partial config. Unset fields are preserved.

```typescript
handle.ref.updateAt(0, {
  position: { x: 50, y: 0, z: 0 },
});
```

### handle.ref.clear()

Removes all instances.

### handle.ref.replaceAll(configs)

Batch replaces all instances. More efficient than `clear()` + repeated `add()` since it emits a single update notification.

### handle.ref.count

Gets the number of active instances.

### handle.ref.animationClips

Read-only list of animation clip names found in the loaded GLTF. Empty until the `load` event fires.

```typescript
handle.on("load", () => {
  console.log("Available clips:", handle.ref.animationClips);
});
```

### handle.ref.playAnimation(name)

Plays the named animation clip on all instances. On the non-skinned path, all instances play in lockstep from a single mixer; on the skinned path, each clone plays its own copy of the same clip.

```typescript
handle.ref.playAnimation("Fly");
```

### handle.ref.stopAnimation()

Stops the currently playing animation on all instances.

## Usage Examples

### Basic Usage

```typescript
import ThreeView from "@navara/three";
import { InstancedGltfModelMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("gltfModels", InstancedGltfModelMeshDesc);
await view.init();

const handle = view.addMesh<InstancedGltfModelMeshDesc>({
  gltfModels: {
    url: "/models/tree.glb",
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 50, y: 0, z: 0 }, scale: { x: 1.5, y: 1.5, z: 1.5 } },
      { position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 4, z: 0 } },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```

### Animated Skinned Model

```typescript
const handle = view.addMesh<InstancedGltfModelMeshDesc>({
  gltfModels: {
    url: "/glTF/animated_bird_pigeon/scene.gltf",
    animationActiveClip: "Fly",
    animationSpeed: 1.5,
    animationLoop: true,
    animationAutoPlay: true,
    children: [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 20, y: 0, z: 0 } },
      { position: { x: 40, y: 0, z: 0 } },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});

handle.on("load", () => {
  console.log("Clips:", handle.ref.animationClips);
});
```

### Dynamic Animation Control

```typescript
// Switch clips at runtime
handle.ref.playAnimation("Walk");

// Stop all animation
handle.ref.stopAnimation();

// Add a new instance while animation is playing
handle.ref.add({ position: { x: 60, y: 0, z: 0 } });
```
