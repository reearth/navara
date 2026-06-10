---
title: HillshadeMaterial
description: Hillshade material for navara_three
sidebar:
  order: 41
---

`HillshadeMaterial` は、DEM（Digital Elevation Model）タイルデータから陰影起伏図（ヒルシェード）を描画するためのマテリアルです。標高値から地表面の法線を計算し、光源方向に基づいてタイルを陰影付けすることで、尾根や谷などの地形特徴を強調します。

## 用途

- 平面（2D）のベースマップ上で地形の起伏を強調する
- [3D 地形レイヤー](../../../three/resource-layer-reference/terrain-layer/)に重ねて、より豊かな地表表現を追加する
- ラスタータイルだけでは伝わりにくい微細な地形を可視化する

## Properties

### elevationDecoder

**Type:** [`ElevationDecoder`](../../../three/resource-layer-reference/raster-terrain-material/#elevationdecoder-type) | `undefined`

**Description:** エンコードされた標高データを実際の標高値に変換するためのデコーダー設定を指定します。使用する DEM タイルのフォーマットに応じて適切なデコーダーを選択します。

**Example:**

```typescript
import { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

{
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER()
  }
}
```

### exaggeration

**Type:** `number | undefined`

**Description:** ヒルシェードを計算する際の標高差に適用する強調倍率を指定します。値を大きくするほど陰影が強くなり地形が強調され、小さくするほど陰影が穏やかになります。

**Default:** `1.0`

**Example:**

```typescript
{
  hillshade: {
    exaggeration: 0.5
  }
}
```

## 使用例

### 基本的な使い方（平面ベースマップ + ヒルシェード）

3D 地形を使わずに平面のベースマップへヒルシェードを重ねることで、マップを 2D のまま地形の起伏を強調できます。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

// ベースとなるラスタータイルレイヤー
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// ヒルシェードレイヤー（DEM タイル）
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
});
```

### 3D 地形と組み合わせた使用

ヒルシェードは [3D Terrain レイヤー](../../../three/resource-layer-reference/terrain-layer/)と組み合わせて使用することで、3D 地表の上に陰影起伏を重ねて描画できます。Terrain レイヤーがジオメトリを提供し、Hillshade レイヤーが標高勾配に基づく陰影を追加します。

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const TERRAIN_URL =
  "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png";

// ベースとなるラスタータイルレイヤー
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// 3D 地形レイヤー（ジオメトリを提供）
view.addLayer({
  type: "terrain",
  data: {
    url: TERRAIN_URL,
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    tileSize: 512,
  },
});

// ヒルシェードレイヤー（地形の上に陰影起伏を追加）
view.addLayer({
  type: "tiles",
  data: {
    url: TERRAIN_URL,
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
});
```

### 強調倍率を動的に変更する

`exaggeration` は `view.updateLayerById` を使ってランタイムに更新でき、陰影の強さをインタラクティブに調整できます。

```typescript
import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";

const view = new ThreeView({ container: document.getElementById("map") });
await view.init();

const layerDef: LayerDescription = {
  type: "tiles",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 17,
    minZoom: 5,
  },
  hillshade: {
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    exaggeration: 0.5,
  },
};

const hillshadeLayer = view.addLayer(layerDef);

// 後から exaggeration を変更
if (layerDef.hillshade) {
  layerDef.hillshade.exaggeration = 2.0;
  view.updateLayerById(hillshadeLayer.id, layerDef);
}
```

## 関連項目

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - タイルレイヤーの設定
- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - 3D 地形の描画
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - 3D 地形レンダリング用マテリアル（標高デコーダーのリファレンスを含む）
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - 標高データをヒートマップとして可視化

:::note
ヒルシェードは Tile Layer の `hillshade` プロパティで設定します。通常は `rasterTile` と併用し、Terrain Layer と組み合わせることで 3D 地形の上に陰影起伏を重ねることもできます。
:::
