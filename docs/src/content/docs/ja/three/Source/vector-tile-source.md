---
title: Vector Tile Source
description: vector-tile (MVT) の Source
sidebar:
  order: 12
---

`vector-tile` Source は、Mapbox Vector Tiles (MVT) タイルセットを記述します。[`vector`](../../../three/layer/vector-layer/) レイヤーで描画します。タイルセット内のどの Source レイヤーを描画するかは、レイヤーごとにレイヤーの `sourceLayers` プロパティで選択します。

## プロパティ

| プロパティ            | 型            | デフォルト    | 説明                                              |
| ------------------- | --------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"vector-tile"` | （必須） | Source のタイプ。                                       |
| `url`               | `string`        | （必須） | タイル URL テンプレート（`{z}/{x}/{y}` を含む）。      |
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

## 関連リソース

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
