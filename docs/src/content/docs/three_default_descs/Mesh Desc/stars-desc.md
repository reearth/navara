---
title: StarsDesc
description: Stars Descriptor for navara_three
sidebar:
  order: 113
---

The `StarsDesc` class is a mesh descriptor that draws a starry sky. It uses point sprites based on actual astronomical catalogs to render a realistic starry sky.

Star positions account for the Earth's rotation based on `view.atmosphere.date`, and visibility is automatically adjusted based on the sun's position.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

:::tip[Related Documentation]
For details on the atmosphere system, see the [Atmosphere class](../../../three/api-reference/atmosphere/).
:::

## Properties

### visible

**Type:** `boolean`

**Description:** Toggles the visibility of the stars.

**Default:** `true`

**Example:**

```typescript
{ visible: true }
```

### pointSize

**Type:** `number`

**Description:** Specifies the point size of the stars.

**Default:** `1`

**Example:**

```typescript
{
  stars: {
    pointSize: 1.5,
  }
}
```

### intensity

**Type:** `number`

**Description:** Specifies the brightness intensity of the stars.

**Default:** `10`

**Example:**

```typescript
{
  stars: {
    intensity: 15,
  }
}
```

### background

**Type:** `boolean`

**Description:** Specifies whether to display as a background.

**Default:** `true`

**Example:**

```typescript
{
  stars: {
    background: true,
  }
}
```

### assetsUrl

**Type:** `string`

**Description:** Specifies the URL of the star data file.

**Example:**

```typescript
{
  stars: {
    assetsUrl: "https://example.com/stars.bin",
  }
}
```

## Usage Examples

```typescript
import ThreeView, { StarsDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a StarsDesc
const starsLayer = view.addMesh<StarsDesc>({
  stars: {
    visible: true,
    pointSize: 1.2,
    intensity: 12,
    background: true,
  },
});
```

## Technical Details

StarsDesc is implemented using the @takram/three-atmosphere library and provides the following features:

- Star placement based on actual astronomical catalog data
- Automatic adjustment of star visibility based on sun position
- Star rotation based on the Earth's rotation
- Star brightness adjustment considering atmospheric effects

Star data is loaded asynchronously and added to the scene once loading is complete.
