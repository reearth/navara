---
title: DepthOfFieldEffectDesc
description: Depth of field effect descriptor for navara_three
sidebar:
  order: 53
---

The `DepthOfFieldEffectDesc` class is a layer that applies a depth of field (DoF) effect. It generates bokeh based on the camera's focal plane, producing a photographic visual effect.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### focusDistance

**Type:** `number | undefined`

**Description:** Specifies the normalized distance to the focus plane. Range is [0.0, 1.0].

**Default:** `0.000006`

**Example:**

```typescript
{
  depthOfField: {
    focusDistance: 0.5,
  }
}
```

### focalLength

**Type:** `number | undefined`

**Description:** Controls the focal length of the virtual lens. It controls how quickly sharpness falls off around the focus plane. Range is [0.0, 1.0].

**Default:** `0.000013`

**Example:**

```typescript
{
  depthOfField: {
    focalLength: 0.00001,
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
import ThreeView, { DepthOfFieldEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add depth of field effect descriptor
const depthOfFieldLayer = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: { },
  visible: true,
});
```

### Depth of field combined with 3D tiles

```typescript
import ThreeView, { DepthOfFieldEffectDesc, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers
const defaultLayers = plugin.addDefaultPhotorealScene();
defaultLayers.sun.update({
  sun: {
    intensity: 1,
    castShadow: true,
  },
});

// Add depth of field effect
const depthOfFieldLayer = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: {
    bokehScale: 7,
    focusDistance: 0.000006,
    focalLength: 0.000013,
  },
  visible: true,
});

// Add 3D tiles layer
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
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
