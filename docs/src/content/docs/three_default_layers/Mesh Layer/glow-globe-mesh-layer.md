---
title: GlowGlobeMeshLayer
description: Glow globe mesh layer for navara_three
sidebar:
  order: 108
---

The `GlowGlobeMeshLayer` class is a mesh layer that displays a Fresnel-effect glow around the globe. It mimics the scattering of light in the atmosphere, creating a beautiful halo effect along the edges of the Earth.

## Properties

### radiusScale

**Type:** `number`

**Description:** Specifies the radius scale factor of the glow sphere relative to the WGS84 ellipsoid's semi-major axis. The final glow sphere radius is this value multiplied by the WGS84 semi-major axis (Earth's equatorial radius). Setting values greater than 1.0 creates a glow sphere larger than the Earth's surface, representing an atmospheric effect. The Earth's oblateness is also taken into account.

**Default:** `1.2` (120% of Earth's equatorial radius: approximately 7,653,764 meters)

**Example:**

```typescript
{
  glowGlobe: {
    radiusScale: 1.1, // Glow sphere 10% larger than Earth (typical atmospheric effect)
  }
}
```

### coefficient

**Type:** `number`

**Description:** Specifies the coefficient that controls the glow threshold in the Fresnel calculation. This value is subtracted from the dot product of the surface normal and view direction, controlling where the glow begins. Larger values cause a more pronounced glow spreading toward the edges of the Earth.

**Default:** `0.5`

**Example:**

```typescript
{
  glowGlobe: {
    coefficient: 0.7, // More widespread glow
  }
}
```

### exponent

**Type:** `number`

**Description:** Specifies the exponent that controls the glow falloff intensity in the Fresnel calculation. Higher values produce a sharply concentrated glow at the center. Lower values produce a softer, more diffuse glow spreading outward. This parameter controls how quickly the glow intensity decreases from the center toward the edges.

**Default:** `5.0`

**Example:**

```typescript
{
  glowGlobe: {
    exponent: 3.0, // Softer, more diffuse glow
  }
}
```

### glowColor

**Type:** `Color`

**Description:** Specifies the color of the glow effect using a `Color` instance. The `Color` class supports hexadecimal color codes and CSS-style color specifications. The RGB components determine the hue of the glow, which is modulated by the calculated Fresnel intensity and opacity.

**Default:** `new Color().setHex(0x8cf3ff)` (light cyan)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  glowGlobe: {
    glowColor: new Color().setHex(0xff0000), // Red glow
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity/alpha channel of the glow effect. Controls the overall transparency of the glow layer. This value is used as the alpha component of the shader's color uniform. Lower values produce a more subtle, transparent glow, while higher values make it more opaque.

**Default:** `0.5`

**Range:** 0.0 ~ 1.0

**Example:**

```typescript
{
  glowGlobe: {
    opacity: 0.3, // More subtle glow
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { GlowGlobeMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a GlowGlobeMeshLayer
const glowLayer = view.addMesh<GlowGlobeMeshLayer>({
  glowGlobe: {
    radiusScale: 1.2,
    coefficient: 0.5,
    exponent: 5.0,
    glowColor: new Color().setHex(0x8cf3ff),
    opacity: 0.5,
  },
});
```

### Custom Color

```typescript
import { Color } from "@navara/three";

const glowLayer = view.addMesh<GlowGlobeMeshLayer>({
  glowGlobe: {
    radiusScale: 1.15,
    coefficient: 0.6,
    exponent: 4.0,
    glowColor: new Color().setHex(0x00ff88),  // Mint green
    opacity: 0.6,
  },
});
```

### Subtle Atmospheric Effect

```typescript
import { Color } from "@navara/three";

const glowLayer = view.addMesh<GlowGlobeMeshLayer>({
  glowGlobe: {
    radiusScale: 1.05,
    coefficient: 0.4,
    exponent: 6.0,
    glowColor: new Color().setHex(0x88ccff),
    opacity: 0.3,
  },
});
```

## Technical Details

GlowGlobeMeshLayer is implemented using a Fresnel-effect-based shader:

- **Geometry**: Sphere geometry based on the WGS84 ellipsoid, taking into account the Earth's oblateness
- **Material**: A custom shader material that computes glow intensity based on the viewing angle
- **Rendering**: Rendered as a transparent material using BackSide rendering

The glow effect is calculated based on the angle between the surface normal and the camera's view direction, being strongest at the edges of the Earth and decreasing toward the center.
