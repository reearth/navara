---
title: FXAAEffectLayer
description: FXAA effect layer for navara_three
sidebar:
  order: 54
---

The `FXAAEffectLayer` class is a layer that applies the FXAA (Fast Approximate Anti-Aliasing) anti-aliasing effect. It reduces jagged edges in the image, producing a smoother appearance.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

**Default:** `true`

**Example:**
```typescript
{ visible: true }
```

## Usage Examples

### Enabling FXAA anti-aliasing

```typescript
import ThreeView, { FXAAEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add FXAA effect layer
view.addLayer<FXAAEffectLayer>({
  type: "effect",
  fxaa: {},
});
```

## Notes

FXAAEffectLayer does not have special configuration parameters. It is applied at the final stage of the rendering pipeline. It is lighter than SMAA but slightly lower in quality. It is suitable when performance is a priority.
