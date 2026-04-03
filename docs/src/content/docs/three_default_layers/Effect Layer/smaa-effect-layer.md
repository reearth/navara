---
title: SMAAEffectLayer
description: SMAA effect layer for navara_three
sidebar:
  order: 58
---

The `SMAAEffectLayer` class is a layer that applies the SMAA (Subpixel Morphological Anti-Aliasing) anti-aliasing effect. It provides higher quality anti-aliasing than FXAA.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

**Default:** `true`

### quality

**Type:** `"low" | "medium" | "high" | "ultra" | undefined`

**Description:** Specifies the SMAA quality preset.

**Default:** `"medium"`

**Example:**

```typescript
{
  smaa: {
    quality: "high",
  }
}
```

### edgeDetectionMode

**Type:** `"color" | "depth" | "luma" | undefined`

**Description:** Specifies the edge detection mode.

**Default:** `"color"`

**Example:**

```typescript
{
  smaa: {
    edgeDetectionMode: "luma",
  }
}
```

## Usage Examples

### Using SMAA with default effects

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView();
await view.init();

// Add default effect layers (includes SMAA)
const defaultEffects = view.addDefaultEffectLayers();

// Enable SMAA and set quality
defaultEffects.smaa.update({
  visible: true,
  smaa: {
    quality: "high",
    edgeDetectionMode: "color",
  },
});
```

### High-quality SMAA settings

```typescript
import ThreeView, { SMAAEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add SMAA effect layer
view.addLayer<SMAAEffectLayer>({
  type: "effect",
  smaa: {
    quality: "ultra",
    edgeDetectionMode: "luma",
  },
});
```

### Dynamically changing SMAA quality and edge detection mode

```typescript
import { FXAAEffectLayer } from "@navara/three";

const defaultEffects = view.addDefaultEffectLayers();

// Change quality to medium
defaultEffects.smaa.update({
  smaa: {
    quality: "medium",
  },
});

// Change edge detection mode to depth
defaultEffects.smaa.update({
  smaa: {
    edgeDetectionMode: "depth",
  },
});

// Disable SMAA and switch to FXAA
defaultEffects.smaa.update({ visible: false });
view.addLayer<FXAAEffectLayer>({
  type: "effect",
  fxaa: {},
});
```

## Notes

SMAAEffectLayer is applied at the final stage of the rendering pipeline. Use it when higher quality anti-aliasing than FXAA is needed. Quality presets can be selected from `low`, `medium`, `high`, and `ultra`. Edge detection modes can be selected from `color` (highest quality), `luma` (balanced), and `depth` (fastest).
