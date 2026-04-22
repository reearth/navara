---
title: SSAOEffectLayer
description: SSAO effect descriptor for navara_three
sidebar:
  order: 59
---

The `SSAOEffectLayer` class is a layer that applies the Screen Space Ambient Occlusion (SSAO) effect. It adds dark shadows to crevices and concavities in the geometry, producing a more three-dimensional appearance.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### samples

**Type:** `number | null | undefined`

**Description:** Specifies the number of AO samples.

**Default:** `null`

**Example:**

```typescript
{
  ssao: {
    samples: 16,
  }
}
```

### radius

**Type:** `number | null | undefined`

**Description:** Specifies the AO influence radius.

**Default:** `null`

**Example:**

```typescript
{
  ssao: {
    radius: 5,
  }
}
```

### intensity

**Type:** `number | undefined`

**Description:** Specifies the intensity of the AO effect.

**Default:** `1`

**Example:**

```typescript
{
  ssao: {
    intensity: 1.5,
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** Specifies the AO color.

**Default:** `new Color().setHex(0x000000)` (black)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  ssao: {
    color: new Color().setHex(0x000000),
  }
}
```

### halfRes

**Type:** `boolean | null | undefined`

**Description:** Specifies whether to render at half resolution. Useful for improving performance.

**Default:** `false`

**Example:**

```typescript
{
  ssao: {
    halfRes: true,
  }
}
```

### quality

**Type:** `"Low" | "Medium" | "High" | "Ultra" | undefined`

**Description:** Specifies the SSAO quality mode.

**Default:** `"Low"`

**Example:**

```typescript
{
  ssao: {
    quality: "High",
  }
}
```

## Usage Examples

### Adding a basic SSAO effect

```typescript
import ThreeView, { SSAOEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add SSAO effect descriptor
const ssaoLayer = view.addEffect<SSAOEffectLayer>({
  visible: true,
  ssao: {},
});
```

### High-quality SSAO settings

```typescript
import ThreeView, { SSAOEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add high-quality SSAO
const ssaoLayer = view.addEffect<SSAOEffectLayer>({
  visible: true,
  ssao: {
    quality: "High",
    samples: 16,
    radius: 5,
    intensity: 1.5,
    color: new Color().setHex(0x000000),
  },
});
```

### Performance-oriented SSAO settings

```typescript
import ThreeView, { SSAOEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Improve performance with half resolution
const ssaoLayer = view.addEffect<SSAOEffectLayer>({
  visible: true,
  ssao: {
    quality: "Low",
    halfRes: true,
  },
});
```

### Usage combined with default effects

```typescript
import ThreeView, { SSAOEffectLayer, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// Add default photorealistic layers
plugin.addDefaultPhotorealScene();

// Add SSAO
const ssaoLayer = view.addEffect<SSAOEffectLayer>({
  visible: true,
  ssao: {
    quality: "High",
    halfRes: true,
    samples: 16,
    radius: 5,
    intensity: 1,
    color: new Color().setHex(0x000000),
  },
});

// Use combined with 3D tiles
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
  },
});
```

## See Also

- [Color class](../../../three/api-reference/color/) - How to configure colors
