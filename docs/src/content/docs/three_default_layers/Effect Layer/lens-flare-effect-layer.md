---
title: LensFlareEffectLayer
description: Lens flare effect layer for navara_three
sidebar:
  order: 56
---

The `LensFlareEffectLayer` class is a layer that generates the lens flare effect. It simulates the effect of light from the sun or moon reflecting off the camera lens.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

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

const view = new ThreeView();
await view.init();

// Add default effect layers (includes LensFlareEffectLayer)
const defaultEffects = view.addDefaultEffectLayers();

// Enable lens flare and set its intensity
defaultEffects.lensFlare.update({
  visible: true,
  lensFlare: {
    intensity: 0.005,
  },
});
```
