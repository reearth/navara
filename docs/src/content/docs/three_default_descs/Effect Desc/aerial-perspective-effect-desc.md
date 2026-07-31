---
title: AerialPerspectiveEffectDesc
description: Aerial perspective effect descriptor for navara_three
sidebar:
  order: 51
---

The `AerialPerspectiveEffectDesc` class is a Descriptor that represents the aerial perspective effect. It calculates atmospheric light scattering (inscatter) and transmittance, producing the effect where distant objects appear more bluish.

This effect uses precomputed textures and sun/moon directions provided by the `Atmosphere` class to reproduce physically accurate atmospheric scattering.

:::tip[Related Documentation]
See [Atmosphere class](../../../three/api/atmosphere/) for details on the atmosphere system.
:::

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

**Example:**
```typescript
{ visible: true }
```

### inscatter

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable the atmospheric light scattering effect. This produces the effect where distant objects appear bright and hazy.

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    inscatter: true,
  }
}
```

### transmittance

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable the atmospheric light transmittance effect. This produces the effect where distant objects appear darker.

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    transmittance: true,
  }
}
```

### irradiance

**Type:** `boolean | undefined`

**Description:** Used to illuminate materials at the post-processing stage. Does not support transparency. Enable this flag when rendering clouds with shadows.

**Default:** `false`

**Example:**

```typescript
{
  aerialPerspective: {
    irradiance: false,
  }
}
```

### sky

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply sky color to the atmospheric effect.

**Default:** `false`

**Example:**

```typescript
{
  aerialPerspective: {
    sky: false,
  }
}
```

### sun

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply the sun direction to the atmospheric effect.

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    sun: true,
  }
}
```

### moon

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply the moon direction to the atmospheric effect.

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    moon: true,
  }
}
```

### useNormalBuffer

**Type:** `boolean | undefined`

**Description:** Specifies whether to bind the normal buffer to the effect, which controls whether deferred lighting (irradiance applied via this pass) is performed on scene materials. When `false`, the normal buffer is not provided to the effect and post-processing lighting is not applied to materials — atmospheric in-scatter and transmittance still compute, but materials are not relit by this pass. Disable this when scene geometry does not produce a reliable normal buffer (for example, tiled glTF assets without authored normals) and material lighting should be left untouched.

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    useNormalBuffer: false,
  }
}
```

### albedoScale

**Type:** `number | undefined`

**Description:** Specifies the scale factor passed to the underlying `AerialPerspectiveEffect`'s `albedoScale` uniform. It is multiplied with the scene color when computing the diffuse term used by the irradiance pass.

**Default:** `2 / Math.PI`

**Example:**

```typescript
{
  aerialPerspective: {
    albedoScale: 2 / Math.PI,
  }
}
```

## Usage Examples

### Enable aerial perspective with default effect descriptors

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects (includes AerialPerspectiveEffectDesc)
const defaultLayers = plugin.addDefaultPhotorealScene();

// Update aerial perspective effect settings
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    sky: false,
  },
});
```

### Aerial perspective combined with cloud shadows

```typescript
import ThreeView from "@navaramap/three";
import { CloudsEffectDesc } from "@navaramap/three-default-descs";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// Enable irradiance when using cloud shadows
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    irradiance: true,
  },
});

// Add clouds effect descriptor
view.addEffect<CloudsEffectDesc>({
  clouds: {
    shadows: true,
  },
});
```
