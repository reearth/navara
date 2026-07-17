---
title: Vector Layer
description: geojson または vector-tile の Source をジオメトリごとのマテリアルで描画する
sidebar:
  order: 410
---

`vector` レイヤーは、[`geojson`](../../../three/source/geojson-source/) または [`vector-tile`](../../../three/source/vector-tile-source/) の Source のフィーチャーを、ジオメトリごとのマテリアル（点、線、ポリゴンなど）で描画します。

## プロパティ

| プロパティ      | 型                      | 説明                                                                                                |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `type`         | `"vector"`              | レイヤータイプ（必須）。                                                                              |
| `source`       | `Source \| string`      | 描画する `geojson` / `vector-tile` の Source（必須）。                                               |
| `sourceLayers` | `string[]`              | `vector-tile` の Source の場合：タイルセット内のどのソースレイヤーを描画するか。GeoJSON では無視されます。 |

### 描画オプション（マテリアル）

存在するジオメトリタイプに応じて、1 つ以上を指定します。

| マテリアル                                                                   | 設定キー    | 対応ジオメトリ                |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------- |
| [PointMaterial](../../../three/material/point-material/)               | `point`     | Point, MultiPoint             |
| [BillboardMaterial](../../../three/material/billboard-material/)       | `billboard` | Point（アイコン表示）          |
| [TextMaterial](../../../three/material/text-material/)                 | `text`      | Point（ラベル表示）            |
| [PolylineMaterial](../../../three/material/polyline-material/)         | `polyline`  | LineString, MultiLineString   |
| [PolygonMaterial](../../../three/material/polygon-material/)           | `polygon`   | Polygon, MultiPolygon         |

## 使用例

### GeoJSON フィーチャー

```typescript
import ThreeView, { Color } from "@navaramap/three";

const view = new ThreeView(/* options */);
await view.init();

const points = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [139.7051, 35.6927] },
      },
    ],
  },
});

view.addLayer({
  type: "vector",
  source: points,
  point: {
    color: new Color().setHex(0xffffff),
    size: 0.1,
    sizeInMeters: true,
    clampToGround: true,
  },
});
```

### サブレイヤーフィルターを使ったベクタータイル

1 つの `vector-tile` Source を複数のレイヤーから参照し、`sourceLayers` でそれぞれが描画するソースレイヤーを選択します。Source を共有するため、タイルは一度だけ取得されます。

```typescript
const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/tiles/{z}/{x}/{y}.mvt",
  maxZoom: 16,
});

// 水域
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

// 建物
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555"), clampToGround: true },
});
```

## 関連リソース

- [GeoJSON Source](../../../three/source/geojson-source/) / [Vector Tile Source](../../../three/source/vector-tile-source/)
- [PointMaterial](../../../three/material/point-material/) / [PolygonMaterial](../../../three/material/polygon-material/) / [PolylineMaterial](../../../three/material/polyline-material/) — マテリアルの詳細設定
