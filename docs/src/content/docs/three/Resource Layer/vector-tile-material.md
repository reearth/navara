---
title: VectorTileMaterial
description: Vector tile material for navara_three
sidebar:
  order: 39
---

`VectorTileMaterial` represents a material for vector tile rendering.

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the vector tile casts shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    castShadow: true
  }
}
```

### layers

**Type:** `string[] | undefined`

**Description:** Specifies the names of vector tile layers to render. Multiple layers can be specified as an array. If not specified, all layers are displayed.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    layers: ["buildings", "roads", "water"]
  }
}
```

### maxSse

**Type:** `number | undefined`

**Description:** The maximum value used to determine the level of detail (LOD). Higher values improve performance but reduce visual quality.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    maxSse: 16
  }
}
```

### maxZoom

**Type:** `number | undefined`

**Description:** Specifies the maximum zoom level for vector tiles.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    maxZoom: 18
  }
}
```

### overscaledMaxZoom

**Type:** `number | undefined`

**Description:** Specifies the maximum zoom level for overscaled tiles beyond the maximum zoom level. This is effective when `clampToGround` is `true` on other materials.

**Default:** `24`

**Example:**

```typescript
{
  vectorTile: {
    overscaledMaxZoom: 20
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the vector tile receives shadows from other materials.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    receiveShadow: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the vector tile.

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    show: true
  }
}
```
