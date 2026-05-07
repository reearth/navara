---
title: SkyBoxMeshDesc
description: Sky box mesh descriptor for navara_three
sidebar:
  order: 112
---

`SkyBoxMeshDesc` is a Descriptor that adds a simple skybox to the scene. It allows setting day and night sky colors as well as the sun color, providing a lightweight sky representation without using atmospheric scattering simulation (`SkyMeshDesc`).

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### skyBox

**Type:** `object | undefined`

**Description:** Configuration options for the skybox.

#### dayColor

**Type:** `Color | undefined`

**Description:** Specifies the daytime sky color.

**Default:** `new Color().setHex(0x92c1ff)` (light blue)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb), // Sky blue
  }
}
```

#### nightColor

**Type:** `Color | undefined`

**Description:** Specifies the nighttime sky color.

**Default:** `new Color().setHex(0x000033)` (dark blue)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    nightColor: new Color().setHex(0x000022), // Darker blue
  }
}
```

#### sunColor

**Type:** `Color | undefined`

**Description:** Specifies the color around the sun.

**Default:** `new Color().setHex(0xffddae)` (light orange)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    sunColor: new Color().setHex(0xffd700), // Gold
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { SkyBoxMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a skybox with default settings
const skyBox = view.addMesh<SkyBoxMeshDesc>({
  skyBox: {},
});
```

### Custom Color Settings

```typescript
import ThreeView, { SkyBoxMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a skybox with custom colors
const skyBox = view.addMesh<SkyBoxMeshDesc>({
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb),    // Sky blue
    nightColor: new Color().setHex(0x0a0a2e),   // Dark blue
    sunColor: new Color().setHex(0xffa500),     // Orange
  },
});
```

### Dynamic Color Update

```typescript
// Change colors based on time of day
skyBox.update({
  skyBox: {
    dayColor: new Color().setHex(0xff6b6b),
    sunColor: new Color().setHex(0xff4500),
  },
});
```

## Differences from SkyMeshDesc

| Feature | SkyBoxMeshDesc | SkyMeshDesc |
|------|-----------------|--------------|
| Rendering method | Simple gradient | Physics-based atmospheric scattering |
| Performance | Lightweight | Slightly heavy |
| Realism | Basic | High |
| Sun/moon display | None | Yes |
| Atmosphere texture | Not required | Required |

### When to Use Each

- **SkyBoxMeshDesc**: Simple visualizations, performance-critical scenes, stylized representations
- **SkyMeshDesc**: Realistic atmospheric rendering, time-of-day variations, when sun/moon display is needed

## Notes

- The skybox has frustum culling disabled and is always rendered.
- Colors are blended between day and night based on the atmosphere's `sunDirection`.
- When used simultaneously with `SkyMeshDesc`, pay attention to rendering order.
