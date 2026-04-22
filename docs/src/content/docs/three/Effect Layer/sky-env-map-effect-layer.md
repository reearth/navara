---
title: SkyEnvMapEffectDesc
description: Sky environment map effect descriptor for navara_three
sidebar:
  order: 61
---

The `SkyEnvMapEffectDesc` class is a pass that renders the sky environment map. It generates sky textures used for environment mapping and reflections.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### resolution

**Type:** `number | undefined`

**Description:** Specifies the environment map resolution. This value is set only at creation time; changing it later requires recreating the pass.

**Default:** `256`

**Example:**

```typescript
{
  skyEnvMap: {
    resolution: 512,
  }
}
```

## Usage Examples

### Adding a basic sky environment map

```typescript
import ThreeView, { SkyEnvMapEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects (required for sky rendering)
plugin.addDefaultPhotorealScene();

// Add sky environment map effect descriptor
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 256,
  },
});
```

### High-resolution environment map

```typescript
import ThreeView, { SkyEnvMapEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealScene();

// Create a high-resolution environment map
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 512,
  },
});
```

### Usage combined with reflective materials

```typescript
import ThreeView, { SkyEnvMapEffectDesc, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects
plugin.addDefaultPhotorealScene();

// Add sky environment map (used for reflections)
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 256,
  },
});

// Add 3D tiles with reflective materials
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 1.0,
    roughness: 0.0, // Smooth surface reflects the environment
  },
});
```

## Notes

The generated environment map is used for material reflections and environment lighting. The resolution is fixed at creation time, so the Descriptor must be recreated to change it.
