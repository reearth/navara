---
title: DepthOfFieldEffectDesc
description: Depth of field effect descriptor for navara_three
sidebar:
  order: 53
---

The `DepthOfFieldEffectDesc` class is a Descriptor that applies a depth of field (DoF) effect. It generates bokeh based on the camera's focal plane, producing a photographic visual effect.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### focusDistance

**Type:** `number | undefined`

**Description:** Specifies the distance from the camera to the focus plane, in world units (meters). Objects at this distance appear sharp, while objects nearer or farther are progressively blurred.

**Default:** `1000`

**Example:**

```typescript
{
  depthOfField: {
    focusDistance: 500,
  }
}
```

### focalLength

**Type:** `number | undefined`

**Description:** Specifies the focus range in world units (meters). It controls how quickly sharpness falls off around the focus plane: a smaller value keeps only a narrow band around the focus distance in focus, while a larger value keeps a wider band sharp.

**Default:** `1000`

**Example:**

```typescript
{
  depthOfField: {
    focalLength: 300,
  }
}
```

### bokehScale

**Type:** `number | undefined`

**Description:** A multiplier applied to the blur kernel that scales the apparent size of bokeh highlights.

**Default:** `7`

**Example:**

```typescript
{
  depthOfField: {
    bokehScale: 10,
  }
}
```

## Usage Examples

### Adding a basic depth of field effect

```typescript
import ThreeView from "@navaramap/three";
import { DepthOfFieldEffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// Add depth of field effect descriptor
const depthOfFieldDesc = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: { },
  visible: true,
});
```

### Depth of field combined with 3D tiles

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { DepthOfFieldEffectDesc } from "@navaramap/three-default-descs";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic objects
const defaultLayers = plugin.addDefaultPhotorealScene();
defaultLayers.sun.update({
  sun: {
    intensity: 1,
    castShadow: true,
  },
});

// Add depth of field effect
const depthOfFieldDesc = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: {
    bokehScale: 7,
    focusDistance: 500,
    focalLength: 300,
  },
  visible: true,
});

// Add 3D tiles layer
const buildingsSource = view.addSource({
  type: "3d-tiles",
  url: "https://example.com/tileset.json",
});

view.addLayer({
  type: "3d-tiles",
  source: buildingsSource,
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 0.1,
    roughness: 0.1,
    castShadow: true,
    receiveShadow: true,
  },
});
```
