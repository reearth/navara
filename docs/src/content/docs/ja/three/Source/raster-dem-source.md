---
title: Raster DEM Source
description: RGB エンコードされた標高（raster-dem）の Source
sidebar:
  order: 14
---

`raster-dem` Source は、RGB エンコードされた標高タイルを記述します。次の両方を駆動します。

- **地形メッシュ化** — [`terrain`](../../../three/layer/terrain-layer/) レイヤーを介して、
- **陰影起伏 / 標高ヒートマップ** — [`raster`](../../../three/layer/raster-layer/) レイヤーを介して（レイヤーが `hillshade` / `elevationHeatmap` の描画オプションを供給します）。

RGB→高さのデコードは `elevationDecoder` で設定します。

## プロパティ

| プロパティ            | 型                                                                                        | デフォルト    | 説明                                              |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"raster-dem"`                                                                              | （必須） | Source のタイプ。                                       |
| `url`               | `string`                                                                                    | （必須） | タイル URL テンプレート（`{z}/{x}/{y}` を含む）。      |
| `tms`               | `boolean`                                                                                   | `false`    | タイルスキームが Y 軸方向に反転しているか（TMS）。     |
| `elevationDecoder`  | [`ElevationDecoder`](#elevation-decoder)                                                    | default decoder | RGB チャンネルをどのように高さの値へデコードするか。 |
| `tileSize`          | `number`                                                                                    | `256`      | DEM タイルのピクセルサイズ。                           |
| `minZoom`           | `number`                                                                                    | `0`        | タイルが提供される最小ズームレベル。                   |
| `maxZoom`           | `number`                                                                                    | `20`       | 新しいタイルを要求する最大ズームレベル。               |
| `overscaledMaxZoom` | `number`                                                                                    | `24`       | オーバースケールタイルを使用する最大ズーム。           |

## 使用例

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const dem = view.addSource({
  type: "raster-dem",
  url: "https://example.com/dem/{z}/{x}/{y}.png",
  elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  tileSize: 512,
  maxZoom: 17,
});

// 3D 地形として
view.addLayer({ type: "terrain", source: dem });

// 陰影起伏ラスターレイヤーとして（同じ Source を再利用）
view.addLayer({ type: "raster", source: dem, hillshade: { exaggeration: 1.5 } });
```

## Elevation Decoder

`elevationDecoder` は、タイルの RGB(A) チャンネルをどのように高さの値へデコードするかを記述します。

### 定義済みの定数

`@navara/three` は、一般的な標高タイルプロバイダー向けのデコーダ定数を提供しています。

| 定数                             | ユースケース                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `JAPAN_GSI_ELEVATION_DECODER()` | 国土地理院（GSI）の標高タイル                                       |
| `MAPBOX_ELEVATION_DECODER()`    | Mapbox Terrain-RGB タイル                                          |
| `TERRARIUM_ELEVATION_DECODER()` | Terrarium 形式の標高タイル                                          |

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

view.addSource({
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
});
```

:::note
これらの定数は関数であり、`()` を付けて呼び出す必要があります。呼び出しは WASM モジュールの初期化まで遅延されます。
:::

### カスタムデコーダ

明示的なデコーダオブジェクトを渡すこともできます。

| プロパティ    | 型       | 説明                    |
| ----------- | -------- | ----------------------- |
| `rScaler`   | `number` | 赤チャンネルのスケーラー。 |
| `gScaler`   | `number` | 緑チャンネルのスケーラー。 |
| `bScaler`   | `number` | 青チャンネルのスケーラー。 |
| `offset`    | `number` | 高さのオフセット。        |
| `maxOffset` | `number` | オフセットの最大値。      |
| `minOffset` | `number` | オフセットの最小値。      |
| `boundary`  | `number` | 境界値。                 |
| `epsilon`   | `number` | イプシロン（微小値）。    |

```typescript
{
  elevationDecoder: {
    rScaler: 256.0,
    gScaler: 1.0,
    bScaler: 1.0 / 256.0,
    offset: -32768.0,
    maxOffset: 8848.0,
    minOffset: -11034.0,
    boundary: 0.01,
    epsilon: 0.001,
  },
}
```

## 関連リソース

- [About Source](../../../three/source/about/)
- [Terrain Layer](../../../three/layer/terrain-layer/) / [Raster Layer](../../../three/layer/raster-layer/)
- [TerrainMaterial](../../../three/material/terrain-material/) — 地形の描画オプション
- [HillshadeMaterial](../../../three/material/hillshade-material/) / [ElevationHeatmapMaterial](../../../three/material/elevation-heatmap-material/)
