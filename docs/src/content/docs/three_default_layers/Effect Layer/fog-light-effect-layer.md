---
title: FogLightEffectLayer
description: Fog light effect descriptor for navara_three
sidebar:
  order: 55
---

The `FogLightEffectLayer` class is a layer that generates volumetric lighting effects. It calculates volumetric fog from point lights and expresses light scattering effects.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### lights

**Type:** `FogLightDefinition[] | undefined`

**Description:** Specifies an array of fog lights. Each light has a position, color, intensity, and influence radius.

**Default:** `[]`

**Example:**

```typescript
{
  fogLight: {
    lights: [
      {
        position: { x: 0, y: 100, z: 0 },
        color: new Color().setHex(0xffffff),
        intensity: 10,
        radius: 500
      }
    ],
  }
}
```

### maxLights

**Type:** `number | undefined`

**Description:** Specifies the maximum number of lights. Lights exceeding this value are ignored.

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

**Description:** Specifies the density of the volumetric fog.

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

**Description:** Specifies whether to apply the surface lighting effect.

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

**Description:** Specifies the downsample factor. 1 = full resolution, 2 = half, 4 = quarter.

**Default:** `2`

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

**Description:** Specifies the maximum number of lights iterated per tile on the GPU.

**Default:** `64`

**Example:**

```typescript
{
  fogLight: {
    maxLightsPerTile: 32,
  }
}
```

### extentScale

**Type:** `number | undefined`

**Description:** Specifies a safety scale applied to the analytical closest distance.

**Default:** `0.8`

**Example:**

```typescript
{
  fogLight: {
    extentScale: 1.0,
  }
}
```

### maxFar

**Type:** `number | undefined`

**Description:** Specifies the maximum distance at which fog lights are considered.

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

**Description:** Specifies whether to display a debug grid extent overlay.

**Default:** `false`

**Example:**

```typescript
{
  fogLight: {
    debugShowGrid: true,
  }
}
```

## Usage Examples

### Adding a basic fog light effect

```typescript
import ThreeView, { FogLightEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add fog light effect descriptor
view.addEffect<FogLightEffectLayer>({
  fogLight: {
    lights: [
      {
        position: { x: 0, y: 100, z: 0 },
        color: new Color().setHex(0xffffff),
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
import ThreeView, { FogLightEffectLayer, Color, type LayerDescription } from "@navara/three";

const view = new ThreeView();
await view.init();

// Define multiple street lights
const streetLights = [
  { position: { x: 100, y: 50, z: 0 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
  { position: { x: -100, y: 50, z: 0 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
  { position: { x: 0, y: 50, z: 100 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
];

const fogLayerDesc = {
  fogLight: {
    lights: streetLights,
    fogDensity: 0.7,
    useSurfaceLighting: true,
    downsample: 2,
    maxLightsPerTile: 128,
  },
  visible: true,
};

view.addEffect<FogLightEffectLayer>(fogLayerDesc);
```

### Dynamically adding lights to a scene

```typescript
import ThreeView, { FogLightEffectLayer, Color, type FogLightDefinition } from "@navara/three";

const view = new ThreeView();
await view.init();

// Initial light array
const fogLights: FogLightDefinition[] = [];

// Add fog light descriptor
const fogLayer = view.addEffect<FogLightEffectLayer>({
  fogLight: {
    lights: fogLights,
    fogDensity: 0.7,
    useSurfaceLighting: true,
    downsample: 2,
    maxLightsPerTile: 128,
    maxLights: 400,
  },
});

// Add lights later
function addLight(x: number, y: number, z: number) {
  fogLights.push({
    position: { x, y, z },
    color: new Color().setHex(0xffffff),
    intensity: 10,
    radius: 300,
  });

  fogLayer.update({
    fogLight: {
      lights: fogLights,
    },
  });
}
```

### Fog lights visible only at night

```typescript
import ThreeView, { FogLightEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const isNight = view.atmosphere.isAtNight(view.camera.positionECEF); // Determined based on time

const fogLayer = view.addEffect<FogLightEffectLayer>({
  fogLight: {
    lights: [
      { position: { x: 0, y: 100, z: 0 }, color: new Color().setHex(0xffffff), intensity: 10, radius: 500 },
    ],
    fogDensity: 0.7,
  },
  visible: isNight,
});

// Toggle visibility based on time
function updateVisibility(nightMode: boolean) {
  fogLayer.update({
    visible: nightMode,
  });
}
```

## Notes

This effect supports multiple lights, and since `allowDuplication` is set to `true`, multiple FogLightEffectLayer instances can be created.
