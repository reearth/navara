---
title: Light Layer
description: Light layer types for navara_three
sidebar:
  order: 150
---

LightLayer is a group of classes that manage lighting in a 3D scene. It provides various lighting techniques including ambient light, sunlight, and Image-Based Lighting.

## LightLayer Types

navara_three provides multiple light layer types to address various lighting requirements:

### [AmbientLightLayer](../../../three/light-layer-reference/ambient-light-layer/)

**Purpose:** Ambient light for the entire scene
**Description:** Basic ambient light that illuminates all objects evenly. Does not cast shadows.
**Key features:**
- Simple and lightweight
- Uniform lighting from all directions
- No shadows

**Usage example:**
```typescript
import ThreeView, { Color } from "@navara/three";
import { AmbientLightLayer } from "@navara/three_default_layers";

view.registerLight("ambient", AmbientLightLayer);

view.addLight<AmbientLightLayer>({
  ambient: {
    color: new Color().setHex(0xffffff),
    intensity: 1.0
  }
});
```

### [LightProbeLayer](../../../three/light-layer-reference/light-probe-layer/)

**Purpose:** Image-Based Lighting (IBL)
**Description:** Pre-computed environment lighting using spherical harmonics. Achieves realistic indirect lighting.
**Key features:**
- Fast computation using Spherical Harmonics
- Uses pre-computed lighting data
- Ideal for static environment lighting

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { LightProbeLayer } from "@navara/three_default_layers";

view.registerLight("lightProbe", LightProbeLayer);

view.addLight<LightProbeLayer>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(coefficients),
    intensity: 0.05
  }
});
```

### [SkyLightProbeLayer](../../../three/light-layer-reference/sky-light-probe-layer/)

**Purpose:** Dynamic sky lighting
**Description:** Dynamic environment lighting that works in conjunction with atmospheric scattering simulation. Automatically updates based on the sun's position.
**Key features:**
- Automatic integration with the atmosphere system
- Follows the sun's position
- Automatically computes different lighting for day and night

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { SkyLightProbeLayer } from "@navara/three_default_layers";

view.registerLight("skyLightProbe", SkyLightProbeLayer);

view.addLight<SkyLightProbeLayer>({
  skyLightProbe: {
    intensity: 1.0
  }
});
```

### [SunLightLayer](../../../three/light-layer-reference/sun-light-layer/)

**Purpose:** Sunlight and shadows
**Description:** High-quality sunlight simulation using Cascaded Shadow Maps (CSM). Works in conjunction with atmospheric scattering.
**Key features:**
- High-quality Cascaded Shadow Maps
- Dynamic color computation via atmospheric scattering
- Detailed shadow parameter control

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { SunLightLayer } from "@navara/three_default_layers";

view.registerLight("sun", SunLightLayer);

view.addLight<SunLightLayer>({
  sun: {
    intensity: 1.0,
    castShadow: true,
    shadowMapSize: 2048,
    shadowCascadeCount: 4
  }
});
```

## Light Layer Types Comparison

| Light Type             | Shadows     | Dynamic Update | Atmosphere Integration | Primary Use          | Performance          |
| ---------------------- | ----------- | -------------- | ---------------------- | -------------------- | -------------------- |
| **AmbientLightLayer**  | None        | Manual         | Not required           | Basic ambient light  | Very lightweight     |
| **LightProbeLayer**    | None        | Manual         | Not required           | Static IBL           | Lightweight          |
| **SkyLightProbeLayer** | None        | Automatic      | Required               | Dynamic sky lighting | Moderate             |
| **SunLightLayer**      | Yes (CSM)   | Automatic      | Recommended            | Sunlight and shadows | Heavy (with shadows) |

## Common Usage Patterns

### Basic Lighting Setup

The simplest lighting configuration:

```typescript
// AmbientLightLayer must be registered
view.addLight<AmbientLightLayer>({
  ambient: { intensity: 1.0 }
});
```

### Recommended Lighting Setup

For realistic scenes, combine multiple light layers. Using `DefaultPlugin` from [three_default_plugin](../../../three_default_plugin/about/) registers all layers at once, and `addDefaultPhotorealLayers()` makes it easy to set up a photorealistic scene.

```typescript
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Set up a photorealistic scene at once (includes SunLight + SkyLightProbe, etc.)
const layers = plugin.addDefaultPhotorealLayers();

// Add additional ambient light as needed
view.addLight<AmbientLightLayer>({
  ambient: { intensity: 0.3 }
});
```

### Night Scene Setup

For night scenes, additional light probes are effective:

```typescript
// Set up a photorealistic scene with DefaultPlugin
const layers = plugin.addDefaultPhotorealLayers();

// Night light probe (LightProbeLayer is registered by DefaultPlugin)
const nightLight = view.addLight<LightProbeLayer>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(NIGHT_COEFFICIENTS),
    intensity: 0.05
  }
});

// Enable only at night
view.atmosphere.on("sunChanged", () => {
  const isNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  nightLight.update({ visible: isNight });
});
```

## Notes

### Performance Considerations

- **AmbientLight**: The most lightweight, can always be enabled
- **LightProbe/SkyLightProbe**: Moderate, adds shader computation
- **SunLight with CSM**: The heaviest, especially when using high-resolution shadow maps

### Integration with the Atmosphere System

The following light layers integrate with the atmosphere system:

- **SkyLightProbeLayer**: Uses the atmosphere's irradiance texture (required)
- **SunLightLayer**: Uses the atmosphere's transmittance texture (recommended)

If you are not using the atmosphere system, use AmbientLightLayer and LightProbeLayer instead.

## Related Resources

- [Resource Layer Reference](../../../three/resource-layer-reference/about/) - Resource layer details
- [Effect Layer Reference](../../../three/effect-layer-reference/about/) - Effect layers
- [API Reference](../../../three/api/) - ThreeView API
