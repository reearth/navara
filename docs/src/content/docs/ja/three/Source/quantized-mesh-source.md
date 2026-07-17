---
title: Quantized Mesh Source
description: Cesium quantized-mesh 地形の Source
sidebar:
  order: 350
---

`quantized-mesh` Source は、Cesium quantized-mesh 地形を記述します。[`terrain`](../../../three/layer/terrain-layer/) レイヤーで描画します。デフォルトでは、Cesium の慣例に合わせて、地理座標系（EPSG:4326）かつ TMS（南原点）の Y 軸として扱われます。

## プロパティ

| プロパティ               | 型               | デフォルト    | 説明                                                              |
| ---------------------- | ------------------ | ---------- | ---------------------------------------------------------------------- |
| `type`                 | `"quantized-mesh"` | （必須） | Source のタイプ。                                                      |
| `url`                  | `string`           | （必須） | タイル URL テンプレート（`{z}/{x}/{y}` を含む）。                     |
| `geographic`           | `boolean`          | `true`     | 地理座標系（EPSG:4326）のタイリングスキームを使用します。それ以外は WebMercator。 |
| `tms`                  | `boolean`          | `true`     | タイルの Y 軸が南原点（TMS）かどうか。                                |
| `requestVertexNormals` | `boolean`          | `false`    | oct エンコードされた頂点ごとの法線拡張（`octvertexnormals` Accept ヘッダー）を要求します。 |
| `requestWaterMask`     | `boolean`          | `false`    | watermask 拡張（`watermask` Accept ヘッダー）を要求します。          |
| `token`                | `string`           | —          | タイル取得時に `Authorization` ヘッダーとして送信されるベアラートークン。 |
| `minZoom`              | `number`           | `0`        | タイルが提供される最小ズームレベル。                                  |
| `maxZoom`              | `number`           | `20`       | 新しいタイルを要求する最大ズームレベル。                             |
| `overscaledMaxZoom`    | `number`           | `24`       | オーバースケールタイルを使用する最大ズーム。                          |

## 使用例

```typescript
import ThreeView from "@navaramap/three";

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://example.com/terrain/{z}/{x}/{y}.terrain",
  requestVertexNormals: true,
});

view.addLayer({ type: "terrain", source: terrain });

// 地形メッシュは `terrain` でスタイリングします。
view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: { skirt: true, castShadow: true },
});
```

## 関連リソース

- [About Source](../../../three/source/about/)
- [TerrainMaterial](../../../three/material/terrain-material/) — 地形の描画オプション
