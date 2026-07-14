---
title: About
description: レイヤーのマテリアル（スタイリングオプション）
sidebar:
  order: 500
---

**マテリアル** は、[レイヤー](../../../three/layer/about/)の描画（スタイリング）オプションです。各マテリアルは、レイヤー設定上のそれぞれのキーで設定します（例：`vector` レイヤーの `polygon`、`terrain` レイヤーの `terrain`）。レイヤーがどのマテリアルを受け付けるかは、そのタイプによって異なります。

:::note
データ（URL、ズーム、デコーダなど）は [Source](../../../three/source/about/) で記述し、どのように描画されるかは[レイヤー](../../../three/layer/about/)とそのマテリアルで記述します。
:::

## レイヤータイプ別のマテリアル

| レイヤータイプ                                            | マテリアル（設定キー）                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`vector`](../../../three/layer/vector-layer/)            | `point`, `billboard`, `text`, `polyline`, `polygon`                            |
| [`raster`](../../../three/layer/raster-layer/)            | `raster`, `hillshade`, `elevationHeatmap`                                       |
| [`terrain`](../../../three/layer/terrain-layer/)          | `terrain`                                                                       |
| [`3d-tiles`](../../../three/layer/3d-tiles-layer/)        | `model`                                                                         |

## マテリアルのリファレンス

| マテリアル                                                                            | 設定キー           | 使用するレイヤー           |
| ------------------------------------------------------------------------------------- | ------------------ | -------------------------- |
| [PointMaterial](../../../three/material/point-material/)                        | `point`            | `vector`                   |
| [BillboardMaterial](../../../three/material/billboard-material/)                | `billboard`        | `vector`                   |
| [TextMaterial](../../../three/material/text-material/)                          | `text`             | `vector`                   |
| [PolylineMaterial](../../../three/material/polyline-material/)                  | `polyline`         | `vector`                   |
| [PolygonMaterial](../../../three/material/polygon-material/)                    | `polygon`          | `vector`                   |
| [RasterMaterial](../../../three/material/raster-material/)                      | `raster`           | `raster`                   |
| [HillshadeMaterial](../../../three/material/hillshade-material/)                | `hillshade`        | `raster`（raster-dem）      |
| [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/) | `elevationHeatmap` | `raster`（raster-dem）      |
| [TerrainMaterial](../../../three/material/terrain-material/)                    | `terrain`          | `terrain`                  |
| [ModelMaterial](../../../three/material/model-material/)                        | `model`            | `3d-tiles`                 |

## 使用例

```typescript
// vector レイヤーは複数のマテリアルを一度に取れます
view.addLayer({
  type: "vector",
  source: features,
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});
```

## 関連リソース

- [レイヤーの種類](../../../three/layer/about/) — レイヤーのタイプと追加方法
- [About Source](../../../three/source/about/) — データ側
