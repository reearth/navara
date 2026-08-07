---
title: FogLightEffectDesc
description: Fog light effect descriptor for navara_three
sidebar:
  order: 55
---

The `FogLightEffectDesc` class is a Descriptor that generates volumetric lighting effects. It calculates volumetric fog from point lights and expresses light scattering effects.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### lights

**Type:** `FogLightDefinition[] | undefined`

**Description:** Specifies an array of fog lights. Each light has a position, color, intensity, and an optional influence radius (`radius`, default `500`). Positions are world (ECEF) coordinates — build them with `geodeticToVector3()`. `color` accepts either a numeric hex value or a `Color`.

**Default:** `[]`

**Example:**

```typescript
import { degreeToRadian, geodeticToVector3 } from "@navaramap/three";

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

view.addEffect({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffb45c,
        intensity: 1,
        radius: 500,
      },
    ],
  },
});
```

### maxLights

**Type:** `number | undefined`

**Description:** Initial light capacity hint. The internal light textures grow automatically when more lights are set, so this only pre-sizes them - passing the expected light count avoids a reallocation later.

**Default:** `100`

**Example:**

```typescript
{
  fogLight: {
    maxLights: 200,
  }
}
```

### fogDensity

**Type:** `number | undefined`

**Description:** Specifies the density of the volumetric fog. Higher values brighten the scattering and also extend each light's automatically derived reach.

**Default:** `5`

**Example:**

```typescript
{
  fogLight: {
    fogDensity: 10,
  }
}
```

### useSurfaceLighting

**Type:** `boolean | undefined`

**Description:** Specifies whether lights also illuminate surfaces, in addition to the fog itself.

**Default:** `true`

**Example:**

```typescript
{
  fogLight: {
    useSurfaceLighting: true,
  }
}
```

### downsample

**Type:** `number | undefined`

**Description:** Fog render scale divisor: 1 = full resolution, 2 = half, 4 = quarter. The low-resolution fog is composited back with depth-aware upsampling, so higher divisors stay clean along silhouettes while cutting the GPU cost by the divisor squared.

**Default:** `4`

**Example:**

```typescript
{
  fogLight: {
    downsample: 2,
  }
}
```

### maxLightsPerTile

**Type:** `number | undefined`

**Description:** Maximum number of lights evaluated per screen tile on the GPU. This is the main quality/cost dial: shader cost scales roughly linearly with it, and lights beyond the cap are folded into a smooth residual haze rather than dropped, so lowering it dims the weakest halos instead of producing seams.

**Default:** `64`

**Example:**

```typescript
{
  fogLight: {
    maxLightsPerTile: 32,
  }
}
```

### haloFalloff

**Type:** `number | undefined`

**Description:** Falloff coefficient of the halo attenuation `1 / (1 + haloFalloff * h)`, where `h` is the ray's closest distance to the light in meters. Higher values tighten halos around their lights. Useful to suppress ghost-like glow from lights hidden behind terrain, which the fog model cannot shadow.

**Default:** `0.1`

**Example:**

```typescript
{
  fogLight: {
    haloFalloff: 0.3,
  }
}
```

### extentScale

**Type:** `number | undefined`

**Description:** Safety scale applied to each light's effective range when registering it on screen tiles. Values below `1.0` risk cutting fog at tile borders.

**Default:** `1.0`

**Example:**

```typescript
{
  fogLight: {
    extentScale: 1.0,
  }
}
```

### tileSize

**Type:** `number | undefined`

**Description:** Screen tile size in pixels (at the fog render resolution) used for the tiled light culling.

**Default:** `32`

**Example:**

```typescript
{
  fogLight: {
    tileSize: 32,
  }
}
```

### maxFar

**Type:** `number | undefined`

**Description:** Maximum distance from the camera at which fog lights are considered. Lights that is farther than this value are culled on the CPU.

**Default:** `1e6`

**Example:**

```typescript
{
  fogLight: {
    maxFar: 5000,
  }
}
```

### debugShowGrid

**Type:** `boolean | undefined`

**Description:** Specifies whether to display the tile grid and its per-tile light occupancy as a debug overlay.

**Default:** `false`

**Example:**

```typescript
{
  fogLight: {
    debugShowGrid: true,
  }
}
```

## Performance

- **`downsample` is the biggest lever.** The default `4` renders the fog at quarter resolution; the depth-aware upsampling keeps silhouettes clean. Use `2` (or `1`) only when the fog needs to stay crisp on close inspection.
- **`maxLightsPerTile` trades halo completeness for shader cost** almost linearly. With many broad-radius lights, lowering it to `32` roughly halves the fog pass; the weakest halos blend into the residual haze.
- **`radius` caps each light's reach.** The effective reach is derived automatically from `intensity`, `fogDensity`, and `haloFalloff`, then clamped by `radius` — so tightening `radius` (or raising `haloFalloff`) directly shrinks how many tiles each light touches.
- **Pass the expected light count as `maxLights`** to avoid a texture reallocation when lights are added later.
- The tile grid only rebuilds when the camera, lights, or fog parameters change; a static view costs no CPU time.

## Usage Examples

### Adding a basic fog light effect

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import { FogLightEffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

// Add fog light effect descriptor
view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffffff,
        intensity: 10,
        radius: 500,
      },
    ],
    fogDensity: 5,
    useSurfaceLighting: true,
  },
});
```

### Street light effect in a night scene

```typescript
import ThreeView, {
  degreeToRadian,
  geodeticToVector3,
} from "@navaramap/three";
import {
  FogLightEffectDesc,
  type FogLightDefinition,
} from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// One warm lamp per road point ([lng, lat, ground elevation in meters]);
// lift each above the pavement so it reads as a glowing orb
const roadPoints: [number, number, number][] = [
  [139.7601, 35.6805, 30],
  [139.7612, 35.6811, 31],
  [139.7623, 35.6816, 33],
];
const streetLights: FogLightDefinition[] = roadPoints.map(
  ([lng, lat, elevation]) => {
    const position = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: elevation + 14,
    });
    return {
      position: { x: position.x, y: position.y, z: position.z },
      color: 0xffaa00,
      intensity: 1,
      radius: 200,
    };
  },
);

view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: streetLights,
    fogDensity: 2,
    useSurfaceLighting: true,
    maxFar: view.camera.raw.far,
  },
  visible: true,
});
```

### Dynamically adding lights to a scene

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import {
  FogLightEffectDesc,
  type FogLightDefinition,
} from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// Initial light array
const fogLights: FogLightDefinition[] = [];

// Add fog light descriptor; pre-size the capacity for the lights added later
const fogDesc = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: fogLights,
    fogDensity: 2,
    maxLights: 400,
  },
});

// Add lights later
function addLight(lng: number, lat: number, height: number) {
  const position = geodeticToVector3({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height,
  });
  fogLights.push({
    position: { x: position.x, y: position.y, z: position.z },
    color: 0xffffff,
    intensity: 10,
    radius: 300,
  });

  fogDesc.update({
    fogLight: {
      lights: fogLights,
    },
  });
}
```

### Fog lights visible only at night

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import { FogLightEffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

const isNight = view.atmosphere.isAtNight(view.camera.positionECEF); // Determined based on time

const fogDesc = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffffff,
        intensity: 10,
        radius: 500,
      },
    ],
    fogDensity: 2,
  },
  visible: isNight,
});

// Toggle visibility based on time
function updateVisibility(nightMode: boolean) {
  fogDesc.update({
    visible: nightMode,
  });
}
```

## Notes

- This effect supports multiple lights, and since `allowDuplication` is set to `true`, multiple FogLightEffectDesc instances can be created.
- The fog is not shadowed by geometry: a light hidden behind terrain still brightens the fog around it, which can read as a faint glow above a ridge. Raise [`haloFalloff`](#halofalloff) to suppress it.
- The camera can enter the fog: scattering stays continuous when lights move beside or behind the viewer.
