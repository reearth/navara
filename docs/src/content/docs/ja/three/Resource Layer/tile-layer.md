---
title: Tile Layer
description: ラスタータイルレイヤーの使い方
sidebar:
  order: 26
---

Tile レイヤーは、XYZ 形式のラスタータイル（航空写真、衛星画像、地図タイルなど）を表示するためのレイヤーです。

## 基本設定

| プロパティ | 型                | 説明                                                 |
| ---------- | ----------------- | ---------------------------------------------------- |
| `type`     | `"tiles"`         | レイヤータイプ（必須）                               |
| `data`     | `{ url: string }` | タイルの URL（`{z}/{x}/{y}` プレースホルダーを含む） |

## 対応マテリアル

| マテリアル                                                                                      | 設定キー           | 説明                               |
| ----------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------- |
| [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/)             | `rasterTile`       | タイルの外観を設定                 |
| [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) | `elevationHeatmap` | 標高データをヒートマップとして表示 |

## 使用例

### OpenStreetMap タイル

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const osmLayer = view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    color: new Color().setHex(0xffffff),
    maxZoom: 23,
    wireframe: false,
    opacity: 1,
  },
});
```

### 標高ヒートマップ

標高データを色分け表示することで、地形の高低差を視覚化できます。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const heatmapLayer = view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    logarithmic: true,
    logBoundary: 1000,
  },
});
```

## 関連リソース

- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - 3D 地形を表示
- [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/) - タイルマテリアルの詳細設定
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - ヒートマップマテリアルの詳細設定
