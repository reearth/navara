---
title: SnowMeshLayer
description: Snow mesh layer for navara_three
sidebar:
  order: 110
---

The `SnowMeshLayer` class is a mesh layer that displays snow particle effects. It creates realistic snowfall effects using texture-based point sprites.

## Common Properties

### position

**Type:** `{ x: number, y: number, z: number } | Vector3`

**Description:** Specifies the center position of the snow particle effect in the ECEF coordinate system. You can convert from latitude/longitude using the `geodeticToVector3` function.

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
  snow: { ... }
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
  snow: { ... }
}
```

## Snow Properties

### particleCount

**Type:** `number`

**Description:** Specifies the number of snowflake particles.

**Default:** `30000`

**Example:**

```typescript
{
  snow: {
    particleCount: 3000,
  }
}
```

### radius

**Type:** `number`

**Description:** Specifies the distribution radius of the snow.

**Default:** `10`

**Example:**

```typescript
{
  snow: {
    radius: 15,
  }
}
```

### areaWidth

**Type:** `number`

**Description:** Specifies the width of the snowfall area.

**Default:** `500`

**Example:**

```typescript
{
  snow: {
    areaWidth: 500,
  }
}
```

### areaHeight

**Type:** `number`

**Description:** Specifies the height of the snowfall area.

**Default:** `1000`

**Example:**

```typescript
{
  snow: {
    areaHeight: 1000,
  }
}
```

### speed

**Type:** `number`

**Description:** Specifies the falling speed of the snowflakes.

**Default:** `0.00005`

**Example:**

```typescript
{
  snow: {
    speed: 0.001,
  }
}
```

### movementStrength

**Type:** `{ x: number, y: number, z: number }`

**Description:** Specifies the strength of wind-driven movement of snowflakes for each axis.

**Default:** `{ x: 50, y: 20, z: 50 }`

**Example:**

```typescript
{
  snow: {
    movementStrength: { x: 0.5, y: 0, z: 0.5 },
  }
}
```

### movementSpeed

**Type:** `{ x: number, y: number, z: number }`

**Description:** Specifies the speed of wind-driven movement of snowflakes for each axis.

**Default:** `{ x: 0.0005, y: 0.0002, z: 0.0005 }`

**Example:**

```typescript
{
  snow: {
    movementSpeed: { x: 0.001, y: 0, z: 0.001 },
  }
}
```

### size

**Type:** `number`

**Description:** Specifies the size of the snowflakes.

**Default:** `3`

**Example:**

```typescript
{
  snow: {
    size: 0.05,
  }
}
```

### color

**Type:** `number`

**Description:** The color of the snowflakes.

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  snow: {
    color: new Color().setStyle("#eeeeff").toHex(),
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the snowflakes.

**Default:** `1`

**Example:**

```typescript
{
  snow: {
    opacity: 0.8,
  }
}
```

### followCamera

**Type:** `boolean`

**Description:** Specifies whether the mesh follows the camera.

**Default:** `true`

**Example:**

```typescript
{
  snow: {
    followCamera: true,
  }
}
```

### maxHeight

**Type:** `number`

**Description:** Specifies the maximum altitude. Opacity decreases proportionally with camera altitude.

**Default:** `3000`

**Example:**

```typescript
{
  snow: {
    maxHeight: 5000,
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { SnowMeshLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a SnowMeshLayer
const snowLayer = view.addMesh<SnowMeshLayer>({
  snow: {
    particleCount: 3000,
    areaWidth: 500,
    areaHeight: 1000,
    speed: 0.001,
    movementStrength: { x: 0.3, y: 0, z: 0.3 },
    movementSpeed: { x: 0.0005, y: 0, z: 0.0005 },
    size: 0.05,
    opacity: 0.8,
    followCamera: true,
  },
});
```

### Placing Snow at a Specific Location

```typescript
import ThreeView, {
  SnowMeshLayer,
  Color,
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

// Add a SnowMeshLayer at a specific position
const snowLayer = view.addMesh<SnowMeshLayer>({
  visible: true,
  position: position,
  snow: {
    particleCount: 3000,
    speed: 0.001,
    color: new Color().setHex(0xffffff).toHex(),
    opacity: 0.8,
  },
});

// Toggle visibility
snowLayer.visible = false;
```
