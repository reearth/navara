---
title: RasterTerrainMaterial
description: Raster terrain material for navara_three
sidebar:
  order: 36
---

`RasterTerrainMaterial` represents a material for raster terrain rendering.

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the raster terrain casts shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    castShadow: true
  }
}
```

### elevationDecoder

**Type:** [`ElevationDecoder`](#elevationdecoder-type)

**Description:** Specifies the settings and methods for converting encoded elevation data to actual terrain heights.

**Example:**

```typescript
{
  rasterTerrain: {
    elevationDecoder: {
      rScaler: 256.0,
      gScaler: 1.0,
      bScaler: 1.0 / 256.0,
      offset: -32768.0,
      maxOffset: 8848.0,
      minOffset: -11034.0,
      boundary: 0.01,
      epsilon: 0.001
    }
  }
}
```

### maxZoom

**Type:** `number`

**Description:** Specifies the maximum zoom level. Terrain tiles will not be displayed at zoom levels exceeding this value.

**Example:**

```typescript
{
  rasterTerrain: {
    maxZoom: 16
  }
}
```

### minZoom

**Type:** `number`

**Description:** Specifies the minimum zoom level. Terrain tiles will not be displayed at zoom levels below this value.

**Example:**

```typescript
{
  rasterTerrain: {
    minZoom: 0
  }
}
```

### overscaledMaxZoom

**Type:** `number | undefined`

**Description:** Terrain will be upsampled until `overscaledMaxZoom` is reached.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    overscaledMaxZoom: 20
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the raster terrain receives shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    receiveShadow: true
  }
}
```

### segments

**Type:** `number`

**Description:** Specifies the number of polygon subdivision segments. Higher segment counts produce more detailed and smoother terrain.

**Example:**

```typescript
{
  rasterTerrain: {
    segments: 64
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the raster terrain.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    show: true
  }
}
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the bounding box. Used for debugging purposes.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    showBoundingBox: true
  }
}
```

### skirt

**Type:** `boolean | undefined`

**Description:** Specifies whether to render skirts along tile boundaries to hide gaps. Disable this if you want to visualize underground models.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    skirt: true
  }
}
```

### skirtExaggeration

**Type:** `number | undefined`

**Description:** Specifies the multiplier for the auto-calculated skirt height. 1.0 uses the default calculated height.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    skirtExaggeration: 1.5
  }
}
```

### tileSize

**Type:** `number | undefined`

**Description:** Specifies the tile size in pixels.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    tileSize: 256
  }
}
```

### wireframe

**Type:** `boolean | undefined`

**Description:** Specifies whether to display as wireframe.

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTerrain: {
    wireframe: false
  }
}
```

## ElevationDecoder type

Used for decoding elevation data.

### Pre-defined Constants

`@navara/three` provides pre-defined decoder constants for common elevation tile providers.

| Constant name | Use case |
|--------|------|
| `JAPAN_GSI_ELEVATION_DECODER()` | For Japan's Geospatial Information Authority (GSI) elevation tiles |
| `MAPBOX_ELEVATION_DECODER()` | For Mapbox Terrain-RGB tiles |
| `TERRARIUM_ELEVATION_DECODER()` | For Terrarium format elevation tiles |

**Example:**

```typescript
import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
  TERRARIUM_ELEVATION_DECODER,
} from "@navara/three";

// Using Japan's GSI tiles
const gsiTerrain = {
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  },
};

// Using Mapbox Terrain-RGB tiles
const mapboxTerrain = {
  type: "terrain",
  data: {
    // Credit:
    // - © Mapbox Terrain-RGB
    //   https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
    url: "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=YOUR_ACCESS_TOKEN",
  },
  rasterTerrain: {
    elevationDecoder: MAPBOX_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  },
};

// Using Terrarium format tiles
const terrariumTerrain = {
  type: "terrain",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  },
};
```

:::note
These constants are provided as functions and must be called with `()` when used. This design is to wait for WASM module initialization.
:::

### Properties

#### bScaler

**Type:** `number`

**Description:** Blue channel scaler value.

#### boundary

**Type:** `number`

**Description:** Boundary value.

#### epsilon

**Type:** `number`

**Description:** Epsilon value (infinitesimal value).

#### gScaler

**Type:** `number`

**Description:** Green channel scaler value.

#### maxOffset

**Type:** `number`

**Description:** Maximum offset value.

#### minOffset

**Type:** `number`

**Description:** Minimum offset value.

#### offset

**Type:** `number`

**Description:** Offset value.

#### rScaler

**Type:** `number`

**Description:** Red channel scaler value.
