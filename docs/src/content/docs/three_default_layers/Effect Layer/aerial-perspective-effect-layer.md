---
title: AerialPerspectiveEffectLayer
description: Aerial perspective effect layer for navara_three
sidebar:
  order: 51
---

The `AerialPerspectiveEffectLayer` class is a layer that represents the aerial perspective effect. It calculates atmospheric light scattering (inscatter) and transmittance, producing the effect where distant objects appear more bluish.

This effect uses precomputed textures and sun/moon directions provided by the `Atmosphere` class to reproduce physically accurate atmospheric scattering.

:::tip[Related Documentation]
See [Atmosphere class](../../../three/api-reference/atmosphere/) for details on the atmosphere system.
:::

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

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

## Usage Examples

### Enable aerial perspective with default effect layers

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers (includes AerialPerspectiveEffectLayer)
const defaultLayers = plugin.addDefaultPhotorealLayers();

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
import ThreeView, { CloudsEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealLayers();

// Enable irradiance when using cloud shadows
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    irradiance: true,
  },
});

// Add clouds effect layer
view.addEffect<CloudsEffectLayer>({
  clouds: {
    shadows: true,
  },
});
```
