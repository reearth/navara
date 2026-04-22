---
title: RainMeshLayer
description: Rain mesh descriptor for navara_three
sidebar:
  order: 109
---

The `RainMeshLayer` class is a mesh descriptor that displays rain particle effects. It creates realistic rainfall effects using a shader-based particle system.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-layer-base) for details.

## Common Properties

### position

**Type:** `{ x: number, y: number, z: number } | Vector3`

**Description:** Specifies the center position of the rain particle effect in the ECEF coordinate system. You can convert from latitude/longitude using the `geodeticToVector3` function.

**Example:**

```typescript
import { geodeticToVector3, degreeToRadian, LLE } from "@navara/three";

const position = geodeticToVector3(
  new LLE(
    degreeToRadian(35.67564356091717),  // Latitude
    degreeToRadian(139.74511454748298), // Longitude
    10,                                  // Altitude
  ),
);

{
  position: position,
  rain: { ... }
}
```

### visible

**Type:** `boolean`

**Description:** Controls the visibility of the layer.

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  rain: { ... }
}
```

## Rain Properties

### particleCount

**Type:** `number`

**Description:** Specifies the number of raindrop particles.

**Default:** `5000`

**Example:**

```typescript
{
  rain: {
    particleCount: 10000,
  }
}
```

### speed

**Type:** `number`

**Description:** Specifies the falling speed of the raindrops.

**Default:** `0.0015`

**Example:**

```typescript
{
  rain: {
    speed: 0.002,
  }
}
```

### color

**Type:** `number`

**Description:** The color of the raindrops.

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  rain: {
    // Use toHex() when specifying from a Color
    color: new Color().setStyle("#aaaaff").toHex(),
  }
}
```

### areaWidth

**Type:** `number`

**Description:** Specifies the width of the rainfall area.

**Default:** `500`

**Example:**

```typescript
{
  rain: {
    areaWidth: 800,
  }
}
```

### areaHeight

**Type:** `number`

**Description:** Specifies the height of the rainfall area.

**Default:** `1000`

**Example:**

```typescript
{
  rain: {
    areaHeight: 1500,
  }
}
```

### width

**Type:** `number`

**Description:** Specifies the width of individual raindrops.

**Default:** `3.0`

**Example:**

```typescript
{
  rain: {
    width: 5.0,
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height of individual raindrops.

**Default:** `60`

**Example:**

```typescript
{
  rain: {
    height: 80,
  }
}
```

### radius

**Type:** `number`

**Description:** Specifies the radius of the rainfall area.

**Default:** `10`

**Example:**

```typescript
{
  rain: {
    radius: 20,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the raindrops.

**Default:** `0.5`

**Example:**

```typescript
{
  rain: {
    opacity: 0.7,
  }
}
```

### alphaMax

**Type:** `number`

**Description:** Specifies the maximum alpha value of raindrops on the lit side.

**Default:** `0.5`

**Example:**

```typescript
{
  rain: {
    alphaMax: 0.7,
  }
}
```

### alphaMin

**Type:** `number`

**Description:** Specifies the minimum alpha value of raindrops on the shadowed side.

**Default:** `0.05`

**Example:**

```typescript
{
  rain: {
    alphaMin: 0.1,
  }
}
```

### followCamera

**Type:** `boolean`

**Description:** Specifies whether the mesh follows the camera. This creates the effect of the mesh being rendered infinitely.

**Default:** `true`

**Example:**

```typescript
{
  rain: {
    followCamera: false,
  }
}
```

### maxHeight

**Type:** `number`

**Description:** Specifies the maximum altitude at which opacity decreases proportionally with camera height.

**Default:** `3000`

**Example:**

```typescript
{
  rain: {
    maxHeight: 5000,
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { RainMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a RainMeshLayer
const rainLayer = view.addMesh<RainMeshLayer>({
  rain: {
    particleCount: 5000,
    speed: 0.002,
    color: new Color().setStyle("#aaaaff").toHex(),
    areaWidth: 500,
    areaHeight: 1000,
    opacity: 0.6,
    followCamera: true,
  },
});
```

### Placing Rain at a Specific Location

```typescript
import ThreeView, {
  RainMeshLayer,
  geodeticToVector3,
  degreeToRadian,
  LLE,
} from "@navara/three";

const view = new ThreeView({ animation: true });
await view.init();

// Calculate the position of Tokyo
const position = geodeticToVector3(
  new LLE(
    degreeToRadian(35.67564356091717),
    degreeToRadian(139.74511454748298),
    10,
  ),
);

// Add a RainMeshLayer at a specific position
const rainLayer = view.addMesh<RainMeshLayer>({
  visible: true,
  position: position,
  rain: {
    particleCount: 5000,
    speed: 0.0015,
    opacity: 0.5,
  },
});

// Toggle visibility
rainLayer.visible = false;
```
