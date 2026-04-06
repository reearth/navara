---
title: LightProbeLayer
description: Light probe layer for navara_three
sidebar:
  order: 152
---

The `LightProbeLayer` class represents a light probe layer that provides Image-Based Lighting using Spherical Harmonics. It achieves realistic indirect lighting using pre-computed environment lighting data.

## Common Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the layer.

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  lightProbe: { ... }
}
```

## LightProbe Properties

### lightProbe

**Type:** `object | undefined`

**Description:** Configuration options for the light probe.

#### intensity

**Type:** `number | undefined`

**Description:** Specifies the intensity of the light probe. Higher values result in brighter light.

**Default:** `1`

**Example:**

```typescript
{
  lightProbe: {
    intensity: 1.0,
  }
}
```

#### sh

**Type:** `SphericalHarmonics3 | undefined`

**Description:** Directly specifies a Three.js `SphericalHarmonics3` object. Contains spherical harmonics coefficients. You can use the `coefficients` property or set the coefficient array with the `set()` method.

**Default:** `undefined`

**Example:**

```typescript
import * as THREE from "three";

const nightCoefficients = [
  new THREE.Vector3(0.22, 0.22, 0.28),
  new THREE.Vector3(0.15, 0.15, 0.20),
  // ... 9 coefficients total (3rd-order spherical harmonics)
];

const sh = new THREE.SphericalHarmonics3();
sh.coefficients = nightCoefficients;

{
  lightProbe: {
    sh: sh,
    intensity: 0.05
  }
}
```

#### coefficients

**Type:** `number[][] | undefined`

**Description:** Specifies spherical harmonics coefficients as an array. Each element is a 3-element array of [R, G, B]. This can be used as an alternative to `sh` for setting coefficients.

:::note
If both `sh` and `coefficients` are specified, `coefficients` takes precedence.
:::

**Default:** `undefined`

**Example:**

```typescript
{
  lightProbe: {
    coefficients: [
      [0.5, 0.5, 0.5],
      [0.2, 0.2, 0.2],
      // ... other coefficients
    ],
  }
}
```

## Usage Examples

### Basic Usage (Night Scene)

```typescript
import ThreeView, { LightProbeLayer } from "@navara/three";
import * as THREE from "three";

const view = new ThreeView();
await view.init();

// Pre-computed spherical harmonics coefficients for night
const NIGHT_SH_COEFFICIENTS = [
  [0.22, 0.22, 0.28],
  [0.15, 0.15, 0.20],
  // ... other coefficients
];

// Add a light probe layer
const lightProbe = view.addLayer<LightProbeLayer>({
  type: "light",
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(NIGHT_SH_COEFFICIENTS),
    intensity: 0.05
  }
});
```

### Dynamic Intensity Update

```typescript
// Update the light probe intensity based on sun position
view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);

  lightProbe.update({
    visible: isAtNight,
    lightProbe: {
      intensity: isAtNight ? 0.05 : 0
    }
  });
});
```

## About Spherical Harmonics

Spherical Harmonics is a mathematical technique for efficiently representing environment lighting:

- Compresses an environment map into a compact set of coefficients
- Fast lighting computation suitable for real-time rendering
- Used for approximating indirect lighting and ambient occlusion

Typically, 3rd-order spherical harmonics (9 coefficients) are used.

## Notes

- Light probes are primarily used for representing indirect lighting.
- They are effective for reproducing specific lighting environments such as night scenes.
- Spherical harmonics coefficients need to be pre-computed or measured.
- Combined with SkyLightProbeLayer, more dynamic environment lighting can be achieved.
