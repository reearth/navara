---
title: SelectiveBloomEffectLayer
description: Selective bloom effect descriptor for navara_three
sidebar:
  order: 61
---

The `SelectiveBloomEffectLayer` class is a layer that applies a selective bloom effect. It uses mask-based filtering to apply the bloom effect only to specific objects.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### strength

**Type:** `number | undefined`

**Description:** Specifies the strength of the bloom effect.

**Default:** `0.8`

**Example:**

```typescript
{
  selectiveBloom: {
    strength: 1.2,
  }
}
```

### radius

**Type:** `number | undefined`

**Description:** Specifies the radius (blur spread) of the bloom effect.

**Default:** `0.2`

**Example:**

```typescript
{
  selectiveBloom: {
    radius: 0.4,
  }
}
```

### threshold

**Type:** `number | undefined`

**Description:** Specifies the threshold for the bloom effect. Only pixels brighter than this value will have bloom applied.

**Default:** `0.0`

**Example:**

```typescript
{
  selectiveBloom: {
    threshold: 0.5,
  }
}
```

### debugMode

**Type:** `number | undefined`

**Description:** Specifies the debug mode.
- `0`: Normal mode
- `1`: Show base only
- `2`: Show bloom only
- `3`: Show bloom emphasized (100x)

**Default:** `0`

**Example:**

```typescript
{
  selectiveBloom: {
    debugMode: 2,
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
  selectiveBloom: {
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
  selectiveBloom: {
    debugViews: true,
  }
}
```

## Applying the Effect to Objects

To apply the selective bloom effect to specific objects, specify the bloom effect descriptor's ID in the target object's `effectIds` property.

### effectIds

An array of selective effect descriptor IDs to apply to the target object. When a bloom effect descriptor is added, a unique ID is assigned, and the effect is applied by specifying this ID in the target object's `effectIds`.

### emissiveColor (optional)

Specifies the bloom source color. When not set, the material's surface color (diffuseColor) is automatically used as the bloom source. This means you can enable bloom with just `effectIds` and `emissiveIntensity` without explicitly specifying a color.

### emissiveIntensity

Controls the intensity of the bloom source. Higher values produce brighter bloom.

### selectiveEffectOcclusion

Specifies the occlusion processing mode when applying the effect.

| Value | Description |
|----|------|
| `"normal"` | Normal mode. Enables depth testing and the effect is not applied to parts occluded by other objects (default) |
| `"silhouette"` | Silhouette mode. Disables depth testing and the effect is displayed even when the object is occluded |

## Usage Examples

### Adding a basic selective bloom

```typescript
import ThreeView, {
  SelectiveBloomEffectLayer,
  BoxMeshLayer,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

// Add selective bloom effect descriptor
const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 0.8,
    radius: 0.2,
    threshold: 0.0,
  },
});

// Apply bloom effect to an object
// When emissiveColor is not set, the material's color is used as the bloom source
const cubeLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    emissiveIntensity: 1.0, // Controls bloom brightness
    effectIds: [bloomLayer.id],
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### Strong bloom effect

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealScene();

// Add a strong bloom effect
const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 1.5,
    radius: 0.5,
    threshold: 0.2,
  },
});
```

### Performance-oriented settings

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Performance-oriented settings
const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 0.6,
    radius: 0.2,
    threshold: 0.0,
    resolutionScale: 0.5, // Lower resolution for improved performance
  },
});
```

### Dynamic bloom effect updates

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 0.8,
  },
});

// Update parameters later
bloomLayer.update({
  selectiveBloom: {
    strength: 1.2,
    radius: 0.3,
  },
});
```

### Applying bloom to 3D Tiles

```typescript
import ThreeView, { SelectiveBloomEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 1.0,
    radius: 0.5,
  },
});

// Apply bloom to 3D Tiles buildings
// emissiveColor is optional — the model's own color is used when omitted
const buildingsLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    effectIds: [bloomLayer.id],
    emissiveIntensity: 0.3,
    selectiveEffectOcclusion: "normal",
  },
});
```

### Applying bloom to GeoJSON models

```typescript
import ThreeView, { SelectiveBloomEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addEffect<SelectiveBloomEffectLayer>({
  selectiveBloom: {
    strength: 1.2,
  },
});

// Apply bloom to GeoJSON layer models
// emissiveColor is optional — the model's own color is used when omitted
const modelLayer = view.addLayer({
  type: "geojson",
  data: featureCollection,
  model: {
    show: true,
    size: 100,
    url: "model.glb",
    effectIds: [bloomLayer.id],
    emissiveIntensity: 0.5,
    selectiveEffectOcclusion: "normal",
  },
});
```

### Dynamically toggling the effect

```typescript
// Initially no effects applied
const cubeLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    effectIds: [],
  },
  position: { x: 0, y: 0, z: 1000 },
});

// Add bloom effect later
cubeLayer.update({
  box: {
    effectIds: [bloomLayer.id],
    emissiveIntensity: 1.0,
  },
});

// Disable the effect
cubeLayer.update({
  box: {
    effectIds: [],
  },
});
```

## Notes

- The selective bloom effect uses mask-based filtering to apply bloom only to specific objects.
- When `emissiveColor` is not set, the material's surface color (diffuseColor) is automatically used as the bloom source. This includes per-instance colors for InstancedMesh and texture colors for textured materials.
- To use the bloom effect effectively, it is important to set the object's `emissiveIntensity` appropriately.
- The default value of `selectiveEffectOcclusion` is `"normal"`. The `"silhouette"` mode is used when you intentionally want to display occluded objects.
- Rendering is done in two passes: DepthEnabled objects (with depth clipping) and Silhouette objects (without depth clipping), to correctly handle occlusion.
