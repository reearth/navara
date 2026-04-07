---
title: Terrain Layer
description: 地形レイヤーの使い方
sidebar:
  order: 25
---

Terrain レイヤーは、標高データを使用して 3D 地形を表示するためのレイヤーです。PNG 形式の標高タイル（DEM）を読み込み、立体的な地形表現を実現します。

## 基本設定

| プロパティ | 型                | 説明                                                     |
| ---------- | ----------------- | -------------------------------------------------------- |
| `type`     | `"terrain"`       | レイヤータイプ（必須）                                   |
| `data`     | `{ url: string }` | 標高タイルの URL（`{z}/{x}/{y}` プレースホルダーを含む） |

## 対応マテリアル

| マテリアル                                                                        | 設定キー        | 説明                             |
| --------------------------------------------------------------------------------- | --------------- | -------------------------------- |
| [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) | `rasterTerrain` | 地形の外観と標高デコーダーを設定 |

## 使用例

### 国土地理院 DEMタイル

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Mapbox Terrain-RGB

```typescript
import ThreeView, { MAPBOX_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - © Mapbox Terrain-RGB
    //   https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
    url: "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=YOUR_ACCESS_TOKEN",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: MAPBOX_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Terrarium 形式

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

:::note
事前定義されたデコーダー定数の詳細は [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/#pre-defined-constants) を参照してください。
:::

## 関連リソース

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - ラスタータイルを表示
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - 地形マテリアルの詳細設定
