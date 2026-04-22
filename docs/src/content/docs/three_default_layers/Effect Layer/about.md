---
title: Effect Descriptor
description: Effect descriptor types for navara_three
sidebar:
  order: 50
---

`EffectLayer` is a descriptor type for applying post-processing effects to the rendering pipeline. You can add various visual effects such as anti-aliasing, depth of field, tone mapping, and more.

## Available EffectDescriptor Types

The following EffectDescriptor types are available in navara_three:

| Descriptor Type | Description |
|------------|------|
| [AerialPerspectiveEffectLayer](./aerial-perspective-effect-layer) | An effect that simulates light scattering and transmittance through the atmosphere |
| [CloudsEffectLayer](./clouds-effect-layer) | An effect that renders real-time volumetric clouds |
| [ColorGradingLUTEffectLayer](./color-grading-lut-effect-layer) | An effect that applies color grading using a LUT |
| [DepthOfFieldEffectLayer](./depth-of-field-effect-layer) | An effect that applies bokeh based on the camera's focal plane |
| [FogLightEffectLayer](./fog-light-effect-layer) | An effect that generates volumetric fog from point lights |
| [FXAAEffectLayer](./fxaa-effect-layer) | An effect that applies FXAA (Fast Approximate Anti-Aliasing) |
| [LensFlareEffectLayer](./lens-flare-effect-layer) | An effect that generates lens flares from the sun and moon |
| [RainDropEffectLayer](./rain-drop-effect-layer) | An effect that applies raindrop refraction to the screen |
| [SMAAEffectLayer](./smaa-effect-layer) | An effect that applies SMAA (Subpixel Morphological Anti-Aliasing) |
| [SSAOEffectLayer](./ssao-effect-layer) | An effect that applies screen-space ambient occlusion |
| [SSREffectLayer](./ssr-effect-layer) | An effect that generates real-time screen-space reflections |
| [ToneMappingEffectLayer](./tone-mapping-effect-layer) | An effect that performs HDR to LDR color adjustment |

## Basic Usage

EffectLayers are added by registering the descriptor class and then calling the `view.addEffect()` method:

```typescript
import ThreeView from "@navara/three";
import { AerialPerspectiveEffectLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// Register the descriptor class
view.registerEffect("aerialPerspective", AerialPerspectiveEffectLayer);

await view.init();

const aerialPerspectiveLayer = view.addEffect<AerialPerspectiveEffectLayer>({
  aerialPerspective: {},
});
```

## Common Properties

All EffectLayers have the following basic settings:

- `id`: A unique identifier for the layer
- `visible`: Toggles the layer's visibility

Refer to each descriptor type's documentation for detailed usage.
