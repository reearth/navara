---
title: RasterTerrainMaterial
description: Raster terrain material for navara_three
sidebar:
  order: 36
---

`RasterTerrainMaterial`は、ラスター地形レンダリング用のマテリアルを表します。

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** ラスター地形が影を投影するかどうかを指定します。

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

**Type:** [`ElevationDecoder`](#ElevationDecoder-type)

**Description:** エンコードされた標高データを実際の地形の高さに変換するための設定やメソッドを指定します。

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

**Description:** 最大ズームレベルを指定します。この値を超えるズームレベルでは地形タイルが表示されません。

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

**Description:** 最小ズームレベルを指定します。この値未満のズームレベルでは地形タイルが表示されません。

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

**Description:** 地形は `overscaledMaxZoom` に達するまでアップサンプリングされます。

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

**Description:** ラスター地形が影を受けるかどうかを指定します。

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

**Description:** ポリゴン分割のセグメント数を指定します。セグメント数が多いほど、より詳細で滑らかな地形が得られます。

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

**Description:** ラスター地形を表示するかどうかを指定します。

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

**Description:** バウンディングボックスを表示するかどうかを指定します。デバッグ目的で使用します。

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

**Description:** タイル境界に沿ってスカートをレンダリングして隙間を隠すかどうかを指定します。地下モデルを可視化したい場合は無効にしてください。

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

**Description:** 自動計算されたスカート高さの乗数を指定します。1.0 はデフォルトの計算高さを使用します。

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

**Description:** タイルのサイズをピクセル単位で指定します。

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

**Description:** ワイヤーフレーム表示にするかどうかを指定します。

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

標高データのデコードに使用されます。

### Pre-defined Constants

`@navara/three` では、一般的な標高タイルプロバイダー用の事前定義されたデコーダー定数が提供されています。

| 定数名 | 用途 |
|--------|------|
| `JAPAN_GSI_ELEVATION_DECODER()` | 日本の国土地理院（GSI）の標高タイル用 |
| `MAPBOX_ELEVATION_DECODER()` | Mapbox Terrain-RGB タイル用 |
| `TERRARIUM_ELEVATION_DECODER()` | Terrarium 形式の標高タイル用 |

**Example:**

```typescript
import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
  TERRARIUM_ELEVATION_DECODER,
} from "@navara/three";

// 日本の国土地理院タイルを使用する場合
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

// Mapbox Terrain-RGB タイルを使用する場合
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

// Terrarium 形式のタイルを使用する場合
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
これらの定数は関数として提供されており、使用時に `()` を付けて呼び出す必要があります。これは WASM モジュールの初期化を待つための設計です。
:::

### Properties

#### bScaler

**Type:** `number`

**Description:** 青チャンネルのスケーラー値。

#### boundary

**Type:** `number`

**Description:** 境界値。

#### epsilon

**Type:** `number`

**Description:** イプシロン値（微小値）。

#### gScaler

**Type:** `number`

**Description:** 緑チャンネルのスケーラー値。

#### maxOffset

**Type:** `number`

**Description:** 最大オフセット値。

#### minOffset

**Type:** `number`

**Description:** 最小オフセット値。

#### offset

**Type:** `number`

**Description:** オフセット値。

#### rScaler

**Type:** `number`

**Description:** 赤チャンネルのスケーラー値。
