---
title: SkyLightProbeLayer
description: Sky light probe layer for navara_three
sidebar:
  order: 153
---

The `SkyLightProbeLayer` class represents a dynamic sky light probe layer that works in conjunction with atmospheric scattering simulation. It provides environment lighting that automatically updates based on the sun's position, reproducing realistic sky lighting.

The sun direction is automatically calculated based on `view.atmosphere.date`, and lighting is updated every frame.

:::tip[Related Documentation]
For details on the atmosphere system, see the [Atmosphere class](../../../three/api-reference/atmosphere/).
:::

## Common Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the layer.

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  skyLightProbe: { ... }
}
```

## SkyLightProbe Properties

### skyLightProbe

**Type:** `object | undefined`

**Description:** Configuration options for the sky light probe.

#### intensity

**Type:** `number | undefined`

**Description:** Specifies the intensity of the sky light probe. Higher values result in brighter light.

**Default:** `1`

**Example:**

```typescript
{
  skyLightProbe: {
    intensity: 1.0,
  }
}
```

## Dynamic Updates

SkyLightProbeLayer automatically updates based on the following factors:

- **Sun direction**: Obtained from `view.atmosphere.sunDirection`
- **Camera position**: Considers differences in lighting inside and outside the atmosphere
- **Atmosphere texture**: Uses the irradiance texture

These updates are performed automatically every frame, so manual updating is unnecessary.

:::note[Updatable Properties]
The only property that can be changed via the `update()` method after layer creation is **`intensity`**. Properties such as sun direction and position are updated automatically and cannot be set manually.
:::

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { SkyLightProbeLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers
const defaultLayers = plugin.addDefaultPhotorealScene();

// The sky light probe automatically follows the sun's position
defaultLayers.skyLightProbe.update({
  skyLightProbe: {
    intensity: 1.0
  }
});
```

### Changing Intensity for Day and Night

```typescript
const skyLightProbe = view.addLight<SkyLightProbeLayer>({
  skyLightProbe: {
    intensity: 1.0
  }
});

// Set different intensities for day and night
const params = {
  dayIntensity: 1.0,
  nightIntensity: 5.0
};

view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  const intensity = isAtNight ? params.nightIntensity : params.dayIntensity;

  skyLightProbe.update({
    skyLightProbe: { intensity }
  });
});
```

### Enable Only at Night

```typescript
const skyLightProbe = view.addLight<SkyLightProbeLayer>({
  skyLightProbe: {
    intensity: 1.0
  },
});

// Increase intensity only at night
view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  if(!isAtNight) return;
  skyLightProbe.update({
    skyLightProbe: {
      intensity: 5.0
    },
  });
});
```

## Integration with the Atmosphere System

SkyLightProbeLayer works closely with the atmospheric scattering simulation from the `@takram/three-atmosphere` package:

1. **Irradiance texture retrieval**: Obtains pre-computed irradiance textures from the atmosphere layer
2. **Sun direction synchronization**: Synchronizes the sun direction every frame
3. **Position update**: Calculates appropriate lighting based on camera position

This enables natural environment lighting that responds to time of day and sun position.

## Differences from LightProbeLayer

| Feature       | SkyLightProbeLayer             | LightProbeLayer          |
| ------------- | ------------------------------ | ------------------------ |
| Update method | Automatic (follows sun position) | Manual (fixed values)  |
| Data source   | Atmospheric simulation         | Pre-computed coefficients |
| Use case      | Dynamic sky lighting           | Static environment lighting |
| Atmosphere    | Required                       | Not required             |

## Notes

- SkyLightProbeLayer requires the atmosphere layer (Atmosphere) to function.
- Using `plugin.addDefaultPhotorealScene()` automatically includes SkyLightProbeLayer.
- Setting a higher intensity at night can achieve more natural nightscape lighting.
- It can be used in combination with other light descriptors (AmbientLight, SunLight, etc.).
