---
title: PersonViewPlugin
description: Keyboard-driven first/third-person view controller for navara_three.
sidebar:
  order: 2
---

## Overview

`PersonViewPlugin` is a keyboard-driven first-/third-person view controller. It drives a virtual position on the globe and runs a chase camera (TPV) or first-person camera (FPV) that follows it. Optionally, you can attach a GLTF character: the plugin will load it, drive its position and heading, and cross-fade between an idle and a dash animation clip.

The character is optional. When omitted, the plugin still drives the virtual position and the camera follows it — useful as a pure person-view camera controller for scenes that already have their own avatar or for empty-world fly-throughs.

The plugin broadcasts its position, heading, speed, and current view mode on every frame, making it easy to build HUDs and other UI on top.

## Usage

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { PersonViewPlugin } from "@navaramap/three-plugins";

const view = new ThreeView({ container, animation: true });
const defaultPlugin = new DefaultPlugin();
const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/bird/scene.gltf",
    animation: {
      idleClip: "Gliding",
      dashClip: "Flapping",
      speed: 1.0,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
  },
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
});

view.addPlugin(defaultPlugin);
view.addPlugin(personView);
await view.init();

// Start the per-frame loop after initialization
personView.start();

// Subscribe to state updates
const unsub = personView.onStateChange((state) => {
  console.log(state.lat, state.lng, state.alt, state.heading, state.mode);
});

// Teleport to a new position
personView.teleport({ lng: 139.77, lat: 35.68, alt: 300 });

// Toggle between third-person and first-person view
personView.toggleViewMode();

// Cleanup
unsub();
personView.dispose();
```

## Keyboard Controls

| Key               | Action                                                              |
| ----------------- | ------------------------------------------------------------------- |
| W / S             | Forward / backward                                                  |
| A / D             | Turn left / right                                                   |
| Arrow Up / Space  | Ascend                                                              |
| Arrow Down / Ctrl | Descend                                                             |
| Shift             | Dash (× `dashSpeedMultiplier`, default 2.5; switches to `dashClip`) |
| Alt (hold)        | Free-orbit camera (TPV) / free-look (FPV)                           |
| V                 | Toggle TPV / FPV                                                    |

All bindings can be remapped via the `keys` option (see [KeyBindings](#keybindings)).

Keyboard input is automatically suppressed when focus is on `<input>`, `<textarea>`, or `contenteditable` elements. You can also set `personView.movementSuppressed = true` to temporarily disable all movement keys — for example, while a modal dialog is open.

## Camera Behavior

The camera operates in one of two modes:

- **TPV (third-person view)** — Chase camera positioned behind and above the character, smoothly interpolating its heading toward the character's heading.
- **FPV (first-person view)** — Camera placed at the character's eye, looking forward along the heading. The character mesh is hidden by default in FPV (configurable via `character.hideModelInFpv`).

Press **V** (or call `toggleViewMode()`) to switch. Hold **Alt** to take manual control of the camera: in TPV the camera orbits around the character; in FPV the camera stays planted at the eye and mouse drag rotates the view direction in place (free-look). Set `allowCameraControl: true` in the config to make the camera always free without needing Alt.

After releasing Alt, the camera **keeps the orientation** you left it at — useful for dwelling at a custom angle. The free-camera state stays active until you press any movement key (forward/backward/turn/ascend/descend), at which point the camera snaps back to its default chase or FPV position. Dash and `V` do not exit the free-camera state.

## Constructor

```typescript
new PersonViewPlugin(config?: PersonViewConfig)
```

### PersonViewConfig

| Property              | Type              | Default         | Description                                                                                                  |
| --------------------- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `character`           | `CharacterConfig` | _(none)_        | Optional character. When omitted, the plugin runs as a pure camera controller.                               |
| `allowCameraControl`  | `boolean`         | `false`         | When `true`, the camera is always free (no Alt-hold required).                                               |
| `initialView`         | `"tpv" \| "fpv"`  | `"tpv"`         | Initial view mode.                                                                                           |
| `moveSpeed`           | `number`          | `50`            | Forward/backward speed in m/s.                                                                               |
| `rotationSpeed`       | `number`          | `3`             | Turning speed in deg/frame.                                                                                  |
| `altSpeed`            | `number`          | `30`            | Altitude change speed in m/s.                                                                                |
| `dashSpeedMultiplier` | `number`          | `2.5`           | Factor applied to `moveSpeed` while the dash key is held.                                                    |
| `minAlt`              | `number`          | `50`            | Minimum altitude in meters.                                                                                  |
| `maxAlt`              | `number`          | `5000`          | Maximum altitude in meters.                                                                                  |
| `cameraDistance`      | `number`          | `50`            | Chase camera distance (TPV) in meters.                                                                       |
| `cameraPitch`         | `number`          | `0`             | Downward TPV camera pitch in radians (orbits up and over the model).                                         |
| `cameraLerpSpeed`     | `number`          | `3`             | Camera heading interpolation speed.                                                                          |
| `fpvForwardOffset`    | `number`          | `0`             | Forward offset (m) applied to the FPV eye position.                                                          |
| `fpvHeightOffset`     | `number`          | `1`             | Eye-line height offset (m): the FPV eye height, and the shared eye-line height the TPV camera orbits around. |
| `fpvPitch`            | `number`          | `0`             | Downward FPV camera pitch in radians (tilts the view down in place).                                         |
| `startLat`            | `number`          | `35.6812`       | Starting latitude in degrees.                                                                                |
| `startLng`            | `number`          | `139.7671`      | Starting longitude in degrees.                                                                               |
| `startHeight`         | `number`          | `500`           | Starting altitude in meters.                                                                                 |
| `startHeading`        | `number`          | `Math.PI * 1.3` | Starting heading in radians (0 = north).                                                                     |
| `keys`                | `KeyBindings`     | _defaults_      | Keyboard bindings — see [KeyBindings](#keybindings).                                                         |

### CharacterConfig

| Property              | Type                  | Default                | Description                                                 |
| --------------------- | --------------------- | ---------------------- | ----------------------------------------------------------- |
| `modelUrl`            | `string`              | **(required)**         | URL of the GLTF model to load.                              |
| `animation`           | `AnimationConfig`     | **(required)**         | Animation clip configuration.                               |
| `modelRotationOffset` | `ModelRotationOffset` | `{ x: 0, y: 0, z: 0 }` | Rotation offset to correct the model's default orientation. |
| `modelScale`          | `number`              | `3`                    | Uniform scale multiplier for the model.                     |
| `hideModelInFpv`      | `boolean`             | `true`                 | Hide the model while the camera is in FPV.                  |
| `castShadow`          | `boolean`             | `false`                | Whether the character casts shadows.                        |
| `receiveShadow`       | `boolean`             | `false`                | Whether the character receives shadows.                     |

### AnimationConfig

| Property            | Type      | Description                                                                                                                |
| ------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `idleClip`          | `string`  | Clip played while the model is idle (no movement keys held).                                                               |
| `walkClip`          | `string?` | Clip played while the model is moving without dashing. Omit to keep `idleClip` running — useful for idle+dash-only models. |
| `dashClip`          | `string`  | Clip played while the model is dashing (dash key held).                                                                    |
| `speed`             | `number`  | Playback speed for any clip without a per-clip override below.                                                             |
| `idleSpeed`         | `number?` | Playback speed for the idle clip. Falls back to `speed`.                                                                   |
| `walkSpeed`         | `number?` | Playback speed for the walk clip. Falls back to `speed`.                                                                   |
| `dashSpeed`         | `number?` | Playback speed for the dash clip. Falls back to `speed`.                                                                   |
| `crossfadeDuration` | `number`  | Duration in seconds for cross-fade transitions between clips.                                                              |

### ModelRotationOffset

| Property | Type     | Description                                  |
| -------- | -------- | -------------------------------------------- |
| `x`      | `number` | Rotation offset around the X axis (radians). |
| `y`      | `number` | Rotation offset around the Y axis (radians). |
| `z`      | `number` | Rotation offset around the Z axis (radians). |

### KeyBindings

Each entry takes an array of `KeyboardEvent.code` values (e.g. `["KeyW"]`, `["ArrowUp", "ControlLeft"]`) so multiple keys can trigger the same action.

| Property      | Type       | Default                                        | Description                                                                                                                                    |
| ------------- | ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `forward`     | `string[]` | `["KeyW"]`                                     | Move forward.                                                                                                                                  |
| `backward`    | `string[]` | `["KeyS"]`                                     | Move backward.                                                                                                                                 |
| `turnLeft`    | `string[]` | `["KeyA"]`                                     | Turn left.                                                                                                                                     |
| `turnRight`   | `string[]` | `["KeyD"]`                                     | Turn right.                                                                                                                                    |
| `ascend`      | `string[]` | `["ArrowUp", "Space"]`                         | Climb.                                                                                                                                         |
| `descend`     | `string[]` | `["ArrowDown", "ControlLeft", "ControlRight"]` | Descend.                                                                                                                                       |
| `dash`        | `string[]` | `["ShiftLeft", "ShiftRight"]`                  | Hold to dash.                                                                                                                                  |
| `orbitCamera` | `string[]` | `["AltLeft", "AltRight"]`                      | Hold to enable free camera (orbit in TPV / free-look in FPV). After release, the camera keeps its orientation until a movement key is pressed. |
| `toggleView`  | `string[]` | `["KeyV"]`                                     | Toggle TPV / FPV.                                                                                                                              |

## Methods

### start()

```typescript
start(): void
```

Loads the GLTF model (when configured) and starts the per-frame update loop. Must be called **after** `view.init()` completes.

### teleport(options)

```typescript
teleport(options: {
  lng: number;
  lat: number;
  alt: number;
  heading?: number;
}): void
```

Instantly moves to a new geographic position. When `heading` is omitted, the current camera heading is kept. To rotate in place without moving, use [`setHeading()`](#setheadingradians--getheading); for the camera pitch, use [`setCameraPitch()` / `setFpvPitch()`](#setcamerapitchradians--setfpvpitchradians).

| Field     | Type                  | Description                                                    |
| --------- | --------------------- | -------------------------------------------------------------- |
| `lng`     | `number`              | Longitude in degrees.                                          |
| `lat`     | `number`              | Latitude in degrees.                                           |
| `alt`     | `number`              | Altitude in meters.                                            |
| `heading` | `number \| undefined` | Optional heading in radians (0 = north, increasing clockwise). |

### setHeading(radians) / getHeading()

```typescript
setHeading(radians: number): void
getHeading(): number
```

Rotates the character to the given heading in radians (0 = north, increasing clockwise) **without changing position**. The chase camera snaps to match; in free-camera mode only the model rotates. `getHeading()` returns the current heading.

### setCameraPitch(radians) / setFpvPitch(radians)

```typescript
setCameraPitch(radians: number): void
getCameraPitch(): number
setFpvPitch(radians: number): void
getFpvPitch(): number
```

Set the downward camera pitch in radians, taking effect immediately for the chase / locked camera. `setCameraPitch` controls the **TPV** pitch (orbits the camera up and over the model), while `setFpvPitch` controls the **FPV** pitch (tilts the view down in place). The matching getters return the current values.

### setFpvHeightOffset(meters) / getFpvHeightOffset()

```typescript
setFpvHeightOffset(meters: number): void
getFpvHeightOffset(): number
```

Set the eye-line height offset in meters, taking effect immediately for the chase / locked camera. It is the FPV eye height and the shared eye-line height the TPV camera orbits around and aims at. `getFpvHeightOffset()` returns the current value.

### setAnimationSpeed(speed) / getAnimationSpeed()

```typescript
setAnimationSpeed(speed: number): void
getAnimationSpeed(): number
```

Set the **base** animation playback speed — the fallback used by any clip without a per-clip override (`idleSpeed` / `walkSpeed` / `dashSpeed` on [`AnimationConfig`](#animationconfig)). It takes effect immediately, re-applying to the clip currently playing. `getAnimationSpeed()` returns the current base speed.

Per-clip speeds let the idle, walk, and dash animations play at independent rates — for example, a calm idle next to a brisk run — while `speed` covers the rest:

```typescript
const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/Fox/Fox.glb",
    animation: {
      idleClip: "Survey",
      walkClip: "Walk",
      dashClip: "Run",
      speed: 1,
      idleSpeed: 0.6, // slow, relaxed idle
      dashSpeed: 1.8, // faster run cycle when dashing
      crossfadeDuration: 0.3,
    },
  },
  // ...
});
```

### model (getter)

```typescript
get model(): MeshHandle<GLTFModelDesc> | null
```

The loaded character model's mesh handle, or `null` before [`start()`](#start) has loaded it (or when no character is configured). Its `ref` is the `GLTFModelDesc` — reach the model itself through it, for example `model.ref.raw` for the underlying three.js object, or `model.ref.getWorldPosition()`.

### setViewMode(mode) / toggleViewMode()

```typescript
setViewMode(mode: "tpv" | "fpv"): void
toggleViewMode(): void
```

Switch the camera between third-person and first-person view.

### setAllowCameraControl(value)

```typescript
setAllowCameraControl(value: boolean): void
```

Enable or disable always-free camera at runtime. The Alt-hold behavior still works regardless.

### getState()

```typescript
getState(): PersonViewState
```

Returns the current view state.

### onStateChange(fn)

```typescript
onStateChange(fn: (state: PersonViewState) => void): () => void
```

Subscribes to state updates emitted on every animation frame. Returns an unsubscribe function.

### onAction(fn)

```typescript
onAction(fn: (action: PersonViewAction) => void): () => void
```

Subscribes to control-input events, firing once per keypress of any bound action. Useful, for example, to dismiss an on-screen controls hint the moment the user starts driving the character. Returns an unsubscribe function.

`PersonViewAction` is one of `"forward" | "backward" | "turnLeft" | "turnRight" | "ascend" | "descend" | "dash" | "orbitCamera" | "toggleView"`.

### dispose()

```typescript
dispose(): void
```

Stops the animation loop, removes keyboard listeners, and deletes the character (when one was configured).

## PersonViewState

The state object emitted by `onStateChange()`:

| Property         | Type             | Description                                                                                                        |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lng`            | `number`         | Current longitude in degrees.                                                                                      |
| `lat`            | `number`         | Current latitude in degrees.                                                                                       |
| `alt`            | `number`         | Current altitude in meters.                                                                                        |
| `heading`        | `number`         | Current heading in radians (0 = north, increasing clockwise).                                                      |
| `speed`          | `number`         | Configured movement speed in m/s (`moveSpeed`, multiplied by `dashSpeedMultiplier` — default 2.5 — while dashing). |
| `animationState` | `string \| null` | Name of the currently playing clip; `null` when no character.                                                      |
| `mode`           | `"tpv" \| "fpv"` | Current view mode.                                                                                                 |

## Related Resources

- [Interior Explore Tutorial](../../three/tutorial/interior-explore/) — Walks through using `PersonViewPlugin` inside a 3D Tiles building
- [OverlayPlugin](../overlayplugin/) — Combine with `PersonViewPlugin` for world-space HTML overlays
- [About three_plugins](../about/) — Package overview
