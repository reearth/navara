---
title: Atmosphere Class
description: API reference for the Atmosphere class that manages the atmospheric system and sun/moon position calculations
sidebar:
  order: 20
---

The `Atmosphere` class manages the context for atmospheric rendering. It automatically calculates the positions of the sun and moon from the configured date and time, and manages textures for atmospheric scattering simulation.

A `ThreeView` instance holds an instance of this class through the `atmosphere` property, and atmosphere-related layers such as `SunLightLayer`, `SkyMeshLayer`, and `AerialPerspectiveEffectLayer` reference this instance to operate.

## Basic Usage

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView({
  atmosphere: {
    date: new Date("2024-06-21T12:00:00"),
  },
});

await view.init();

// Change the date to update the sun position
view.atmosphere.date = new Date("2024-12-21T18:00:00");

// Get the sun direction vector
const sunDirection = view.atmosphere.getSunDirection();

// Get the moon direction vector
const moonDirection = view.atmosphere.getMoonDirection();
```

## Properties

### date

**Type:** `Date`

**Description:** The date and time used for sun/moon position calculations. Changing the value automatically recalculates celestial positions.

**Default:** `new Date()` (current date and time)

**Example:**

```typescript
view.atmosphere.setDate(new Date("2024-06-21T12:00:00"));
```

### sunDirection

**Type:** `Vector3` (read-only)

**Description:** The current sun direction vector (ECEF coordinate system). It is recommended not to modify this directly, but to obtain a clone using the `getSunDirection()` method.

### moonDirection

**Type:** `Vector3` (read-only)

**Description:** The current moon direction vector (ECEF coordinate system). It is recommended not to modify this directly, but to obtain a clone using the `getMoonDirection()` method.

## Methods

### getSunDirection()

Gets a clone of the sun direction vector.

**Syntax:**

```typescript
getSunDirection(): Vector3
```

**Returns:**

A new `Vector3` instance representing the sun direction in the ECEF coordinate system.

**Example:**

```typescript
const sunDir = view.atmosphere.getSunDirection();
console.log("Sun direction:", sunDir.x, sunDir.y, sunDir.z);
```

### getMoonDirection()

Gets a clone of the moon direction vector.

**Syntax:**

```typescript
getMoonDirection(): Vector3
```

**Returns:**

A new `Vector3` instance representing the moon direction in the ECEF coordinate system.

**Example:**

```typescript
const moonDir = view.atmosphere.getMoonDirection();
console.log("Moon direction:", moonDir.x, moonDir.y, moonDir.z);
```

### isAtNight()

Determines whether a given position is on the night side of the Earth.

**Syntax:**

```typescript
isAtNight(position: XYZ): boolean
```

**Parameters:**

- `position`: The position to evaluate (ECEF coordinate system)

**Returns:**

`true` if the position is on the night side, `false` if on the day side.

**Example:**

```typescript
const cameraPosition = view.camera.position;
const isNight = view.atmosphere.isAtNight({
  x: cameraPosition.x,
  y: cameraPosition.y,
  z: cameraPosition.z,
});

if (isNight) {
  console.log("The current location is at night");
}
```

## Events

### sunChanged

Fires when the sun direction changes.

**Handler Type:**

```typescript
(sunDirection: Vector3) => void
```

**Parameters:**

- `sunDirection`: The new sun direction vector (clone)

**Example:**

```typescript
view.atmosphere.on("sunChanged", (sunDirection) => {
  console.log("Sun direction changed:", sunDirection);
});
```

## Atmosphere System Integration with Other Layers

The `Atmosphere` class automatically integrates with the following layers:

| Layer | Integration Details |
|----------|----------|
| `SunLightLayer` | Updates light direction based on sun direction |
| `SkyMeshLayer` | Updates rendering positions of the sun and moon |
| `StarsLayer` | Updates star positions based on sun direction |
| `SkyLightProbeLayer` | Calculates ambient light based on sun direction |
| `AerialPerspectiveEffectLayer` | Aerial perspective using atmosphere textures |
| `CloudsEffectLayer` | Cloud rendering using atmosphere textures |

## AtmosphereOptions

Atmosphere options that can be specified in the `ThreeView` constructor:

```typescript
type AtmosphereOptions = {
  /** URL for atmosphere asset files */
  atmosphereAssetsUrl?: string;
  /** URL for STBN (Spatiotemporal Blue Noise) textures */
  stbnUrl?: string;
  /** Date and time used for sun/moon position calculations */
  date?: Date;
};
```

**Example:**

```typescript
const view = new ThreeView({
  atmosphere: {
    atmosphereAssetsUrl: "/assets/atmosphere",
    stbnUrl: "/assets/stbn",
    date: new Date("2024-06-21T12:00:00"),
  },
});
```
