---
title: LensFlareEffectDesc
description: Lens flare effect descriptor for navara_three
sidebar:
  order: 56
---

The `LensFlareEffectDesc` class is a Descriptor that generates the lens flare effect. It simulates the effect of light from the sun or moon reflecting off the camera lens.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### intensity

**Type:** `number | undefined`

**Description:** Specifies the intensity of the lens flare effect.

**Default:** `0.005`

**Example:**

```typescript
{
  lensFlare: {
    intensity: 1.5,
  }
}
```

## Usage Examples

### Enabling lens flare with default effects

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects (includes LensFlareEffectDesc)
const defaultLayers = plugin.addDefaultPhotorealScene();

// Enable lens flare and set its intensity
defaultLayers.lensFlare.update({
  visible: true,
  lensFlare: {
    intensity: 0.005,
  },
});
```
