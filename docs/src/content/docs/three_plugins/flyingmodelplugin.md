---
title: FlyingModelPlugin
description: Keyboard-driven GLTF model flight plugin for navara_three.
sidebar:
  order: 2
---

## Overview

`FlyingModelPlugin` loads a GLTF model onto the globe and lets the user fly it with keyboard controls. A chase camera follows the model with smooth interpolation. The plugin broadcasts position state on every frame, making it easy to build interactive UIs on top.

The plugin is model-agnostic — any animated GLTF with at least two animation clips (idle and dash) can be used.

## Usage

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { FlyingModelPlugin } from "@navara/three_plugins";

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
  modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
});

view.addPlugin(defaultPlugin);
view.addPlugin(flyingModel);
await view.init();

// Start the flight loop after initialization
flyingModel.start();

// Subscribe to position updates
const unsub = flyingModel.onStateChange((state) => {
  console.log(state.lat, state.lng, state.alt, state.heading);
});

// Teleport to a new position
flyingModel.teleport(139.77, 35.68, 300);

// Cleanup
unsub();
flyingModel.dispose();
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| W / S | Forward / backward |
| A / D | Turn left / right |
| Arrow Up / Down | Climb / descend |
| Shift | Dash (2.5x speed) |
| Alt | Orbit camera mode |

Keyboard input is automatically suppressed when focus is on `<input>`, `<textarea>`, or `contenteditable` elements. You can also set `flyingModel.movementSuppressed = true` to temporarily disable all movement keys (for example, while a modal dialog is open).

## Constructor

```typescript
new FlyingModelPlugin(config: FlyingModelConfig)
```

### FlyingModelConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `modelUrl` | `string` | **(required)** | URL of the GLTF model to load |
| `animation` | `AnimationConfig` | **(required)** | Animation clip configuration |
| `modelRotationOffset` | `ModelRotationOffset` | `{ x: 0, y: 0, z: 0 }` | Rotation offset to correct the model's default orientation |
| `flightSpeed` | `number` | `50` | Flight speed in m/s |
| `rotationSpeed` | `number` | `3` | Rotation speed in deg/frame |
| `altSpeed` | `number` | `30` | Altitude change speed in m/s |
| `minAlt` | `number` | `50` | Minimum altitude in meters |
| `maxAlt` | `number` | `5000` | Maximum altitude in meters |
| `modelScale` | `number` | `3` | Scale multiplier for the model |
| `cameraDistance` | `number` | `50` | Chase camera distance in meters |
| `cameraHeight` | `number` | `20` | Chase camera height offset in meters |
| `cameraLerpSpeed` | `number` | `3` | Camera rotation interpolation speed |
| `startLat` | `number` | `35.6812` | Starting latitude in degrees |
| `startLng` | `number` | `139.7671` | Starting longitude in degrees |
| `startHeight` | `number` | `500` | Starting altitude in meters |
| `startYaw` | `number` | `Math.PI * 1.3` | Starting heading in radians |

### AnimationConfig

| Property | Type | Description |
|----------|------|-------------|
| `idleClip` | `string` | Clip name played while the model is idle or moving normally |
| `dashClip` | `string` | Clip name played while the model is dashing (shift held) |
| `speed` | `number` | Playback speed multiplier |
| `crossfadeDuration` | `number` | Duration in seconds for cross-fade transitions between clips |

### ModelRotationOffset

| Property | Type | Description |
|----------|------|-------------|
| `x` | `number` | Rotation offset around the X axis (radians) |
| `y` | `number` | Rotation offset around the Y axis (radians) |
| `z` | `number` | Rotation offset around the Z axis (radians) |

## Methods

### start()

```typescript
start(): void
```

Loads the GLTF model and starts the flight animation loop. Must be called **after** `view.init()` completes.

### teleport(lng, lat, alt, heading?)

```typescript
teleport(lng: number, lat: number, alt: number, heading?: number): void
```

Instantly moves the model to a new geographic position. If `heading` is omitted, the current camera yaw is kept.

| Parameter | Type | Description |
|-----------|------|-------------|
| `lng` | `number` | Longitude in degrees |
| `lat` | `number` | Latitude in degrees |
| `alt` | `number` | Altitude in meters |
| `heading` | `number \| undefined` | Optional heading in degrees |

### getState()

```typescript
getState(): FlyingModelState
```

Returns the current flight state.

### onStateChange(fn)

```typescript
onStateChange(fn: (state: FlyingModelState) => void): () => void
```

Subscribes to position updates emitted on every animation frame. Returns an unsubscribe function.

### dispose()

```typescript
dispose(): void
```

Stops the animation loop, removes keyboard listeners, and deletes the model from the scene.

## FlyingModelState

The state object emitted by `onStateChange()`:

| Property | Type | Description |
|----------|------|-------------|
| `lng` | `number` | Current longitude in degrees |
| `lat` | `number` | Current latitude in degrees |
| `alt` | `number` | Current altitude in meters |
| `heading` | `number` | Current heading in degrees (0 = north, 90 = east) |
| `speed` | `number` | Current speed in m/s (0 when stationary) |
| `animationState` | `string` | Name of the currently playing animation clip |

## Related Resources

- [OverlayPlugin](../overlayplugin/) — Combine with FlyingModelPlugin for world-space HTML overlays
- [About three_plugins](../about/) — Package overview
