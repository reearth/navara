---
title: MVT Layer
description: MVT (Mapbox Vector Tiles) レイヤーの使い方
sidebar:
  order: 24
---

MVT（Mapbox Vector Tiles）レイヤーは、ベクタータイル形式の地理データを表示するためのレイヤーです。大規模なベクターデータを効率的に表示できます。

## 基本設定

| プロパティ | 型                | 説明                                                         |
| ---------- | ----------------- | ------------------------------------------------------------ |
| `type`     | `"mvt"`           | レイヤータイプ（必須）                                       |
| `data`     | `{ url: string }` | ベクタータイルの URL（`{z}/{x}/{y}` プレースホルダーを含む） |

## 対応マテリアル

データ内のジオメトリタイプに応じて、複数のマテリアルを同時に指定できます。

| マテリアル                                                                          | 設定キー     | 対応ジオメトリ        |
| ----------------------------------------------------------------------------------- | ------------ | --------------------- |
| [PointMaterial](../../../three/resource-layer-reference/point-material/)            | `point`      | Point                 |
| [BillboardMaterial](../../../three/resource-layer-reference/billboard-material/)    | `billboard`  | Point（アイコン表示） |
| [TextMaterial](../../../three/resource-layer-reference/text-material/)              | `text`       | Point（ラベル表示）   |
| [PolylineMaterial](../../../three/resource-layer-reference/polyline-material/)      | `polyline`   | LineString            |
| [PolygonMaterial](../../../three/resource-layer-reference/polygon-material/)        | `polygon`    | Polygon               |
| [VectorTileMaterial](../../../three/resource-layer-reference/vector-tile-material/) | `vectorTile` | タイル全体の設定      |

## キャッシュ戦略

### ソースの共有

MVT レイヤーの `data.url` が同一の場合、タイルデータのキャッシュが共有されます。これにより、同じタイルソースに対して異なるスタイルを適用する複数のレイヤーを効率的に表示できます。

```typescript
import ThreeView, { Color } from "@navara/three";

const VECTOR_TILE_URL = "https://example.com/tiles/{z}/{x}/{y}.mvt";

// 水域レイヤー
view.addLayer({
  type: "mvt",
  data: { url: VECTOR_TILE_URL },
  polygon: {
    color: new Color().setStyle("#00aaff"),
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["waterarea"],
  },
});

// 建物レイヤー
view.addLayer({
  type: "mvt",
  data: { url: VECTOR_TILE_URL },
  polygon: {
    color: new Color().setStyle("#555555"),
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["building"],
  },
});
```

上記の例では、同じ URL を使用しているため、タイルデータのダウンロードは一度だけで済みます。

:::warning
URL にクエリパラメータを追加すると、キャッシュが共有されなくなります。キャッシュを効率的に活用するには、`data.url` を完全に一致させてください。
:::

## 使用例

### ポイント地物

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const pointLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Wakayama City (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-30201-wakayama-shi-2023
    url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
  },
  point: {
    color: new Color().setHex(0xff0000),
    size: 0.01,
    height: 1,
    center: { x: 0.5, y: 0 },
    sizeInMeters: true,
    clampToGround: true,
    depthTest: true,
  },
});
```

### 道路ネットワーク

```typescript
import ThreeView, { Color } from "@navara/three";

const roadLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Gifu City (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-21201-gifu-shi-2023
    url: "https://assets.cms.plateau.reearth.io/assets/67/b5b3c6-71d8-405c-88c8-4ead72890b2b/21201_gifu-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
  },
  polyline: {
    show: true,
    color: new Color().setHex(0x00ff00),
    width: 2,
    height: 1,
    clampToGround: true,
  },
  vectorTile: {
    maxZoom: 16,
  },
});
```

### 土地利用エリア

```typescript
import ThreeView, { Color } from "@navara/three";

const landUseLayer = view.addLayer({
  type: "mvt",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Tokyo 23 Wards - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku
    url: "https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
  },
  polygon: {
    color: new Color().setHex(0x00aaff),
    height: 10,
    extrudedHeight: 0,
    clampToGround: true,
    wireframe: false,
  },
  vectorTile: {
    maxZoom: 15,
    layers: ["HeightControlDistrict"],
  },
});
```

## 関連リソース

- [GeoJSON Layer](../../../three/resource-layer-reference/geojson-layer/) - GeoJSON 形式のデータを表示
- [VectorTileMaterial](../../../three/resource-layer-reference/vector-tile-material/) - ベクタータイルマテリアルの詳細設定
