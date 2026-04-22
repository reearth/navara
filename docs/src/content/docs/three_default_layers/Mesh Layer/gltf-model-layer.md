---
title: GLTFModelDesc
description: GLTF model layer for navara_three
sidebar:
  order: 113
---

The `GLTFModelDesc` class is a mesh descriptor for loading and displaying GLTF/GLB format 3D models. It provides features such as animation playback, shadow settings, and dynamic updates.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-layer-base) for details.

## Properties

### url

**Type:** `string`

**Description:** Specifies the URL of the GLTF/GLB file to load. This is a required parameter.

**Example:**

```typescript
{
  gltfModel: {
    url: "https://example.com/models/character.glb",
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** Specifies whether the model casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** Specifies whether the model receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    receiveShadow: true,
  }
}
```

### animationEnabled

**Type:** `boolean`

**Description:** Specifies whether to enable animation.

**Example:**

```typescript
{
  gltfModel: {
    animationEnabled: true,
  }
}
```

### animationClips

**Type:** `string[]`

**Description:** Specifies the list of available animation clip names. Used as read-only information.

**Example:**

```typescript
{
  gltfModel: {
    animationClips: ["Walk", "Run", "Jump"],
  }
}
```

### animationActiveClip

**Type:** `string`

**Description:** Specifies the currently active animation clip name.

**Example:**

```typescript
{
  gltfModel: {
    animationActiveClip: "Walk",
  }
}
```

### animationSpeed

**Type:** `number`

**Description:** Specifies the animation playback speed. 1.0 is normal speed.

**Default:** `1.0`

**Example:**

```typescript
{
  gltfModel: {
    animationSpeed: 1.5, // 1.5x speed
  }
}
```

### animationLoop

**Type:** `boolean`

**Description:** Specifies whether to loop the animation playback.

**Default:** `true`

**Example:**

```typescript
{
  gltfModel: {
    animationLoop: true,
  }
}
```

### animationCrossfadeDuration

**Type:** `number`

**Description:** Specifies the crossfade duration in seconds when switching animations.

**Default:** `0.3`

**Example:**

```typescript
{
  gltfModel: {
    animationCrossfadeDuration: 0.5, // 0.5 seconds
  }
}
```

### animationAutoPlay

**Type:** `boolean`

**Description:** Specifies whether to automatically play the animation after the model is loaded.

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    animationAutoPlay: true,
  }
}
```

## Methods

### getAnimationAvailable()

**Description:** Gets an array of available animation clip names.

**Returns:**

An array of available animation clip names

**Example:**

```typescript
const clips = modelLayer.getAnimationAvailable();
console.log(clips); // ["Walk", "Run", "Jump"]
```

### getAnimationDetails(name?: string)

**Description:** Gets detailed information about animations. If a name is specified, returns details for that specific animation; otherwise, returns details for all animations.

**Parameters:**

- `name`: A specific animation name

**Returns:**

Animation detail information

**Example:**

```typescript
const details = modelLayer.getAnimationDetails("Walk");
console.log(details);
// { name: "Walk", duration: 2.5, tracks: 45, isLooping: true, timeScale: 1.0 }
```

### getAnimationCurrentState()

**Description:** Gets the current animation playback state.

**Returns:**

The current animation playback state

**Example:**

```typescript
const state = modelLayer.getAnimationCurrentState();
console.log(state);
// {
//   isPlaying: true,
//   currentAnimation: "Walk",
//   isBlendMode: false,
//   blendAnimations: [],
//   playbackTime: 1.23,
//   progress: 0.492
// }
```

### playAnimation(name: string)

**Description:** Plays the specified animation. Returns true if successful.

**Parameters:**

- `name`: The animation clip name to play

**Returns:**

true if successful

**Example:**

```typescript
modelLayer.playAnimation("Run");
```

### crossFadeAnimation(from: string, to: string, duration: number)

**Description:** Performs a crossfade between two animations.

**Parameters:**

- `from`: The source animation clip name
- `to`: The target animation clip name
- `duration`: The crossfade duration (seconds)

**Returns:**

true if successful

**Example:**

```typescript
modelLayer.crossFadeAnimation("Walk", "Run", 0.5);
```

### blendAnimations(animations: { name: string, weight: number }[])

**Description:** Blends and plays multiple animations simultaneously.

**Parameters:**

- `animations`: An array of animation names and weights

**Example:**

```typescript
modelLayer.blendAnimations([
  { name: "Walk", weight: 0.7 },
  { name: "Run", weight: 0.3 }
]);
```

### stopAnimation()

**Description:** Stops the currently playing animation.

**Example:**

```typescript
modelLayer.stopAnimation();
```

### pauseAnimation()

**Description:** Pauses the currently playing animation.

**Example:**

```typescript
modelLayer.pauseAnimation();
```

### resumeAnimation()

**Description:** Resumes a paused animation.

**Example:**

```typescript
modelLayer.resumeAnimation();
```

### setAnimationSpeed(speed: number)

**Description:** Sets the animation playback speed.

**Parameters:**

- `speed`: Animation speed (1.0 is normal speed)

**Example:**

```typescript
modelLayer.setAnimationSpeed(2.0); // 2x speed
```

### setAnimationLoop(loop: boolean)

**Description:** Changes the animation loop setting.

**Parameters:**

- `loop`: Enable/disable loop playback

**Example:**

```typescript
modelLayer.setAnimationLoop(false);
```

### setAnimationWeight(name: string, weight: number)

**Description:** Sets the weight of a specific animation.

**Parameters:**

- `name`: The animation clip name
- `weight`: Weight (0.0-1.0)

**Example:**

```typescript
modelLayer.setAnimationWeight("Walk", 0.5);
```

## Events

### load

**Description:** Fired when the model loading is complete.

**Example:**

```typescript
modelLayer.on("load", () => {
  console.log("Model loaded!");
});
```

### animationReady

**Description:** Fired when animation initialization is complete.

**Example:**

```typescript
modelLayer.on("animationReady", () => {
  console.log("Animations ready!");
  const clips = modelLayer.getAnimationAvailable();
  console.log("Available clips:", clips);
});
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { GLTFModelDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a GLTFModelDesc
const modelLayer = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/character.glb",
    castShadow: true,
    receiveShadow: true,
  },
  position: { x: 0, y: 0, z: 0 },
});
```

### Animated Model

```typescript
const animatedModel = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/animated.glb",
    castShadow: true,
    receiveShadow: true,
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
  },
});

// Switch animation after model loads
animatedModel.ref.on("animationReady", () => {
  setTimeout(() => {
    animatedModel.ref.crossFadeAnimation("Idle", "Walk", 0.5);
  }, 2000);
});
```

### Blending Multiple Animations

```typescript
const blendedModel = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/character.glb",
    animationEnabled: true,
  },
});

blendedModel.ref.on("animationReady", () => {
  // Blend walk and run
  blendedModel.ref.blendAnimations([
    { name: "Walk", weight: 0.6 },
    { name: "Run", weight: 0.4 },
  ]);
});
```

### Dynamic Model Update

```typescript
// Change the URL to reload the model
modelLayer.update({
  gltfModel: {
    url: "https://example.com/models/new-model.glb",
  },
});

// Change the animation speed
modelLayer.update({
  gltfModel: {
    animationSpeed: 2.0,
  },
});
```
