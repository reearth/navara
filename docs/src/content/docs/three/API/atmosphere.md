---
title: Atmosphere Class
description: API reference for the Atmosphere class that manages the atmospheric system and sun/moon position calculations
sidebar:
  order: 20
---

The `Atmosphere` class manages the context for atmospheric rendering. It automatically calculates the positions of the sun and moon from the configured date and time, and manages textures for atmospheric scattering simulation.

A `ThreeView` instance holds an instance of this class through the `atmosphere` property, and atmosphere-related Descriptors such as `SunLightDesc`, `SkyMeshDesc`, and `AerialPerspectiveEffectDesc` reference this instance to operate.

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
view.atmosphere.date = new Date("2024-06-21T12:00:00");
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

### setDateAt()

Adjusts `atmosphere.date` so that the local solar time at `to` matches the local solar time at `from`.

The calculation is based on the sun's **hour angle** — the angular distance from the local meridian to the sun. Because hour angle increases monotonically over a solar day, there is exactly one solution per day and no morning/afternoon ambiguity. The equation of time (up to ±16 min difference from simple longitude/15 estimates) is accounted for automatically.

**Syntax:**

```typescript
setDateAt(from: { lng: number; lat?: number }, to: { lng: number; lat?: number }): void
```

**Parameters:**

- `from.lng`: Source longitude in degrees. Only `lng` affects the result.
- `to.lng`: Target longitude in degrees. Only `lng` affects the result.

**Example:**

```typescript
// atmosphere.date represents 08:00 local solar time at Tokyo.
view.atmosphere.setDateAt({ lng: 139.69 }, { lng: 0 });
// → atmosphere.date is now 08:00 local solar time at London (lng = 0°)
```

### setElevationAt()

Adjusts `atmosphere.date` so that the sun elevation angle at `to` matches the sun elevation angle at `from`.

Unlike `setDateAt()`, the result depends on **latitude** because the maximum elevation the sun can reach varies by latitude. The morning/afternoon context (sun rising vs. setting) is preserved based on the solar time at `from`. If the target elevation exceeds the maximum achievable at `to` (e.g. during polar night), the date is clamped to solar noon at that location.

**Syntax:**

```typescript
setElevationAt(from: { lat: number; lng: number }, to: { lat: number; lng: number }): void
```

**Parameters:**

- `from`: Source location. Both `lat` and `lng` are required.
- `to`: Target location. Both `lat` and `lng` are required.

**Example:**

```typescript
// atmosphere.date shows sun at 30° elevation over Tokyo.
view.atmosphere.setElevationAt({ lat: 35.68, lng: 139.69 }, { lat: 51.5, lng: -0.12 });
// → atmosphere.date adjusted so the sun is also at 30° elevation over London
```

### setDateFromCameraAt()

Convenience wrapper for `setDateAt()` that uses the current camera position as `from`.

**Syntax:**

```typescript
setDateFromCameraAt(to: { lng: number; lat?: number }): void
```

**Parameters:**

- `to.lng`: Target longitude in degrees.

**Example:**

```typescript
// Camera is over Tokyo. atmosphere.date represents 08:00 local solar time.
view.atmosphere.setDateFromCameraAt({ lng: 0 }); // Adjust to London
// → atmosphere.date is now 08:00 local solar time at London (lng = 0°)
```

```typescript
// Fly to a city and synchronise solar time in one step
view.setCamera({ lng: -0.12, lat: 51.5, height: 500, distance: 12000 });
view.atmosphere.setDateFromCameraAt({ lng: -0.12 });
```

### setElevationFromCameraAt()

Convenience wrapper for `setElevationAt()` that uses the current camera position as `from`.

**Syntax:**

```typescript
setElevationFromCameraAt(to: { lat: number; lng: number }): void
```

**Parameters:**

- `to.lng`: Target longitude in degrees.
- `to.lat`: Target latitude in degrees.

**Example:**

```typescript
// Camera is over Tokyo with the sun at 30° elevation (morning).
view.atmosphere.setElevationFromCameraAt({ lat: 51.5, lng: -0.12 }); // London
// → atmosphere.date adjusted so the sun is also at 30° elevation over London
```

```typescript
// Fly to a city and match the sun elevation
view.setCamera({ lng: -74.01, lat: 40.71, height: 500, distance: 12000 });
view.atmosphere.setElevationFromCameraAt({ lng: -74.01, lat: 40.71 });
```

## Comparison: setDateAt vs setElevationAt

| | `setDateAt` / `setDateFromCameraAt` | `setElevationAt` / `setElevationFromCameraAt` |
|---|---|---|
| What is matched | Hour angle (east–west sun position) | Elevation angle (height above horizon) |
| Latitude effect | None — only longitude matters | Significant — max elevation varies by latitude |
| Solutions per day | Exactly 1 | 2 (morning and afternoon) — context preserved automatically |
| Polar night handling | N/A | Clamped to solar noon |
| Typical use | "Show the same time of day" | "Match shadow length and overall brightness" |

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

## Atmosphere System Integration with Other Descriptors

The `Atmosphere` class automatically integrates with the following Descriptors:

| Descriptor | Integration Details |
|----------|----------|
| `SunLightDesc` | Updates light direction based on sun direction |
| `SkyMeshDesc` | Updates rendering positions of the sun and moon |
| `StarsDesc` | Updates star positions based on sun direction |
| `SkyLightProbeDesc` | Calculates ambient light based on sun direction |
| `AerialPerspectiveEffectDesc` | Aerial perspective using atmosphere textures |
| `CloudsEffectDesc` | Cloud rendering using atmosphere textures |

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
