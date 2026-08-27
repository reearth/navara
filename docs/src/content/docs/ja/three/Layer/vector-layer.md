---
title: Vector Layer
description: geojson または vector-tile の Source をジオメトリごとのマテリアルで描画する
sidebar:
  order: 410
---

`vector` レイヤーは、[`geojson`](../../../three/source/geojson-source/) または [`vector-tile`](../../../three/source/vector-tile-source/) の Source のフィーチャーを、ジオメトリごとのマテリアル（点、線、ポリゴンなど）で描画します。

## プロパティ

| プロパティ      | 型                      | 説明                                                                                                |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `type`         | `"vector"`              | レイヤータイプ（必須）。                                                                              |
| `source`       | `Source \| string`      | 描画する `geojson` / `vector-tile` の Source（必須）。                                               |
| `sourceLayers` | `string[]`              | `vector-tile` の Source の場合：タイルセット内のどのソースレイヤーを描画するか。GeoJSON では無視されます。 |

### 描画オプション（マテリアル）

存在するジオメトリタイプに応じて、1 つ以上を指定します。

| マテリアル                                                                   | 設定キー    | デフォルトの対応ジオメトリ      |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------- |
| [PointMaterial](../../../three/material/point-material/)               | `point`     | Point, MultiPoint             |
| [BillboardMaterial](../../../three/material/billboard-material/)       | `billboard` | Point（アイコン表示）          |
| [TextMaterial](../../../three/material/text-material/)                 | `text`      | Point（ラベル表示）            |
| [PolylineMaterial](../../../three/material/polyline-material/)         | `polyline`  | LineString, MultiLineString   |
| [PolygonMaterial](../../../three/material/polygon-material/)           | `polygon`   | Polygon, MultiPolygon         |

デフォルトでは、各マテリアルは上記のジオメトリのみを描画します。`geometryTypes` オプションでマテリアルごとに対応範囲を広げると、1 つのソースジオメトリを複数の表現で同時に描画できます。詳細は [geometryTypes による表現の派生](#geometrytypes-による表現の派生) を参照してください。

## 使用例

### GeoJSON フィーチャー

```typescript
import ThreeView, { Color } from "@navaramap/three";

const view = new ThreeView(/* options */);
await view.init();

const points = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [139.7051, 35.6927] },
      },
    ],
  },
});

view.addLayer({
  type: "vector",
  source: points,
  point: {
    color: new Color().setHex(0xffffff),
    size: 0.1,
    sizeInMeters: true,
    clampToGround: true,
  },
});
```

### サブレイヤーフィルターを使ったベクタータイル

1 つの `vector-tile` Source を複数のレイヤーから参照し、`sourceLayers` でそれぞれが描画するソースレイヤーを選択します。Source を共有するため、タイルは一度だけ取得されます。

```typescript
const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/tiles/{z}/{x}/{y}.mvt",
  maxZoom: 16,
});

// 水域
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

// 建物
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555"), clampToGround: true },
});
```

### geometryTypes による表現の派生

`point`、`billboard`、`text`、`polyline` の各マテリアルは、消費するソースジオメトリのカテゴリー（`"point"`、`"line"`、`"polygon"`）を列挙する `geometryTypes` 配列を受け付けます。省略時は各マテリアル本来のカテゴリーのみを消費します（点系マテリアルは `["point"]`、`polyline` は `["line"]`）。配列を指定するとデフォルトは置き換えられるため、本来のカテゴリーも描画し続けたい場合は配列に含めてください。

派生はダウンコンバートのみです。

- `polyline` に `"polygon"`：ポリゴンの境界リング（外周と穴）が、リングの基準高度で閉じたポリラインとして描画されます。押し出しの側面エッジは含まれないため、押し出しポリゴンにはポリゴンマテリアルの [`outline`](../../../three/material/polygon-material/#outline) を使用してください。
- `point` / `billboard` / `text` に `"line"`：ラインの頂点ごとに 1 つのポイントを描画します。
- `point` / `billboard` / `text` に `"polygon"`：ポリゴンリングの頂点ごとに 1 つのポイントを描画します（リングを閉じる重複頂点はスキップされます）。

```typescript
// LineString と Polygon が混在するデータの場合：
// ポリゴンは塗りと境界線の両方で描画され、
// ラインは同じマテリアルのポリラインとして描画されます。
view.addLayer({
  type: "vector",
  source,
  polygon: { color: new Color().setStyle("#2d6a4f"), clampToGround: true },
  polyline: {
    color: new Color().setStyle("#ffffff"),
    width: 2,
    clampToGround: true,
    geometryTypes: ["line", "polygon"],
  },
});
```

派生した表現は、そのマテリアルの機能をすべて備えたインスタンスです。たとえば境界ポリラインは、ラインジオメトリから作られたポリラインと同様に `width`、`clampToGround`、フィーチャーごとのスタイリングに対応し、元のフィーチャーのプロパティを保持します。

`geometryTypes` はジオメトリ構築時に適用されるため、レイヤー作成時に指定してください。`layer.update()` で値を変更しても、変更後に読み込まれたタイルにしか反映されません。表示中のタイルは構築時のジオメトリを保持するため、すべてに反映するにはレイヤーを作り直してください。

タイル分割された描画パス（ベクタータイルソース、または `tiled` / `clampToGround` を指定したマテリアル）では、派生はタイルごとにクリップされたリングを走査します。境界ポリラインはこれを自動で処理し、タイルクリップで挿入されたエッジは描画されないため、ポリゴン内部にタイルの輪郭が現れることはありません。一方、ベクタータイルのポリゴンから派生したポイントは、タイル端のクリップで挿入された頂点に現れることがあります。それが問題になる場合は、ポイント派生にはタイル分割しない GeoJSON レイヤーを使用してください。

## 関連リソース

- [GeoJSON Source](../../../three/source/geojson-source/) / [Vector Tile Source](../../../three/source/vector-tile-source/)
- [PointMaterial](../../../three/material/point-material/) / [PolygonMaterial](../../../three/material/polygon-material/) / [PolylineMaterial](../../../three/material/polyline-material/): マテリアルの詳細設定
