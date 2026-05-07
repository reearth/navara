---
title: ArclineMeshDesc
description: Arcline mesh descriptor for navara_three
sidebar:
  order: 101
---

The `ArclineMeshDesc` class is a mesh descriptor for drawing arc-shaped lines connecting two points. It is used to visually connect two locations on the globe and provides features such as gradients, dashed patterns, and height adjustment.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### arcLines

**Type:** `Partial<ArcLineConfig> | Partial<ArcLineConfig>[] | undefined`

**Description:** Specifies the arc line configuration. Multiple arc lines can be managed in a single Descriptor by passing an array.

**Example:**

```typescript
{
  arcLines: {
    thickness: 2,
    srcColor: 0xff0000,
    tgtColor: 0x0000ff,
    geometry: [
      { lng: 139.7, lat: 35.7 },
      { lng: -74.0, lat: 40.7 }
    ]
  }
}
```

### thickness

**Type:** `number`

**Description:** Specifies the thickness of the arc line.

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    thickness: 2,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** Specifies whether to enable transparency.

**Default:** `false`

**Example:**

```typescript
{
  arcLines: {
    transparent: true,
  }
}
```

### opacity

**Type:** `number`

**Description:** Specifies the opacity of the arc line. Ranges from 0.0 (fully transparent) to 1.0 (fully opaque).

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    opacity: 0.8,
  }
}
```

### segments

**Type:** `number`

**Description:** Specifies the number of segments that make up the arc line. Higher values produce smoother curves.

**Default:** `64`

**Example:**

```typescript
{
  arcLines: {
    segments: 128,
  }
}
```

### srcColor

**Type:** `number`

**Description:** Specifies the color of the arc line's starting point as a hexadecimal color code (0x + hex).

**Default:** `0xffffff`

**Example:**

```typescript
{
  arcLines: {
    srcColor: 0xff0000,
  }
}
```

### tgtColor

**Type:** `number`

**Description:** Specifies the color of the arc line's ending point as a hexadecimal color code (0x + hex).

**Default:** `0xffffff`

**Example:**

```typescript
{
  arcLines: {
    tgtColor: 0x0000ff,
  }
}
```

### height

**Type:** `number`

**Description:** Specifies the height above the Earth's surface in meters.

**Default:** `0`

**Example:**

```typescript
{
  arcLines: {
    height: 10000, // 10km
  }
}
```

### arcHeightScale

**Type:** `number`

**Description:** Specifies the scale factor for the arc height. Determines the relative height based on the distance between the two points.

**Default:** `0.3`

**Example:**

```typescript
{
  arcLines: {
    arcHeightScale: 0.5,
  }
}
```

### gradation

**Type:** `number`

**Description:** Specifies the color gradient factor. Values closer to 0 emphasize the source color, while values closer to 1 emphasize the target color.

**Default:** `0.5`

**Example:**

```typescript
{
  arcLines: {
    gradation: 0.7,
  }
}
```

### dashed

**Type:** `boolean`

**Description:** Specifies whether to enable a dashed pattern.

**Default:** `false`

**Example:**

```typescript
{
  arcLines: {
    dashed: true,
  }
}
```

### dashSize

**Type:** `number`

**Description:** Specifies the dash length in world units.

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    dashSize: 5000,
  }
}
```

### gapSize

**Type:** `number`

**Description:** Specifies the gap between dashes in world units.

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    gapSize: 2000,
  }
}
```

### dashOffset

**Type:** `number`

**Description:** Specifies the offset of the dash pattern in world units.

**Default:** `0`

**Example:**

```typescript
{
  arcLines: {
    dashOffset: 1000,
  }
}
```

### geometry

**Type:** `LngLat[]`

**Description:** Specifies the points that make up the arc line as an array of longitude and latitude. Two points create one arc line.

**Default:** `[]`

**Example:**

```typescript
{
  arcLines: {
    geometry: [
      { lng: 139.7671, lat: 35.6812 },  // Tokyo
      { lng: -74.0060, lat: 40.7128 }   // New York
    ],
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import ThreeView, { ArclineMeshDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add an ArclineMeshDesc
const arclineDesc = view.addMesh<ArclineMeshDesc>({
  arcLines: {
    thickness: 2,
    srcColor: 0xff0000,
    tgtColor: 0x0000ff,
    arcHeightScale: 0.3,
    segments: 128,
    geometry: [
      { lng: 139.7671, lat: 35.6812 },  // Tokyo
      { lng: -74.0060, lat: 40.7128 },  // New York
    ],
  },
});
```

### Multiple Arc Lines

```typescript
const arclineDesc = view.addMesh<ArclineMeshDesc>({
  arcLines: [
    {
      thickness: 2,
      srcColor: 0xff0000,
      tgtColor: 0x00ff00,
      geometry: [
        { lng: 139.7, lat: 35.7 },
        { lng: -0.1, lat: 51.5 },
      ],
    },
    {
      thickness: 3,
      srcColor: 0x0000ff,
      tgtColor: 0xffff00,
      dashed: true,
      dashSize: 5000,
      gapSize: 2000,
      geometry: [
        { lng: -74.0, lat: 40.7 },
        { lng: 2.3, lat: 48.9 },
      ],
    },
  ],
});
```

### Dynamic Update

```typescript
// Update the Descriptor settings
arclineDesc.update({
  arcLines: {
    thickness: 5,
    opacity: 0.5,
  },
});
```
