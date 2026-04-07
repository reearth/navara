---
title: SelectiveOutlineEffectLayer
description: Selective outline effect layer for navara_three
sidebar:
  order: 62
---

The `SelectiveOutlineEffectLayer` class is a layer that applies a selective outline effect. It uses mask-based filtering to draw outlines only on specific objects. It highlights object contours using edge detection with a Sobel filter.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

**Default:** `true`

### color

**Type:** `number | undefined`

**Description:** Specifies the outline color as a `Color`.

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  selectiveOutline: {
    color: new Color().setStyle("#ff0000"),
  }
}
```

### thickness

**Type:** `number | undefined`

**Description:** Specifies the thickness of the outline.

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    thickness: 2.0,
  }
}
```

### edgeStrength

**Type:** `number | undefined`

**Description:** Specifies the edge detection strength. Higher values emphasize edges more.

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    edgeStrength: 1.5,
  }
}
```

### resolutionScale

**Type:** `number | undefined`

**Description:** Specifies the rendering resolution scale factor. Lower values improve performance.

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    resolutionScale: 0.5,
  }
}
```

### debugViews

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable debug views. When enabled, views of mask textures are displayed.

**Default:** `false`

**Example:**

```typescript
{
  selectiveOutline: {
    debugViews: true,
  }
}
```

## Applying the Effect to Objects

To apply the selective outline effect to specific objects, specify the outline effect layer's ID in the target object's `effectIds` property.

### effectIds

An array of selective effect layer IDs to apply to the target object. When an outline effect layer is added, a unique ID is assigned, and the effect is applied by specifying this ID in the target object's `effectIds`.

### selectiveEffectOcclusion

Specifies the occlusion processing mode when applying the effect.

| Value | Description |
|----|------|
| `"normal"` | Normal mode. Enables depth testing and the effect is not applied to parts occluded by other objects (default) |
| `"silhouette"` | Silhouette mode. Disables depth testing and the effect is displayed even when the object is occluded |

## Usage Examples

### Adding a basic selective outline

```typescript
import ThreeView, {
  SelectiveOutlineEffectLayer,
  BoxMeshLayer,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

// Add selective outline effect layer
const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
    edgeStrength: 1.0,
  },
});

// Apply outline effect to an object
const cubeLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0x0088ff),
    effectIds: [outlineLayer.id], // Apply outline effect
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### Adding a colored outline

```typescript
import ThreeView, { SelectiveOutlineEffectLayer, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealLayers();

// Add a thick red outline
const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.5,
    edgeStrength: 1.5,
  },
});
```

### Performance-oriented settings

```typescript
import ThreeView, { SelectiveOutlineEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Performance-oriented settings
const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
    edgeStrength: 1.0,
    resolutionScale: 0.5, // Lower resolution for improved performance
  },
});
```

### Dynamic outline effect updates

```typescript
import ThreeView, { SelectiveOutlineEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
  },
});

// Update parameters later
outlineLayer.update({
  selectiveOutline: {
    color: new Color().setHex(0x00ff00), // Green
    thickness: 2.0,
  },
});
```

### Applying outlines to 3D Tiles

```typescript
import ThreeView, { SelectiveOutlineEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.0,
  },
});

// Apply outline to 3D Tiles buildings
const buildingsLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    effectIds: [outlineLayer.id],
    selectiveEffectOcclusion: "normal",
  },
});
```

### Using silhouette mode

An example of highlighting objects behind buildings:

```typescript
import ThreeView, {
  SelectiveOutlineEffectLayer,
  BoxMeshLayer,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0x00ff00),
    thickness: 2.0,
  },
});

// Silhouette mode: outline is visible even behind buildings
const highlightedCube = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    effectIds: [outlineLayer.id],
    selectiveEffectOcclusion: "silhouette", // Visible even when occluded
  },
  position: { x: 0, y: 0, z: 500 },
});
```

### Combining bloom and outline

```typescript
import ThreeView, {
  SelectiveBloomEffectLayer,
  SelectiveOutlineEffectLayer,
  BoxMeshLayer,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 1.0,
  },
});

const outlineLayer = view.addLayer<SelectiveOutlineEffectLayer>({
  type: "effect",
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.0,
  },
});

// Apply both effects
const cubeLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    emissiveIntensity: 1.0,
    effectIds: [bloomLayer.id, outlineLayer.id], // Apply both
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

## Notes

- The selective outline effect draws object contours using edge detection with a Sobel filter.
- It is suitable for highlighting or focusing on selected objects.
- The default value of `selectiveEffectOcclusion` is `"normal"`. The `"silhouette"` mode is used when you intentionally want to display occluded objects.
- Rendering is done in two passes: DepthEnabled objects (with depth clipping) and Silhouette objects (without depth clipping), to correctly handle occlusion.
