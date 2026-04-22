---
title: SMAAEffectDesc
description: SMAA effect descriptor for navara_three
sidebar:
  order: 58
---

The `SMAAEffectDesc` class is a Descriptor that applies the SMAA (Subpixel Morphological Anti-Aliasing) anti-aliasing effect. It provides higher quality anti-aliasing than FXAA.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

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
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects (includes SMAA)
const defaultLayers = plugin.addDefaultPhotorealScene();

// Enable SMAA and set quality
defaultLayers.smaa.update({
  visible: true,
  smaa: {
    quality: "high",
    edgeDetectionMode: "color",
  },
});
```

### High-quality SMAA settings

```typescript
import ThreeView, { SMAAEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add SMAA effect descriptor
view.addEffect<SMAAEffectDesc>({
  smaa: {
    quality: "ultra",
    edgeDetectionMode: "luma",
  },
});
```

### Dynamically changing SMAA quality and edge detection mode

```typescript
import ThreeView, { FXAAEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// Change quality to medium
defaultLayers.smaa.update({
  smaa: {
    quality: "medium",
  },
});

// Change edge detection mode to depth
defaultLayers.smaa.update({
  smaa: {
    edgeDetectionMode: "depth",
  },
});

// Disable SMAA and switch to FXAA
defaultLayers.smaa.update({ visible: false });
view.addEffect<FXAAEffectDesc>({
  fxaa: {},
});
```

## Notes

SMAAEffectDesc is applied at the final stage of the rendering pipeline. Use it when higher quality anti-aliasing than FXAA is needed. Quality presets can be selected from `low`, `medium`, `high`, and `ultra`. Edge detection modes can be selected from `color` (highest quality), `luma` (balanced), and `depth` (fastest).
