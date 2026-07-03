---
title: About
description: レイヤーとは何か、そしてどのように Source を描画するか
sidebar:
  order: 10
---

**レイヤー** は、地図データを *どのように* 描画するかを決定します。データそのものは [Source](../../../three/source/about/) から供給され、レイヤーは `source` でそれを参照します。「データがどこにあるか」（Source）と「どう見えるか」（レイヤー）を分離することで、1 つの Source を複数のレイヤーに供給したり、再取得せずにスタイルを変更したり、地図全体を JSON から宣言的に記述したりできます。

:::note
レイヤーは [`addLayer`](../../../three/api/threeview-functions/) で追加し、`source` を取ります。これには `addSource` が返す `Source` ハンドル、またはその `id` 文字列のいずれかを指定します。マテリアルのリファレンスについては [Materials](../../../three/material/about/) を参照してください。
:::

## レイヤーの作成

```typescript
import ThreeView from "@navara/three";

const imagery = view.addSource({
  type: "raster-tile",
  url: "https://example.com/{z}/{x}/{y}.png",
  maxZoom: 19,
});

// Source をハンドルで参照…
view.addLayer({ type: "raster", source: imagery });

// …または id で参照
view.addLayer({ type: "raster", source: "basemap" });
```

`addLayer` は `update()`、`delete()`、`forceUpdate()`、およびフィーチャーイベントを持つ `Layer` ハンドルを返します。

## レイヤーのタイプ

各レイヤータイプは、特定の Source タイプのセットと、固有のネストされた描画オプション（マテリアル）を受け付けます。

| レイヤータイプ                                                  | 対応 Source                     | 描画オプション                                              |
| ------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| [`vector`](../../../three/layer/vector-layer/)                | `geojson`, `vector-tile`       | `point` / `billboard` / `text` / `polyline` / `polygon`    |
| [`raster`](../../../three/layer/raster-layer/)                | `raster-tile`, `raster-dem`    | `raster` / `hillshade` / `elevationHeatmap`                |
| [`terrain`](../../../three/layer/terrain-layer/)              | `raster-dem`, `quantized-mesh` | `terrain`                                                  |
| [`3d-tiles`](../../../three/layer/3d-tiles-layer/)            | `3d-tiles`                     | `model`                                                    |

```typescript
view.addLayer({ type: "raster", source: imagery, raster: { opacity: 0.8 } });
view.addLayer({ type: "terrain", source: dem, terrain: { skirt: true } });
```

## 更新と削除

返された `Layer` ハンドルは、`update()` で設定を上書きし、`delete()` でレイヤーを削除します。レイヤーの `source` は `update()` では変更できません。別の Source を指すようにするには、レイヤーを作り直してください。

```typescript
const layer = view.addLayer({ type: "raster", source: imagery });
layer.update({ type: "raster", source: imagery, raster: { opacity: 0.5 } });
layer.delete();
```

## 関連リソース

- [About Source](../../../three/source/about/) — データ側
- [ThreeView functions](../../../three/api/threeview-functions/) — `addLayer` / `addSource`
- [Materials](../../../three/material/about/) — マテリアル（スタイリング）のリファレンス
