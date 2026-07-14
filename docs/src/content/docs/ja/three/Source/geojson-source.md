---
title: GeoJSON Source
description: geojson の Source（URL またはインライン）
sidebar:
  order: 310
---

`geojson` Source は、URL から取得するか、インラインで指定した GeoJSON からベクターデータを提供します。[`vector`](../../../three/layer/vector-layer/) レイヤーで描画します。

## プロパティ

| プロパティ | 型                                          | デフォルト    | 説明                                                                 |
| -------- | --------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `type`   | `"geojson"`                                   | （必須） | Source のタイプ。                                                          |
| `url`    | `string`                                      | —          | GeoJSON を取得する URL。`data` とは排他的で、両方指定した場合はこちらが優先されます。 |
| `data`   | `FeatureCollection \| Feature \| Geometry`    | —          | インラインの GeoJSON データ。`url` が指定されていない場合に使用されます。 |
| `crs`    | `string`                                      | —          | データの座標参照系。                                                       |
| `tiled`  | `boolean`                                     | `false`    | 大規模データセット向けにタイル化された空間インデックス（GeoJSON-VT）を構築します。 |

## 使用例

```typescript
import ThreeView from "@navara/three";

// URL から
const roads = view.addSource({
  type: "geojson",
  url: "https://example.com/roads.geojson",
});
view.addLayer({ type: "vector", source: roads, polyline: { color: 0xffffff } });

// インライン
const pins = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [139.767, 35.681] }, properties: {} },
    ],
  },
});
view.addLayer({ type: "vector", source: pins, point: { color: 0xff0000, size: 8 } });
```

## 関連リソース

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
