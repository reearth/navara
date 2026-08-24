---
title: ElevationHeatmapMaterial
description: navara_three の標高ヒートマップマテリアル
sidebar:
  order: 590
---

`ElevationHeatmapMaterial` は、[`raster`](../../../three/layer/raster-layer/) レイヤー上で標高を色分けされたヒートマップとして可視化するための描画オプションを保持します。DEM タイルをデコードし、標高値に基づいてカラーマップを適用します。`elevationHeatmap` キーで設定します。

DEM タイルをデコードするため、[`raster-dem`](../../../three/source/raster-dem-source/) の Source が必要です。標高デコーダは、このマテリアルではなく Source から取得されます。

## ユースケース

- 地形の標高分布を視覚的に表現する
- 地形解析や山岳地帯の可視化
- 標高データの直感的な理解

## プロパティ

### maxHeight

**型:** `number | undefined`

**デフォルト:** `1000`

**説明:** カラーマップの最大標高（メートル）。これを超える標高はカラーマップの最大色で表示されます。

```typescript
{ elevationHeatmap: { maxHeight: 3000 } }
```

### minHeight

**型:** `number | undefined`

**デフォルト:** `0`

**説明:** カラーマップの最小標高（メートル）。これ以下の標高はカラーマップの最小色で表示されます。

```typescript
{ elevationHeatmap: { minHeight: 0 } }
```

### logarithmic

**型:** `boolean | undefined`

**デフォルト:** `false`

**説明:** 対数スケールを使用するかどうか。低地と高地の範囲が大きい場合に、低地の微妙な標高差をより見やすくします。

```typescript
{ elevationHeatmap: { logarithmic: true } }
```

### logBoundary

**型:** `number | undefined`

**デフォルト:** `0`

**説明:** `logarithmic` が有効なときに、対数計算の基準として使用される境界値。

```typescript
{ elevationHeatmap: { logBoundary: 1000 } }
```

## 使用例

### 基本的な使い方

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navaramap/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/terrarium/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  maxZoom: 15,
});

view.addLayer({
  type: "raster",
  source: dem,
  elevationHeatmap: { maxHeight: 3000, minHeight: 0 },
});
```

### 対数スケール

```typescript
view.addLayer({
  type: "raster",
  source: dem,
  elevationHeatmap: { maxHeight: 3000, minHeight: 0, logarithmic: true, logBoundary: 1000 },
});
```

### カラーマップのカスタマイズ

ヒートマップの色は `globe.elevationColormap` プロパティで制御します。

```typescript
import ThreeView, { ColorMap, Color } from "@navaramap/three";

const view = new ThreeView();
await view.init();

// ref: https://colorbrewer2.org/#type=diverging&scheme=RdYlBu&n=11
const rdYlBuColorMap = new ColorMap("diverging", "RdYlBu", [
  new Color().setStyle("#313695"),
  new Color().setStyle("#4575b4"),
  new Color().setStyle("#74add1"),
  new Color().setStyle("#abd9e9"),
  new Color().setStyle("#e0f3f8"),
  new Color().setStyle("#ffffbf"),
  new Color().setStyle("#fee090"),
  new Color().setStyle("#fdae61"),
  new Color().setStyle("#f46d43"),
  new Color().setStyle("#d73027"),
  new Color().setStyle("#a50026"),
]);

view.globe.elevationColormap = rdYlBuColorMap;
```

## 関連リソース

- [Raster Layer](../../../three/layer/raster-layer/): このマテリアルの使い方
- [Raster DEM Source](../../../three/source/raster-dem-source/): DEM の Source とその標高デコーダ
- [ColorMap class](../../../three/api/colormap/) / [Globe class](../../../three/api/globe/): `elevationColormap`
- [HillshadeMaterial](../../../three/material/hillshade-material/): DEM タイルから生成する陰影起伏
