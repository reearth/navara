---
title: ElevationHeatmapMaterial
description: Elevation heatmap material for navara_three
sidebar:
  order: 40
---

`ElevationHeatmapMaterial`は、標高データを色分け（ヒートマップ）として可視化するためのマテリアルです。DEM（Digital Elevation Model）タイルデータを読み込み、標高値に応じたカラーマップを適用して表示します。

## 用途

- 地形の標高分布を視覚的に表現
- 山岳地形や地形解析の可視化
- 標高データの直感的な理解

## Properties

### maxHeight

**Type:** `number | undefined`

**Description:** カラーマップの最大標高値（メートル）を指定します。この値を超える標高はカラーマップの最大色で表示されます。

**Default:** `1000`

**Example:**

```typescript
{
  elevationHeatmap: {
    maxHeight: 3000
  }
}
```

### minHeight

**Type:** `number | undefined`

**Description:** カラーマップの最小標高値（メートル）を指定します。この値以下の標高はカラーマップの最小色で表示されます。

**Default:** `0`

**Example:**

```typescript
{
  elevationHeatmap: {
    minHeight: 0
  }
}
```

### elevationDecoder

**Type:** [`ElevationDecoder`](../../../three/resource-layer-reference/raster-terrain-material/#elevationdecoder-type) | `undefined`

**Description:** エンコードされた標高データを実際の標高値に変換するためのデコーダー設定を指定します。使用する DEM タイルのフォーマットに応じて適切なデコーダーを選択します。

**Example:**

```typescript
import { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

{
  elevationHeatmap: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER()
  }
}
```

### logarithmic

**Type:** `boolean`

**Description:** 対数スケールを使用して標高を可視化するかどうかを指定します。低地と高地の差が大きい場合に、低地の細かな標高差を見やすくするために有効です。

**Default:** `false`

**Example:**

```typescript
{
  elevationHeatmap: {
    logarithmic: true
  }
}
```

### logBoundary

**Type:** `number`

**Description:** 対数スケール使用時の境界値を指定します。この値は対数計算の基底として使用されます。

**Default:** `10`

**Example:**

```typescript
{
  elevationHeatmap: {
    logBoundary: 1000
  }
}
```

## 使用例

### 基本的な使い方

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// 標高ヒートマップレイヤーを追加
view.addLayer({
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
  },
});
```

### 対数スケールを使用した可視化

低地の細かな標高差を強調したい場合は、対数スケールを使用します。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// 対数スケールで標高ヒートマップを表示
view.addLayer({
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

### 3D 地形と組み合わせた使用

標高ヒートマップは、3D 地形レイヤーと組み合わせて使用することで、より直感的な地形の可視化が可能です。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const TERRAIN_URL =
  "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png";

// 3D地形レイヤーを追加
view.addLayer({
  type: "terrain",
  data: {
    url: TERRAIN_URL,
  },
  rasterTerrain: {
    maxZoom: 12,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  },
});

// 標高ヒートマップレイヤーを追加（地形の上に表示）
view.addLayer({
  type: "tiles",
  data: {
    url: TERRAIN_URL,
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  },
});
```

### カラーマップのカスタマイズ

標高ヒートマップの色は `globe.elevationColormap` プロパティで変更できます。

```typescript
import ThreeView, { ColorMap, Color } from "@navara/three";

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

## 関連項目

- [ColorMap クラス](../../../three/api-reference/colormap/) - カラーマップの詳細な API リファレンス
- [Globe クラス](../../../three/api-reference/globe/) - `elevationColormap` プロパティの詳細
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - 3D 地形レンダリング用マテリアル
- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - タイルレイヤーの設定

:::note
標高ヒートマップは Tile Layer の `elevationHeatmap` プロパティで設定します。`rasterTile` と併用して使用してください。
:::
