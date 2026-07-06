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

## Source の更新と削除

`addSource` が返す `Source` ハンドルは、Source をライフタイムにわたって管理するための 2 つのメソッドを公開します。

### update()

Source の設定を変更し、データを再取得します。この Source を参照している全レイヤーは**リセット**され（読み込み済みのリソースが破棄され）、新しい設定で**再読み込み**されます。そのため、URL・ズーム範囲・タイリングスキーム・インラインデータの変更は、今後のタイルリクエストだけでなく、すでに表示されているレイヤーにも反映されます。ただし地形（terrain）レイヤーは例外で、破棄・再追加ではなく、その場で（新しい設定を反映するよう再トラバースして）更新されます。

更新は [`Layer.update()`](../../../three/layer/about/) がマテリアルをマージするのと同様に**部分更新**です。省略したフィールドはデフォルトにリセットされず、現在の値を保持します。`type`（変更不可）は常に必須で、`url` も型上は必須です（変更しない場合は、現在と同じ値を渡せば取得 URL はそのまま維持されます）。

```typescript
const imagery = view.addSource({
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
  maxZoom: 19,
  tms: true,
});
view.addLayer({ type: "raster", source: imagery });

// 画像を差し替える — raster レイヤーが新しい URL で再読み込みされます。
imagery.update({
  type: "raster-tile",
  url: "https://example.com/new/{z}/{x}/{y}.png",
  maxZoom: 19,
});

// 部分更新: maxZoom だけ変更され、url と tms は保持されます。
imagery.update({
  type: "raster-tile",
  url: "https://example.com/new/{z}/{x}/{y}.png",
  maxZoom: 22,
});
```

レイヤー固有の設定（マテリアル、および vector レイヤーの `sourceLayers`）はリセットをまたいで保持されます。変更されるのは Source の取得／デコード設定だけです。

### delete()

Source とそのリソースを削除します。エンジンは Source を参照カウントしており、**いずれかのレイヤーがまだ Source を参照している間は削除を拒否します**。

**戻り値:** 少なくとも 1 つのレイヤーが Source を参照している間は `false`（何も削除しません）。Source が削除された後は `true`。

```typescript
const layer = view.addLayer({ type: "raster", source: imagery });

imagery.delete(); // → false: `layer` がまだ参照しています

layer.delete(); // 先に参照しているレイヤーを削除します
imagery.delete(); // → true: Source が削除されました
```

:::note
Source より先に、それを参照しているレイヤーを削除してください。既存レイヤーを削除せずにデータだけ差し替えたい場合は [`update()`](#update) を使用してください。
:::

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

- [ThreeView functions](../../../three/api/threeview-functions/) — `addSource`（返されたハンドルの `update()` / `delete()` については [Source の更新と削除](#source-の更新と削除) を参照）
- [About Layer](../../../three/layer/about/) — レイヤーのタイプ
- [Materials](../../../three/material/about/) — マテリアル（スタイリング）のリファレンス
