---
title: About
description: Source とは何か、そしてレイヤーがどのように Source を参照するか
sidebar:
  order: 10
---

**Source** は、地図データがどこから来て、どのように取得・デコードされるか（URL、ズーム範囲、タイリングスキーム、標高デコーダなど）を記述します。そして [layer](../../../three/layer/about/) が、そのデータを *どのように* 描画するかを決定します。1 つの Source を複数のレイヤーから参照でき、エンジンは基盤となる取得処理とタイリングリソースを重複排除します。

「データがどこにあるか」（Source）と「どう見えるか」（layer）を分離することで、次のことが可能になります。

- 複数のレイヤー間で 1 つの取得／タイルキャッシュを共有する、
- 再取得せずにスタイルを変更する、
- `id` で Source を参照することで、JSON から地図全体を宣言的に記述する。

:::note
レイヤーのタイプについては [About Layer](../../../three/layer/about/) を、マテリアルのリファレンスについては [Materials](../../../three/material/about/) を参照してください。
:::

## Source の作成

[`addSource`](../../../three/api/threeview-functions/) で Source を登録します。これは `Source` ハンドルを返します。

```typescript
import ThreeView from "@navara/three";

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
  maxZoom: 19,
});
```

Source は `id`（レイヤーから参照するために使用）と `type` を持ちます。

### id の指定

`id` は任意です。省略した場合はランダムな id が生成されます。独自の id を渡すこともでき、既存の id を持つ Source を追加すると、その Source を**上書き**します（後から定義したものが優先されます）。

```typescript
view.addSource({
  id: "basemap",
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
});
```

レイヤーは id 文字列で Source を参照できるため、これにより JSON から地図全体を宣言的に定義できます。

## レイヤーから Source を参照する

Source ベースのレイヤーは `source` プロパティを取ります。これには `addSource` が返す `Source` ハンドル、またはその `id` 文字列のいずれかを指定します。

```typescript
// ハンドルで指定
view.addLayer({ type: "raster", source: imagery });

// id で指定
view.addLayer({ type: "raster", source: "basemap" });
```

各レイヤータイプは、特定の Source タイプのセットを受け付けます。

| レイヤータイプ   | 対応 Source                          |
| ------------ | ---------------------------------------- |
| `"vector"`   | `geojson`, `vector-tile`                 |
| `"raster"`   | `raster-tile`, `raster-dem`              |
| `"terrain"`  | `raster-dem`, `quantized-mesh`           |
| `"3d-tiles"` | `3d-tiles`                               |

各レイヤータイプには固有の描画オプションがあります：`raster` レイヤーは `raster` / `hillshade` / `elevationHeatmap`、`terrain` レイヤーは `terrain`、`3d-tiles` レイヤーは `model`、`vector` レイヤーは `point` / `polyline` / `polygon` / `text` / `billboard`。

```typescript
view.addLayer({ type: "raster", source: imagery, raster: { opacity: 0.8 } });
view.addLayer({ type: "terrain", source: dem, terrain: { skirt: true } });
```

## Source のタイプ

| 型                                                                        | 説明                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| [`geojson`](../../../three/source/geojson-source/)                          | GeoJSON（URL またはインライン）                  |
| [`vector-tile`](../../../three/source/vector-tile-source/)                  | Mapbox Vector Tiles (MVT) タイルセット（`{z}/{x}/{y}` テンプレート、または `.pmtiles` アーカイブ） |
| [`raster-tile`](../../../three/source/raster-tile-source/)                  | ラスター画像タイル（XYZ / TMS）                  |
| [`raster-dem`](../../../three/source/raster-dem-source/)                    | RGB エンコードされた標高タイル（地形 / 陰影起伏）|
| [`quantized-mesh`](../../../three/source/quantized-mesh-source/)            | Cesium quantized-mesh 地形                        |
| [`3d-tiles`](../../../three/source/3d-tiles-source/)                        | 3D Tiles タイルセット                            |

## 関連リソース

- [ThreeView functions](../../../three/api/threeview-functions/) — `addSource`（更新／削除は返された `Source` ハンドルにあります）
- [About Layer](../../../three/layer/about/) — レイヤーのタイプ
- [Materials](../../../three/material/about/) — マテリアル（スタイリング）のリファレンス
