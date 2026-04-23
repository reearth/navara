---
title: SmoothLineMeshDesc
description: Smooth line mesh descriptor for navara_three
sidebar:
  order: 107
---

The `SmoothLineMeshDesc` class is a mesh descriptor for drawing smooth lines using Catmull-Rom curves. It generates smooth curves from an array of points and also supports dashed patterns and point marker display.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### tension

**Type:** `number`

**Description:** Specifies the tension of the curve. 0 produces a straight line; higher values produce smoother curves.

**Default:** `0.5`

**Example:**

```typescript
{
  smoothLines: {
    tension: 0.8,
  }
}
```

### closed

**Type:** `boolean`

**Description:** Specifies whether to create a closed curve by connecting the last point to the first point.

**Default:** `false`

**Example:**

```typescript
{
  smoothLines: {
    closed: true,
  }
}
```

### segments

**Type:** `number`

**Description:** Specifies the number of interpolation segments between each point.

**Default:** `1`

**Example:**

```typescript
{
  smoothLines: {
    segments: 10,
  }
}
```

### lineWidth

**Type:** `number`

**Description:** Specifies the line thickness in pixels.

**Default:** `1`

**Example:**

```typescript
{
  smoothLines: {
    lineWidth: 3,
  }
}
```

### dashed

**Type:** `boolean`

**Description:** Specifies whether to render with a dashed pattern.

**Default:** `false`

**Example:**

```typescript
{
  smoothLines: {
    dashed: true,
  }
}
```

### dashSize

**Type:** `number`

**Description:** Specifies the length of each dash.

**Default:** `1000`

**Example:**

```typescript
{
  smoothLines: {
    dashSize: 500,
  }
}
```

### dashOffset

**Type:** `number`

**Description:** Specifies the offset of the dash pattern.

**Default:** `0`

**Example:**

```typescript
{
  smoothLines: {
    dashOffset: 100,
  }
}
```

### gapSize

**Type:** `number`

**Description:** Specifies the gap length between dashes.

**Default:** `500`

**Example:**

```typescript
{
  smoothLines: {
    gapSize: 300,
  }
}
```

### color

**Type:** `number`

**Description:** Specifies the line color as a hexadecimal color code (0x + hex).

**Default:** `0xffffff`

**Example:**

```typescript
{
  smoothLines: {
    // color omitted in example to focus on geometry settings
  }
}
```

### showPoints

**Type:** `boolean`

**Description:** Specifies whether to display sample points on the line.

**Default:** `true`

**Example:**

```typescript
{
  smoothLines: {
    showPoints: false,
  }
}
```

### pointSize

**Type:** `number`

**Description:** Specifies the size of point markers.

**Default:** `2`

**Example:**

```typescript
{
  smoothLines: {
    pointSize: 5,
  }
}
```

### pointColor

**Type:** `number`

**Description:** Specifies the color of point markers as a hexadecimal color code (0x + hex).

**Default:** `0xffffff`

**Example:**

```typescript
{
  smoothLines: {
    // pointColor omitted in example
  }
}
```

### points

**Type:** `LngLatHeight[]`

**Description:** Specifies the points that make up the line as an array of longitude, latitude, and height.

**Default:** `[]`

**Example:**

```typescript
{
  smoothLines: {
    points: [
      { lng: 139.7671, lat: 35.6812, height: 100 },
      { lng: 139.7700, lat: 35.6850, height: 150 },
      { lng: 139.7750, lat: 35.6900, height: 100 }
    ],
  }
}
```

## Usage Examples

```typescript
import ThreeView, { SmoothLineMeshDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a SmoothLineMeshDesc
const smoothLineLayer = view.addMesh<SmoothLineMeshDesc>({
  smoothLines: {
    tension: 0.5,
    segments: 10,
    lineWidth: 3,
    // color omitted in example
    showPoints: true,
    pointSize: 5,
    // pointColor omitted in example
    points: [
      { lng: 139.7671, lat: 35.6812, height: 100 },
      { lng: 139.7700, lat: 35.6850, height: 150 },
      { lng: 139.7750, lat: 35.6900, height: 100 },
    ],
  },
});
```
