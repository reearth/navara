---
title: Vector Tile Source
description: vector-tile (MVT) の Source
sidebar:
  order: 320
---

`vector-tile` Source は、Mapbox Vector Tiles (MVT) タイルセットを記述します。[`vector`](../../../three/layer/vector-layer/) レイヤーで描画します。タイルセット内のどの Source レイヤーを描画するかは、レイヤーごとにレイヤーの `sourceLayers` プロパティで選択します。

`url` には 2 種類の形式を指定できます。

- **タイルテンプレート** — `{z}/{x}/{y}` プレースホルダーを含む URL。各タイルを個別に取得します。
- **PMTiles アーカイブ** — `.pmtiles` で終わる単一の URL。すべてのタイルが 1 つのファイルにまとめられ、HTTP レンジリクエストで取得されます。詳しくは下記の [PMTiles アーカイブ](#pmtiles-アーカイブ)を参照してください。

どちらの形式でも同じ Source が生成され、エンジンが URL に応じて適切な実装を自動的に選択します。

## プロパティ

| プロパティ            | 型            | デフォルト    | 説明                                              |
| ------------------- | --------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"vector-tile"` | （必須） | Source のタイプ。                                       |
| `url`               | `string`        | （必須） | タイル URL（`{z}/{x}/{y}` テンプレート、または `.pmtiles` アーカイブ URL）。 |
| `maxZoom`           | `number`        | `20`       | 新しいタイルを要求する最大ズームレベル。               |
| `overscaledMaxZoom` | `number`        | `24`       | オーバースケール（親を引き伸ばした）タイルを使用する最大ズーム。 |
| `maxSse`            | `number`        | `2.0`      | タイルの走査を駆動する最大スクリーンスペースエラー。   |
| `crs`               | `string`        | —          | タイルの座標参照系。                                   |

## Source の共有

複数の `vector` レイヤーが 1 つの vector-tile Source を参照できます。タイルデータと走査は共有され、各レイヤーは自身の `sourceLayers` をスタイリングします。

```typescript
import ThreeView, { Color } from "@navara/three";

const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555") },
});
```

## PMTiles アーカイブ

[PMTiles](https://docs.protomaps.com/pmtiles/) アーカイブは、タイルピラミッド全体を **1 つのファイル** にまとめたものです。タイルごとに HTTP リクエストを送る代わりに、エンジンはアーカイブのヘッダーとディレクトリを一度だけ読み込み、その後は HTTP レンジリクエストで個々のタイルを取得します。ペイロードが MVT のアーカイブのみサポートされます。

利用するには Source の `url` にアーカイブを指定します。URL に `{z}/{x}/{y}` プレースホルダーは **不要** で、`.pmtiles` で終わります。エンジンがアーカイブ用の実装を自動的に選択します。

```typescript
import ThreeView, { Color } from "@navara/three";

// Credit: © OpenStreetMap contributors, © Protomaps (https://protomaps.com)
const PMTILES_URL =
  "https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles";

const firenze = view.addSource({
  type: "vector-tile",
  url: PMTILES_URL,
  maxZoom: 15,
});

view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["water"],
  polygon: { color: new Color().setStyle("#4a90d9"), clampToGround: true },
});
```

これ以外はテンプレート形式の vector-tile Source と同じです。同じマテリアルが適用でき、`sourceLayers` でスタイルを適用するベクターレイヤーを選択でき、同一の Source を参照する複数の `vector` レイヤーは 1 つのアーカイブを共有します（ヘッダー／ディレクトリの取得は一度だけ、タイルキャッシュも共有）。

```typescript
const firenze = view.addSource({
  type: "vector-tile",
  url: PMTILES_URL,
  maxZoom: 15,
});

// 土地のベース塗り。
view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["earth"],
  polygon: { color: new Color().setStyle("#d0bf70"), clampToGround: true },
});

// 道路を上に重ねる（同じアーカイブを一度だけ解決）。
view.addLayer({
  type: "vector",
  source: firenze,
  sourceLayers: ["roads"],
  polyline: {
    show: true,
    color: new Color().setStyle("#278b8c"),
    width: 6,
    height: 1,
    clampToGround: true,
  },
});
```

:::note
アーカイブは HTTP レンジリクエスト（`Range` / `Accept-Ranges`）をサポートするホストから配信する必要があります。クロスオリジンの URL の場合は CORS も許可されている必要があります。ほとんどの静的ホスト（S3、CDN）は両方を満たしています。
:::

## 関連リソース

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
