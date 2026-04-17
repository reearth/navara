---
title: SkyMeshLayer
description: Sky mesh layer for navara_three
sidebar:
  order: 111
---

The `SkyMeshLayer` class is a mesh layer that draws the sky, sun, and moon using atmospheric scattering. It provides realistic sky rendering using physics-based atmospheric scattering simulation.

The sun and moon positions are automatically calculated based on `view.atmosphere.date` and updated every frame.

:::tip[Related Documentation]
For details on the atmosphere system, see the [Atmosphere class](../../../three/api-reference/atmosphere/).
:::

## Properties

### visible

**Type:** `boolean`

**Description:** Toggles the visibility of the sky mesh.

**Example:**

```typescript
{ visible: true }
```

### sun

**Type:** `boolean`

**Description:** Specifies whether to display the sun.

**Default:** `true`

**Example:**

```typescript
{
  sky: {
    sun: true,
  }
}
```

### moon

**Type:** `boolean`

**Description:** Specifies whether to display the moon.

**Default:** `true`

**Example:**

```typescript
{
  sky: {
    moon: true,
  }
}
```

### moonScale

**Type:** `number`

**Description:** Specifies the scale of the moon.

**Default:** `1`

**Example:**

```typescript
{
  sky: {
    moonScale: 1.5,
  }
}
```

### moonIntensity

**Type:** `number`

**Description:** Specifies the brightness of the moon.

**Default:** `1`

**Example:**

```typescript
{
  sky: {
    moonIntensity: 0.8,
  }
}
```

### sunAngularRadius

**Type:** `number`

**Description:** Specifies the angular radius of the sun in radians.

**Default:** `0.004675`

**Example:**

```typescript
{
  sky: {
    sunAngularRadius: 0.005,
  }
}
```

### envMap

**Type:** `boolean`

**Description:** Specifies whether to render as an environment map.

**Default:** `false`

**Example:**

```typescript
{
  sky: {
    envMap: true,
  }
}
```

## Usage Examples

```typescript
import ThreeView, { SkyMeshLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a SkyMeshLayer
const skyLayer = view.addMesh<SkyMeshLayer>({
  sky: {
    visible: true,
    sun: true,
    moon: true,
    moonScale: 1.2,
    moonIntensity: 0.9,
    sunAngularRadius: 0.004675,
  },
});
```

## Technical Details

SkyMeshLayer is implemented using the @takram/three-atmosphere library and provides the following features:

- Physics-based atmospheric scattering simulation
- Dynamic lighting based on sun and moon positions
- Sky color changes according to time of day
- Atmospheric shadow length calculation

The sky mesh is automatically updated based on camera orientation and always covers the entire viewport.
