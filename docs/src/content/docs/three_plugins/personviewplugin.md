---
title: PersonViewPlugin
description: Keyboard-driven first/third-person view controller for navara_three.
sidebar:
  order: 2
---

## Overview

`PersonViewPlugin` is a keyboard-driven first-/third-person view controller. It drives a virtual position on the globe and runs a chase camera (TPV) or first-person camera (FPV) that follows it. Optionally, you can attach a GLTF character: the plugin will load it, drive its position and heading, and cross-fade between an idle and a dash animation clip.

The character is optional. When omitted, the plugin still drives the virtual position and the camera follows it, which is useful as a pure person-view camera controller for scenes that already have their own avatar or for empty-world fly-throughs.

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
| Shift             | Dash (× `dashSpeedMultiplier`, default 2.5. Switches to `dashClip`) |
| Alt (hold)        | Free-orbit camera (TPV) / free-look (FPV)                           |
| V                 | Toggle TPV / FPV                                                    |

All bindings can be remapped via the `keys` option (see [KeyBindings](#keybindings)). Ascend and descend have no effect while terrain collision runs in `"ground"` mode, where the terrain drives the altitude. See [Terrain Collision](#terrain-collision).

Keyboard input is automatically suppressed when focus is on `<input>`, `<textarea>`, or `contenteditable` elements. You can also set `personView.movementSuppressed = true` to temporarily disable all movement keys (for example, while a modal dialog is open).

## Camera Behavior

The camera operates in one of two modes:

- **TPV (third-person view)**: Chase camera positioned behind and above the character, smoothly interpolating its heading toward the character's heading.
- **FPV (first-person view)**: Camera placed at the character's eye, looking forward along the heading. The character mesh is hidden by default in FPV (configurable via `character.hideModelInFpv`).

Press **V** (or call `toggleViewMode()`) to switch. Hold **Alt** to take manual control of the camera: in TPV the camera orbits around the character. In FPV the camera stays planted at the eye and mouse drag rotates the view direction in place (free-look). Set `allowCameraControl: true` in the config to make the camera always free without needing Alt.

After releasing Alt, the camera **keeps the orientation** you left it at, which is useful for dwelling at a custom angle. The free-camera state stays active until you press any movement key (forward/backward/turn/ascend/descend), at which point the camera snaps back to its default chase or FPV position. Dash and `V` do not exit the free-camera state.

## Terrain Collision

By default the character flies: its altitude comes from the ascend and descend keys alone, and the terrain surface is ignored. The `collision` option ties it to the ground instead, sampling the terrain height under the character every frame.

```typescript
const personView = new PersonViewPlugin({
  character: {
    /* ... */
  },
  collision: { mode: "ground" },
});

// Switch back to free flight at runtime
personView.setCollision({ mode: "off" });
```

`mode` is the only field most scenes need: the remaining defaults are tuned for walking real terrain, and the plugin handles the terrain loading described below on its own. Give `startHeight` a value near the terrain at `startLat` / `startLng`, or skip the hand-measuring and call [`resolveStartHeight()`](#resolvestartheightsource) before `start()`.

There are three modes:

- **`"off"`** (default): the terrain is ignored and the character flies freely.
- **`"clamp"`**: the character still flies, but the terrain acts as a floor and pushes it up whenever it would sink below the surface. Use it for a flying character that must not pass through the ground.
- **`"ground"`**: the character is glued to the surface, so it walks up and down slopes and can climb a mountain on foot. The ascend and descend keys do nothing in this mode, and the `minAlt` / `maxAlt` limits no longer apply because the terrain sets the altitude.

`groundOffset` lifts the character above the sampled surface, for models whose origin is not at their feet. `alignToSlope` (on by default) tilts the character to match the ground it stands on, and fades back to upright as a `"clamp"` mode character climbs away from the terrain.

### Terrain that loads while you walk on it

A spot whose terrain tiles have not loaded yet returns no height, and collision then leaves the altitude alone until the data arrives. The character never drops to sea level while it waits. Once tiles do arrive they keep being replaced by finer ones, which moves the surface under a character who has not gone anywhere, by hundreds of meters right after load. The plugin bounds how fast the character follows that: it falls onto the surface rather than chasing it, so a second of tile churn moves it a few meters while a surface that turns out to be hundreds of meters out is still reached in seconds. Measured at the example's start point, that is a drift of a few meters against jumps of 300 m and 545 m. The slope tilt is bounded the same way, and for the same reason: without it a single frame swings the character by 13°.

There is nothing to configure here. Ground the character *walks* onto is never bounded, so slopes are followed exactly even in a full-speed dash uphill, and a teleport lands outright.

### Keeping the tilt steady

Terrain height is continuous across a triangle mesh but its slope is not, so the tilt from `alignToSlope` can step at triangle edges. `slopeSampleDistance` is the footprint the slope is averaged over. The default suits the triangle spacing terrain meshes arrive at, so a single edge cannot swing the whole character. Raise it for a larger character or a coarser terrain source. `maxSlopeTilt` caps the lean, since matching a near-vertical face exactly would lay the character flat against it.

### Keeping the view out of the hillside

A fixed `cameraPitch` hugs a horizontal plane, which the ground stops resembling on a steep slope: climbing one leaves the camera staring into the hillside with nothing of where the character is going. `cameraSlopeFollow` tilts the view with the slope instead (looking up a climb and down a descent) for the third-person camera and the first-person eye line alike. `1` (the default) runs parallel to the slope and `0` restores the fixed pitch. Ground far steeper than anything walkable stops swinging the view at 45°.

## Constructor

```typescript
new PersonViewPlugin(config?: PersonViewConfig)
```

### PersonViewConfig

| Property              | Type              | Default         | Description                                                                                                  |
| --------------------- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `character`           | `CharacterConfig` | _(none)_        | Optional character. When omitted, the plugin runs as a pure camera controller.                               |
| `collision`           | `CollisionConfig` | _(off)_         | Terrain collision. See [CollisionConfig](#collisionconfig).                                                 |
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
| `keys`                | `KeyBindings`     | _defaults_      | Keyboard bindings. See [KeyBindings](#keybindings).                                                         |

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

### CollisionConfig

See [Terrain Collision](#terrain-collision) for how the modes behave.

| Property              | Type                              | Default | Description                                                                                                                     |
| --------------------- | --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                | `"off" \| "clamp" \| "ground"`    | `"off"` | How the altitude reacts to the terrain: ignore it, treat it as a floor, or stick to it.                                          |
| `groundOffset`        | `number`                          | `0`     | Height (m) kept above the sampled surface: the character's feet in `"ground"` mode, the floor it cannot sink below in `"clamp"`. |
| `alignToSlope`        | `boolean`                         | `true`  | Tilt the character to match the slope it stands on. Costs several extra terrain lookups per frame.                              |
| `slopeSampleDistance` | `number`                          | `4`     | Footprint (m) the slope is averaged over, matched to the triangle spacing of terrain meshes.                                    |
| `maxSlopeTilt`        | `number`                          | `π / 4` | Largest tilt (radians) `alignToSlope` may apply, so near-vertical ground does not lay the character flat against it.            |
| `cameraSlopeFollow`   | `number`                          | `1`     | How much of the terrain's slope the camera pitch follows, from `0` (fixed pitch) to `1` (parallel to the slope). Applies to TPV and FPV. |

### AnimationConfig

| Property            | Type      | Description                                                                                                                |
| ------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `idleClip`          | `string`  | Clip played while the model is idle (no movement keys held).                                                               |
| `walkClip`          | `string?` | Clip played while the model is moving without dashing. Omit to keep `idleClip` running (useful for idle+dash-only models). |
| `dashClip`          | `string`  | Clip played while the model is dashing (dash key held).                                                                    |
| `speed`     | `number?` | Playback speed for any clip without a per-clip override below. Defaults to `1`. |
| `idleSpeed` | `number?` | Playback speed for the idle clip. Falls back to `speed` (default `1`).         |
| `walkSpeed` | `number?` | Playback speed for the walk clip. Falls back to `speed` (default `1`).         |
| `dashSpeed` | `number?` | Playback speed for the dash clip. Falls back to `speed` (default `1`).         |
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

### resolveStartHeight(source)

```typescript
resolveStartHeight(source: string | Source): Promise<number | undefined>
```

Pins `startHeight` to the terrain surface at the start position, sampled from the source's most detailed data via `ThreeView.sampleTerrainMostDetailed`. [`start()`](#start) then places the character on the ground at a dynamically resolved `startHeight`. Call it before `start()`.

```typescript
// terrain is a registered quantized-mesh or raster-dem source
await personView.resolveStartHeight(terrain);
personView.start();
```

The resolved height is **held until the first movement input** (or a [`teleport()`](#teleportoptions)): the tiles resident right after load are coarse, and following them would pull the character tens of meters off it. The first movement key hands the altitude over to the normal [terrain following](#terrain-that-loads-while-you-walk-on-it).

Returns the height used, including the collision's `groundOffset`, or `undefined` when the source has no data at the start position (the configured `startHeight` is then kept).

### start()

```typescript
start(): void
```

Loads the GLTF model (when configured), takes over the camera and starts reading the movement keys. Must be called **after** `view.init()` completes. Calling it again after [`stop()`](#stop) resumes from wherever the character was left, rather than returning to the configured start position.

### stop()

```typescript
stop(): void
```

The counterpart to `start()`: hands the camera back to the view's own controls and stops reading the movement keys, leaving the character standing where it is. Use it to step out of person view temporarily (for a map overview, a cutscene, or a UI mode) and call `start()` to take control back.

```typescript
overviewButton.addEventListener("click", () => {
  personView.stop();
  view.setCamera({ lng, lat, height: 20000, distance: 0, heading: 0, pitch: -Math.PI / 2, roll: 0 });
});
resumeButton.addEventListener("click", () => personView.start());
```

Use [`dispose()`](#dispose) instead to tear the plugin down for good.

### teleport(options)

```typescript
teleport(options: {
  lng: number;
  lat: number;
  alt: number;
  heading?: number;
}): void
```

Instantly moves to a new geographic position. When `heading` is omitted, the current camera heading is kept. With [terrain collision](#terrain-collision) enabled, the character lands on the terrain at the destination right away. Settling never delays a teleport. To rotate in place without moving, use [`setHeading()`](#setheadingradians--getheading). For the camera pitch, use [`setCameraPitch()` / `setFpvPitch()`](#setcamerapitchradians--setfpvpitchradians).

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

Rotates the character to the given heading in radians (0 = north, increasing clockwise) **without changing position**. The chase camera snaps to match. In free-camera mode only the model rotates. `getHeading()` returns the current heading.

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

Set the **base** animation playback speed, the fallback used by any clip without a per-clip override (`idleSpeed` / `walkSpeed` / `dashSpeed` on [`AnimationConfig`](#animationconfig)). It takes effect immediately, re-applying to the clip currently playing. `getAnimationSpeed()` returns the current base speed.

Per-clip speeds let the idle, walk, and dash animations play at independent rates (for example, a calm idle next to a brisk run) while `speed` covers the rest:

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

The loaded character model's mesh handle, or `null` before [`start()`](#start) has loaded it (or when no character is configured). Its `ref` is the `GLTFModelDesc`. Reach the model itself through it, for example `model.ref.raw` for the underlying three.js object, or `model.ref.getWorldPosition()`.

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

### setCollision(collision) / getCollision()

```typescript
setCollision(collision: CollisionConfig): void
getCollision(): Readonly<Required<CollisionConfig>>
```

Update the terrain collision settings at runtime. Only the given fields change, so `setCollision({ mode: "ground" })` leaves the settle speed and slope options as they were. `getCollision()` returns the fully resolved settings.

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

Tears the plugin down for good: stops the loop, removes the keyboard listeners, and deletes the character (when one was configured). To step out of person view temporarily, use [`stop()`](#stop) instead.

## PersonViewState

The state object emitted by `onStateChange()`:

| Property         | Type             | Description                                                                                                        |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lng`            | `number`         | Current longitude in degrees.                                                                                      |
| `lat`            | `number`         | Current latitude in degrees.                                                                                       |
| `alt`            | `number`         | Current altitude in meters.                                                                                        |
| `heading`        | `number`         | Current heading in radians (0 = north, increasing clockwise).                                                      |
| `speed`          | `number`         | Configured movement speed in m/s (`moveSpeed`, multiplied by `dashSpeedMultiplier`, default 2.5, while dashing). |
| `animationState` | `string \| null` | Name of the currently playing clip. `null` when no character.                                                      |
| `mode`           | `"tpv" \| "fpv"` | Current view mode.                                                                                                 |

## Related Resources

- [Interior Explore Tutorial](../../three/tutorial/interior-explore/): Walks through using `PersonViewPlugin` inside a 3D Tiles building
- [OverlayPlugin](../overlayplugin/): Combine with `PersonViewPlugin` for world-space HTML overlays
- [About three_plugins](../about/): Package overview
