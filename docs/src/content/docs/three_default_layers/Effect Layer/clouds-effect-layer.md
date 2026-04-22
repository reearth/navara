---
title: CloudsEffectDesc
description: Clouds effect descriptor for navara_three
sidebar:
  order: 52
---

The `CloudsEffectDesc` class is an effect descriptor that renders real-time volumetric clouds. It provides advanced cloud visual effects including atmospheric scattering, shadows, and haze.

This effect uses atmospheric textures and sun direction provided by the `Atmosphere` class to calculate physically accurate cloud lighting.

:::tip[Related Documentation]
See [Atmosphere class](../../../three/api-reference/atmosphere/) for details on the atmosphere system.
:::

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### qualityPreset

**Type:** `"low" | "medium" | "high" | "ultra" | undefined`

**Description:** Specifies the cloud rendering quality preset.

**Default:** `"medium"`

**Example:**

```typescript
{
  clouds: {
    qualityPreset: "high",
  }
}
```

### coverage

**Type:** `number | undefined`

**Description:** Specifies the cloud coverage in the range of 0.0 to 1.0.

**Default:** `0.25`

**Example:**

```typescript
{
  clouds: {
    coverage: 0.5,
  }
}
```

### resolutionScale

**Type:** `number | undefined`

**Description:** Specifies the rendering resolution scale factor. Lower values improve performance.

**Default:** `1`

**Example:**

```typescript
{
  clouds: {
    resolutionScale: 0.5,
  }
}
```

### lightShafts

**Type:** `boolean | null | undefined`

**Description:** Specifies whether to enable the light shaft (god ray) effect.

**Default:** `null`

**Example:**

```typescript
{
  clouds: {
    lightShafts: true,
  }
}
```

### shadows

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable shadows for all descriptors. `Atmosphere.irradiance` must also be enabled.

**Default:** `true`

**Example:**

```typescript
{
  clouds: {
    shadows: true,
  }
}
```

### shadowCascadeCount

**Type:** `number | undefined`

**Description:** Specifies the number of shadow map cascades.

**Default:** `3`

**Example:**

```typescript
{
  clouds: {
    shadowCascadeCount: 4,
  }
}
```

### haze

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable the haze (fog) effect.

**Default:** `true`

**Example:**

```typescript
{
  clouds: {
    haze: true,
  }
}
```

### hazeDensityScale

**Type:** `number | undefined`

**Description:** Specifies the haze density scale.

**Default:** `3e-5`

**Example:**

```typescript
{
  clouds: {
    hazeDensityScale: 5e-5,
  }
}
```

### scatteringCoefficient

**Type:** `number | undefined`

**Description:** Specifies the scattering coefficient.

**Default:** `1`

**Example:**

```typescript
{
  clouds: {
    scatteringCoefficient: 1.2,
  }
}
```

### absorptionCoefficient

**Type:** `number | undefined`

**Description:** Specifies the absorption coefficient.

**Default:** `0`

**Example:**

```typescript
{
  clouds: {
    absorptionCoefficient: 0.1,
  }
}
```

### scatterAnisotropy1

**Type:** `number | undefined`

**Description:** Specifies the first scattering anisotropy parameter.

**Default:** `0.7`

**Example:**

```typescript
{
  clouds: {
    scatterAnisotropy1: 0.8,
  }
}
```

### scatterAnisotropy2

**Type:** `number | undefined`

**Description:** Specifies the second scattering anisotropy parameter.

**Default:** `-0.2`

**Example:**

```typescript
{
  clouds: {
    scatterAnisotropy2: -0.3,
  }
}
```

### scatterAnisotropyMix

**Type:** `number | undefined`

**Description:** Specifies the mix ratio between the two scattering anisotropies.

**Default:** `0.5`

**Example:**

```typescript
{
  clouds: {
    scatterAnisotropyMix: 0.6,
  }
}
```

### skyLightScale

**Type:** `number | undefined`

**Description:** Specifies the sky light scale.

**Default:** `1`

**Example:**

```typescript
{
  clouds: {
    skyLightScale: 1.5,
  }
}
```

### groundBounceScale

**Type:** `number | undefined`

**Description:** Specifies the ground bounce light scale.

**Default:** `1`

**Example:**

```typescript
{
  clouds: {
    groundBounceScale: 0.8,
  }
}
```

### powderScale

**Type:** `number | undefined`

**Description:** Specifies the scale of the powder effect (brightness at cloud edges).

**Default:** `0.8`

**Example:**

```typescript
{
  clouds: {
    powderScale: 1.0,
  }
}
```

### powderExponent

**Type:** `number | undefined`

**Description:** Specifies the exponent of the powder effect.

**Default:** `150`

**Example:**

```typescript
{
  clouds: {
    powderExponent: 200,
  }
}
```

### localWeatherVelocity

**Type:** `Vector2 | { x: number, y: number } | undefined`

**Description:** Specifies the cloud movement velocity as a Vector2. The x and y components control the horizontal movement speed respectively. When used with animation enabled, this produces a flowing cloud effect.

**Default:** `Vector2(0, 0)`

**Example:**

```typescript
import { Vector2 } from "three";

{
  clouds: {
    localWeatherVelocity: new Vector2(0.005, 0.001),
  }
}
```

### hazeExponent

**Type:** `number | undefined`

**Description:** Specifies the haze exponent.

**Default:** `0.001`

**Example:**

```typescript
{
  clouds: {
    hazeExponent: 0.002,
  }
}
```

### hazeScatteringCoefficient

**Type:** `number | undefined`

**Description:** Specifies the haze scattering coefficient.

**Default:** `0.9`

**Example:**

```typescript
{
  clouds: {
    hazeScatteringCoefficient: 1.5,
  }
}
```

### hazeAbsorptionCoefficient

**Type:** `number | undefined`

**Description:** Specifies the haze absorption coefficient.

**Default:** `0.5`

**Example:**

```typescript
{
  clouds: {
    hazeAbsorptionCoefficient: 1.5,
  }
}
```

### maxIterationCount

**Type:** `number | undefined`

**Description:** Specifies the maximum number of ray marching iterations. Higher values improve quality but increase performance cost.

**Default:** `64`

**Example:**

```typescript
{
  clouds: {
    maxIterationCount: 128,
  }
}
```

### minStepSize

**Type:** `number | undefined`

**Description:** Specifies the minimum ray marching step size.

**Default:** `100`

**Example:**

```typescript
{
  clouds: {
    minStepSize: 50,
  }
}
```

### maxStepSize

**Type:** `number | undefined`

**Description:** Specifies the maximum ray marching step size.

**Default:** `1000`

**Example:**

```typescript
{
  clouds: {
    maxStepSize: 2000,
  }
}
```

### shadowFarScale

**Type:** `number | undefined`

**Description:** Specifies the shadow far plane scale.

**Default:** `0.05`

**Example:**

```typescript
{
  clouds: {
    shadowFarScale: 1.5,
  }
}
```

### shadowMapSize

**Type:** `Vector2 | undefined`

**Description:** Specifies the shadow map size as a `Vector2`.

**Default:** `Vector2(512, 512)`

**Example:**

```typescript
import { Vector2 } from "three";

{
  clouds: {
    shadowMapSize: new Vector2(1024, 1024),
  }
}
```

### localWeatherRepeat

**Type:** `number | undefined`

**Description:** Specifies the repeat count for the local weather texture.

**Example:**

```typescript
{
  clouds: {
    localWeatherRepeat: 2.0,
  }
}
```

### localWeatherOffset

**Type:** `Vector2 | undefined`

**Description:** Specifies the offset for the local weather texture.

**Example:**

```typescript
import { Vector2 } from "three";

{
  clouds: {
    localWeatherOffset: new Vector2(0.5, 0.5),
  }
}
```

### shapeRepeat

**Type:** `number | undefined`

**Description:** Specifies the repeat count for the cloud shape texture.

**Example:**

```typescript
{
  clouds: {
    shapeRepeat: 1.5,
  }
}
```

### shapeOffset

**Type:** `Vector3 | undefined`

**Description:** Specifies the offset for the cloud shape texture.

**Example:**

```typescript
import { Vector3 } from "three";

{
  clouds: {
    shapeOffset: new Vector3(0.1, 0.2, 0.3),
  }
}
```

### shapeDetailRepeat

**Type:** `number | undefined`

**Description:** Specifies the repeat count for the cloud detail shape texture.

**Example:**

```typescript
{
  clouds: {
    shapeDetailRepeat: 2.0,
  }
}
```

### shapeDetailOffset

**Type:** `Vector3 | undefined`

**Description:** Specifies the offset for the cloud detail shape texture.

**Example:**

```typescript
import { Vector3 } from "three";

{
  clouds: {
    shapeDetailOffset: new Vector3(0.1, 0.1, 0.1),
  }
}
```

### turbulenceRepeat

**Type:** `number | undefined`

**Description:** Specifies the repeat count for the turbulence texture.

**Example:**

```typescript
{
  clouds: {
    turbulenceRepeat: 1.0,
  }
}
```

### turbulenceDisplacement

**Type:** `number | undefined`

**Description:** Specifies the displacement amount caused by turbulence.

**Example:**

```typescript
{
  clouds: {
    turbulenceDisplacement: 0.5,
  }
}
```

## Usage Examples

### Adding a basic clouds effect descriptor

```typescript
import ThreeView, { CloudsEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers (required for cloud rendering)
plugin.addDefaultPhotorealScene();

// Add clouds effect descriptor
const cloudsLayer = view.addEffect<CloudsEffectDesc>({
  clouds: {
    coverage: 0.5,
    qualityPreset: "high",
  },
});
```

### Scene with cloud shadows enabled

```typescript
import ThreeView, { CloudsEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView({ shadow: true });
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// Enable sunlight shadows
defaultLayers.sun.update({
  sun: {
    castShadow: true,
  },
});

// Enable aerial perspective irradiance (required for cloud shadows)
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true,
  },
});

// Add clouds effect descriptor (with shadows enabled)
const cloudsLayer = view.addEffect<CloudsEffectDesc>({
  clouds: {
    shadows: true,
    shadowCascadeCount: 3,
  },
});
```

### Using as a fog effect

```typescript
import ThreeView, { CloudsEffectDesc, LayerHandle } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealScene();

// Use the clouds layer as fog
const cloudsLayer = view.addEffect<CloudsEffectDesc>({
  clouds: {},
});

// Apply fog settings
const clouds = cloudsLayer.ref.raw;
if (clouds) {
  clouds.coverage = 0.3;
  // Configure the 4th cloud layer as fog
  clouds.cloudLayers[3].altitude = 0;
  clouds.cloudLayers[3].height = 2000;
  clouds.cloudLayers[3].densityScale = 0.05;
  clouds.cloudLayers[3].shapeAmount = 0.2;
  clouds.cloudLayers[3].shapeDetailAmount = 0;
  clouds.cloudLayers[3].constantTerm = 0.01;
}
```

### Animated clouds

```typescript
import ThreeView, { CloudsEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector2 } from "three";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Enable animation
view.animation = true;

plugin.addDefaultPhotorealScene();

// Set cloud movement velocity and add the layer
const cloudsLayer = view.addEffect<CloudsEffectDesc>({
  clouds: {
    coverage: 0.5,
    localWeatherVelocity: new Vector2(0.005, 0.001),
  },
});
```

### Complete weather scene example

```typescript
import ThreeView, { CloudsEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector2 } from "three";

const view = new ThreeView({ animation: true, shadow: true });
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// Enable irradiance to render cloud shadows
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true,
  },
});

// Add the clouds layer
const cloudsLayer = view.addEffect<CloudsEffectDesc>({
  clouds: {
    qualityPreset: "high",
    localWeatherVelocity: new Vector2(0.005, 0.001),
    coverage: 0.45,
    absorptionCoefficient: 5,
    lightShafts: true,
    shadows: true,
    haze: true,
    hazeDensityScale: 0.0003,
    hazeExponent: 0.002,
    hazeAbsorptionCoefficient: 1.5,
  },
});
```
