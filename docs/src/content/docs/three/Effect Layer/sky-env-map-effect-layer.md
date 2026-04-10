---
title: SkyEnvMapEffectLayer
description: Sky environment map effect layer for navara_three
sidebar:
  order: 61
---

The `SkyEnvMapEffectLayer` class is a pass that renders the sky environment map. It generates sky textures used for environment mapping and reflections.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

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
import ThreeView, { SkyEnvMapEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers (required for sky rendering)
plugin.addDefaultPhotorealLayers();

// Add sky environment map effect layer
view.addLayer<SkyEnvMapEffectLayer>({
  type: "effect",
  skyEnvMap: {
    resolution: 256,
  },
});
```

### High-resolution environment map

```typescript
import ThreeView, { SkyEnvMapEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealLayers();

// Create a high-resolution environment map
view.addLayer<SkyEnvMapEffectLayer>({
  type: "effect",
  skyEnvMap: {
    resolution: 512,
  },
});
```

### Usage combined with reflective materials

```typescript
import ThreeView, { SkyEnvMapEffectLayer, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers
plugin.addDefaultPhotorealLayers();

// Add sky environment map (used for reflections)
view.addLayer<SkyEnvMapEffectLayer>({
  type: "effect",
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

The generated environment map is used for material reflections and environment lighting. The resolution is fixed at creation time, so the layer must be recreated to change it.
