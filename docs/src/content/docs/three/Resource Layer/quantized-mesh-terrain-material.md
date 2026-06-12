---
title: QuantizedMeshTerrainMaterial
description: Quantized-mesh terrain material for navara_three
sidebar:
  order: 41
---

`QuantizedMeshTerrainMaterial` represents a material for rendering terrain from [quantized-mesh](https://github.com/CesiumGS/quantized-mesh) tile endpoints. Use it via the `quantizedMesh` key on a [Terrain Layer](../../../three/resource-layer/terrain-layer/).

For Cesium Ion assets, prefer the [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/), which handles endpoint resolution and access tokens for you.

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the terrain casts shadows.

**Default:** `false`

**Example:**

```typescript
{
  quantizedMesh: {
    castShadow: true
  }
}
```

### geographic

**Type:** `boolean | undefined`

**Description:** Whether the source endpoint uses a geographic (EPSG:4326) tiling scheme. Cesium Ion's quantized-mesh layers use a geographic scheme; most self-hosted layers do as well.

**Default:** `true`

**Example:**

```typescript
{
  quantizedMesh: {
    geographic: true
  }
}
```

### maxZoom

**Type:** `number | undefined`

**Description:** Specifies the maximum zoom level fetched from the endpoint. Tiles will not be requested at zoom levels exceeding this value.

**Example:**

```typescript
{
  quantizedMesh: {
    maxZoom: 18
  }
}
```

### minZoom

**Type:** `number | undefined`

**Description:** Specifies the minimum zoom level fetched from the endpoint.

**Example:**

```typescript
{
  quantizedMesh: {
    minZoom: 0
  }
}
```

### overscaledMaxZoom

**Type:** `number | undefined`

**Description:** Terrain will be upsampled from the deepest available tile until `overscaledMaxZoom` is reached.

**Default:** `24`

**Example:**

```typescript
{
  quantizedMesh: {
    overscaledMaxZoom: 20
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the terrain receives shadows.

**Default:** `false`

**Example:**

```typescript
{
  quantizedMesh: {
    receiveShadow: true
  }
}
```

### requestVertexNormals

**Type:** `boolean | undefined`

**Description:** Request per-vertex normals from the endpoint by appending the `octvertexnormals` extension to the tile request. Required to shade the terrain from quantized-mesh data; without it the engine cannot apply lighting to the surface.

**Default:** `false`

**Example:**

```typescript
{
  quantizedMesh: {
    requestVertexNormals: true
  }
}
```

### requestWaterMask

**Type:** `boolean | undefined`

**Description:** Request the water mask from the endpoint by appending the `watermask` extension to the tile request.

**Default:** `false`

**Example:**

```typescript
{
  quantizedMesh: {
    requestWaterMask: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the terrain.

**Default:** `true`

**Example:**

```typescript
{
  quantizedMesh: {
    show: true
  }
}
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** Specifies whether to show per-tile bounding boxes. Used for debugging.

**Default:** `false`

**Example:**

```typescript
{
  quantizedMesh: {
    showBoundingBox: true
  }
}
```

### skirt

**Type:** `boolean | undefined`

**Description:** Specifies whether to render skirts along tile boundaries to hide gaps between neighboring tiles at different LODs.

**Default:** `true`

**Example:**

```typescript
{
  quantizedMesh: {
    skirt: true
  }
}
```

### skirtExaggeration

**Type:** `number | undefined`

**Description:** Multiplier applied to the auto-calculated skirt height. `1.0` uses the default calculated height.

**Default:** `1.0`

**Example:**

```typescript
{
  quantizedMesh: {
    skirtExaggeration: 1.5
  }
}
```

### tms

**Type:** `boolean | undefined`

**Description:** Whether the source endpoint uses TMS tile coordinates (y axis flipped). Cesium Ion's quantized-mesh layers are TMS.

**Default:** `true`

**Example:**

```typescript
{
  quantizedMesh: {
    tms: true
  }
}
```

### token

**Type:** `string | undefined`

**Description:** Access token appended to tile requests. When using [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/), the plugin supplies this from the resolved Cesium Ion endpoint and you should not set it manually.

**Example:**

```typescript
{
  quantizedMesh: {
    token: "<endpoint access token>"
  }
}
```

## Related Resources

- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - Terrain layer overview and usage
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - Material for raster PNG/WebP DEM terrain
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - High-level plugin for Cesium Ion quantized-mesh assets
