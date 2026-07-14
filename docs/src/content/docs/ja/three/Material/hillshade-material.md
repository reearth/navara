---
title: HillshadeMaterial
description: navara_three の Hillshade マテリアル
sidebar:
  order: 600
---

`HillshadeMaterial` は、[`raster`](../../../three/layer/raster-layer/) レイヤー上の陰影起伏（hillshade）の描画オプションを保持します。DEM の標高値から地表の法線を計算し、光源の方向に基づいてタイルに陰影を付け、尾根や谷といった地形の特徴を強調します。`hillshade` キーで設定します。

DEM タイルをデコードするため、[`raster-dem`](../../../three/source/raster-dem-source/) の Source が必要です。標高デコーダは、このマテリアルではなく Source から取得されます。

## ユースケース

- 平坦な（2D の）ベースマップ上で地形の起伏を強調する
- [3D 地形レイヤー](../../../three/layer/terrain-layer/)の上で、DEM タイルから正確な地形法線を計算する（ジオメトリの頂点法線は粗いため、hillshade は標高タイルから直接ピクセル単位の法線を導出します）
- ラスターのベースマップだけでは知覚しにくい微妙な地形の特徴に注意を引く

## プロパティ

### exaggeration

**型:** `number | undefined` — **デフォルト:** `1.0`

**説明:** 陰影起伏を計算する際に標高差に適用する強調係数。値が大きいほど陰影が強くなり、小さいほど陰影が控えめになります。

```typescript
{ hillshade: { exaggeration: 0.5 } }
```

## 使用例

`raster-dem` の Source を参照して、平坦なベースマップの上に陰影起伏を追加します。デコーダは Source 側にあります。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// ベース画像
const imagery = view.addSource({ type: "raster-tile", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19 });
view.addLayer({ type: "raster", source: imagery });

// raster-dem の Source から生成する陰影起伏
const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/terrarium/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  maxZoom: 17,
  minZoom: 5,
});
view.addLayer({ type: "raster", source: dem, hillshade: { exaggeration: 0.5 } });
```

同じ `raster-dem` の Source を [`terrain`](../../../three/layer/terrain-layer/) レイヤー（ジオメトリ）と `raster` の hillshade レイヤー（陰影）の両方で再利用すると、実際の 3D の地表の上に陰影起伏を得られます。

## 関連リソース

- [Raster Layer](../../../three/layer/raster-layer/) — このマテリアルの使い方
- [Raster DEM Source](../../../three/source/raster-dem-source/) — DEM の Source とその標高デコーダ
- [Terrain Layer](../../../three/layer/terrain-layer/) — 3D 地形の描画
- [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/) — 標高データをヒートマップとして可視化する
