---
title: RainDropEffectLayer
description: Rain drop effect layer for navara_three
sidebar:
  order: 57
---

The `RainDropEffectLayer` class is a layer that applies raindrop refraction effects to the screen. It generates an animation effect of raindrops flowing down the screen.

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** Controls the visibility of the effect layer.

**Default:** `true`

### opacity

**Type:** `number | undefined`

**Description:** Specifies the opacity applied after shader execution. Useful for blending the effect.

**Default:** `1`

**Example:**

```typescript
{
  rainDrop: {
    opacity: 0.8,
  }
}
```

### dropGridSize

**Type:** `number | undefined`

**Description:** Specifies the size of the UV grid used to place raindrops. Larger values result in smaller cells.

**Default:** `12`

**Example:**

```typescript
{
  rainDrop: {
    dropGridSize: 15,
  }
}
```

### dropDensity

**Type:** `number | undefined`

**Description:** Specifies a multiplier within the shader that controls the number of raindrops generated.

**Default:** `1`

**Example:**

```typescript
{
  rainDrop: {
    dropDensity: 1.5,
  }
}
```

### dropLayers

**Type:** `number | undefined`

**Description:** Specifies the number of active layers to simulate. Higher values add smaller raindrops but increase cost.

**Default:** `4`

**Example:**

```typescript
{
  rainDrop: {
    dropLayers: 3,
  }
}
```

### dropSizeFactor

**Type:** `number | undefined`

**Description:** Scales the grid size to control how densely packed the raindrops are.

**Default:** `0.015`

**Example:**

```typescript
{
  rainDrop: {
    dropSizeFactor: 0.02,
  }
}
```

### noiseScale

**Type:** `number | undefined`

**Description:** Scales the noise that drives jitter and refraction fluctuations.

**Default:** `200`

**Example:**

```typescript
{
  rainDrop: {
    noiseScale: 250,
  }
}
```

### refractionStrength

**Type:** `number | undefined`

**Description:** Specifies the strength of UV distortion caused by refraction.

**Default:** `0.3`

**Example:**

```typescript
{
  rainDrop: {
    refractionStrength: 0.5,
  }
}
```

### minDropStrength

**Type:** `number | undefined`

**Description:** Specifies the minimum strength required before a raindrop is rendered.

**Default:** `0.01`

**Example:**

```typescript
{
  rainDrop: {
    minDropStrength: 0.02,
  }
}
```

### dropFadeStart

**Type:** `number | undefined`

**Description:** Specifies the start of the smooth fade window for raindrop visibility.

**Default:** `0.3`

**Example:**

```typescript
{
  rainDrop: {
    dropFadeStart: 0.4,
  }
}
```

### dropFadeEnd

**Type:** `number | undefined`

**Description:** Specifies the end of the smooth fade window for raindrop visibility.

**Default:** `0.8`

**Example:**

```typescript
{
  rainDrop: {
    dropFadeEnd: 0.9,
  }
}
```

### dropThresholdFactor

**Type:** `number | undefined`

**Description:** Specifies the base threshold factor that controls spawn probability.

**Default:** `0.08`

**Example:**

```typescript
{
  rainDrop: {
    dropThresholdFactor: 0.1,
  }
}
```

### gridDensityLow

**Type:** `number | undefined`

**Description:** Specifies the adjustment applied when density is low.

**Default:** `1.15`

**Example:**

```typescript
{
  rainDrop: {
    gridDensityLow: 1.2,
  }
}
```

### gridDensityHigh

**Type:** `number | undefined`

**Description:** Specifies the adjustment applied when density is high.

**Default:** `0.85`

**Example:**

```typescript
{
  rainDrop: {
    gridDensityHigh: 0.9,
  }
}
```

### jitterStrengthLow

**Type:** `number | undefined`

**Description:** Specifies the maximum jitter for sparse raindrops.

**Default:** `0.45`

**Example:**

```typescript
{
  rainDrop: {
    jitterStrengthLow: 0.5,
  }
}
```

### jitterStrengthHigh

**Type:** `number | undefined`

**Description:** Specifies the minimum jitter for densely packed raindrops.

**Default:** `0.08`

**Example:**

```typescript
{
  rainDrop: {
    jitterStrengthHigh: 0.1,
  }
}
```

## Usage Examples

### Adding a basic raindrop effect

```typescript
import ThreeView, { RainDropEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Enable animation (required for raindrops to flow)
view.animation = true;

// Add default effects
view.addDefaultEffectLayers();
view.addDefaultAtmosphereLayers();

// Add raindrop effect layer
const rainDropLayer = view.addLayer<RainDropEffectLayer>({
  type: "effect",
  rainDrop: {
    opacity: 0.85,
    dropGridSize: 14,
    dropDensity: 0.8,
    dropLayers: 3,
    refractionStrength: 0.3,
  },
  visible: true,
});
```

## Notes

This effect has `allowDuplication` set to `true`, so multiple RainDropEffectLayer instances can be created. It provides a raindrop effect that animates over time. You need to set `view.animation = true` to enable the animation.
