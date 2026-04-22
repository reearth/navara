---
title: ColorGradingLUTEffectDesc
description: Color grading LUT effect descriptor for navara_three
sidebar:
  order: 53
---

The `ColorGradingLUTEffectDesc` class is a layer that applies color grading effects using a LUT (Lookup Table). You can adjust the overall color tone of the scene using LUT textures such as 3DL files.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect descriptor.

**Default:** `true`

### url

**Type:** `string | undefined`

**Description:** Specifies the URL of the LUT file. 3DL format LUT files are supported.

**Default:** `"https://raw.githubusercontent.com/pmndrs/postprocessing/refs/heads/main/demo/static/textures/lut/3dl/presetpro-cinematic.3dl"`

**Example:**

```typescript
{
  colorGradingLUT: {
    url: "https://example.com/my-lut.3dl",
  }
}
```

### blendMode

**Type:** `BlendMode | undefined`

**Description:** Specifies the blend mode for the LUT effect.

**Default:** `"colorBurn"`

**Valid values:**

| Value | Description |
|---|---|
| `"normal"` | Normal blend |
| `"add"` | Additive blend |
| `"multiply"` | Multiply blend |
| `"screen"` | Screen blend |
| `"overlay"` | Overlay blend |
| `"colorBurn"` | Color burn (default) |
| `"colorDodge"` | Color dodge |
| `"softLight"` | Soft light |
| `"hardLight"` | Hard light |
| `"darken"` | Darken |
| `"lighten"` | Lighten |
| `"difference"` | Difference |
| `"exclusion"` | Exclusion |
| `"hue"` | Hue |
| `"saturation"` | Saturation |
| `"color"` | Color |
| `"luminosity"` | Luminosity |
| `"linearBurn"` | Linear burn |
| `"linearDodge"` | Linear dodge |
| `"linearLight"` | Linear light |
| `"vividLight"` | Vivid light |
| `"pinLight"` | Pin light |
| `"hardMix"` | Hard mix |

**Example:**

```typescript
{
  colorGradingLUT: {
    blendMode: "normal",
  }
}
```

### opacity

**Type:** `number | undefined`

**Description:** Specifies the opacity of the LUT effect in the range of 0.0 to 1.0.

**Default:** `0.78`

**Example:**

```typescript
{
  colorGradingLUT: {
    opacity: 0.5,
  }
}
```

## Usage Examples

### Adding basic color grading

```typescript
import ThreeView, { ColorGradingLUTEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add color grading LUT effect descriptor
const colorGradingLayer = view.addEffect<ColorGradingLUTEffectDesc>({
  colorGradingLUT: {},
});
```

### Color grading with a custom LUT

```typescript
import ThreeView, { ColorGradingLUTEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

plugin.addDefaultPhotorealScene();

// Add color grading with a custom LUT
const colorGradingLayer = view.addEffect<ColorGradingLUTEffectDesc>({
  colorGradingLUT: {
    url: "https://example.com/cinematic-lut.3dl",
    blendMode: "colorBurn",
    opacity: 0.8,
  },
});
```

### Dynamic color grading updates

```typescript
import ThreeView, { ColorGradingLUTEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

const colorGradingLayer = view.addEffect<ColorGradingLUTEffectDesc>({
  colorGradingLUT: {
    opacity: 0.5,
  },
});

// Update the opacity later
colorGradingLayer.update({
  colorGradingLUT: {
    opacity: 0.9,
  },
});
```

## Notes

By using LUTs, you can easily apply various color grading effects such as cinematic color tones and film looks. 3DL format LUT files can be created with video editing software such as DaVinci Resolve.
