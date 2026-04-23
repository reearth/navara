---
title: Light Descriptor
description: Light descriptor types for navara_three
sidebar:
  order: 150
---

LightDesc is a group of classes that manage lighting in a 3D scene. It provides various lighting techniques including ambient light, sunlight, and Image-Based Lighting.

## LightDescriptor Types

navara_three provides multiple light descriptor types to address various lighting requirements:

### [AmbientLightDesc](../../../three/light-desc-reference/ambient-light-desc/)

**Purpose:** Ambient light for the entire scene
**Description:** Basic ambient light that illuminates all objects evenly. Does not cast shadows.
**Key features:**
- Simple and lightweight
- Uniform lighting from all directions
- No shadows

**Usage example:**
```typescript
import ThreeView, { Color } from "@navara/three";
import { AmbientLightDesc } from "@navara/three_default_descs";

view.registerLight("ambient", AmbientLightDesc);

view.addLight<AmbientLightDesc>({
  ambient: {
    color: new Color().setHex(0xffffff),
    intensity: 1.0
  }
});
```

### [LightProbeDesc](../../../three/light-desc-reference/light-probe-desc/)

**Purpose:** Image-Based Lighting (IBL)
**Description:** Pre-computed environment lighting using spherical harmonics. Achieves realistic indirect lighting.
**Key features:**
- Fast computation using Spherical Harmonics
- Uses pre-computed lighting data
- Ideal for static environment lighting

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { LightProbeDesc } from "@navara/three_default_descs";

view.registerLight("lightProbe", LightProbeDesc);

view.addLight<LightProbeDesc>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(coefficients),
    intensity: 0.05
  }
});
```

### [SkyLightProbeDesc](../../../three/light-desc-reference/sky-light-probe-desc/)

**Purpose:** Dynamic sky lighting
**Description:** Dynamic environment lighting that works in conjunction with atmospheric scattering simulation. Automatically updates based on the sun's position.
**Key features:**
- Automatic integration with the atmosphere system
- Follows the sun's position
- Automatically computes different lighting for day and night

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { SkyLightProbeDesc } from "@navara/three_default_descs";

view.registerLight("skyLightProbe", SkyLightProbeDesc);

view.addLight<SkyLightProbeDesc>({
  skyLightProbe: {
    intensity: 1.0
  }
});
```

### [SunLightDesc](../../../three/light-desc-reference/sun-light-desc/)

**Purpose:** Sunlight and shadows
**Description:** High-quality sunlight simulation using Cascaded Shadow Maps (CSM). Works in conjunction with atmospheric scattering.
**Key features:**
- High-quality Cascaded Shadow Maps
- Dynamic color computation via atmospheric scattering
- Detailed shadow parameter control

**Usage example:**
```typescript
import ThreeView from "@navara/three";
import { SunLightDesc } from "@navara/three_default_descs";

view.registerLight("sun", SunLightDesc);

view.addLight<SunLightDesc>({
  sun: {
    intensity: 1.0,
    castShadow: true,
    shadowMapSize: 2048,
    shadowCascadeCount: 4
  }
});
```

## Light Descriptor Types Comparison

| Light Type             | Shadows     | Dynamic Update | Atmosphere Integration | Primary Use          | Performance          |
| ---------------------- | ----------- | -------------- | ---------------------- | -------------------- | -------------------- |
| **AmbientLightDesc**  | None        | Manual         | Not required           | Basic ambient light  | Very lightweight     |
| **LightProbeDesc**    | None        | Manual         | Not required           | Static IBL           | Lightweight          |
| **SkyLightProbeDesc** | None        | Automatic      | Required               | Dynamic sky lighting | Moderate             |
| **SunLightDesc**      | Yes (CSM)   | Automatic      | Recommended            | Sunlight and shadows | Heavy (with shadows) |

## Common Usage Patterns

### Basic Lighting Setup

The simplest lighting configuration:

```typescript
// AmbientLightDesc must be registered
view.addLight<AmbientLightDesc>({
  ambient: { intensity: 1.0 }
});
```

### Recommended Lighting Setup

For realistic scenes, combine multiple light Descriptors. Using `DefaultPlugin` from [three_default_plugin](../../../three_default_plugin/about/) registers all Descriptors at once, and `addDefaultPhotorealScene()` makes it easy to set up a photorealistic scene.

```typescript
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Set up a photorealistic scene at once (includes SunLight + SkyLightProbe, etc.)
const layers = plugin.addDefaultPhotorealScene();

// Add additional ambient light as needed
view.addLight<AmbientLightDesc>({
  ambient: { intensity: 0.3 }
});
```

### Night Scene Setup

For night scenes, additional light probes are effective:

```typescript
// Set up a photorealistic scene with DefaultPlugin
const layers = plugin.addDefaultPhotorealScene();

// Night light probe (LightProbeDesc is registered by DefaultPlugin)
const nightLight = view.addLight<LightProbeDesc>({
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

The following light Descriptors integrate with the atmosphere system:

- **SkyLightProbeDesc**: Uses the atmosphere's irradiance texture (required)
- **SunLightDesc**: Uses the atmosphere's transmittance texture (recommended)

If you are not using the atmosphere system, use AmbientLightDesc and LightProbeDesc instead.

## Related Resources

- [Resource Layer Reference](../../../three/resource-layer-reference/about/) - Resource layer details
- [Effect Descriptor Reference](../../../three/effect-desc-reference/about/) - Effect descriptors
- [API Reference](../../../three/api/) - ThreeView API
