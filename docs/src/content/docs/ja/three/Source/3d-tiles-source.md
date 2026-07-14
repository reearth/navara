---
title: 3D Tiles Source
description: 3d-tiles（3D Tiles タイルセット）の Source
sidebar:
  order: 360
---

`3d-tiles` Source は 3D Tiles タイルセット（`tileset.json` 階層）を指します。[`3d-tiles`](../../../three/layer/3d-tiles-layer/) レイヤーで描画します。

## プロパティ

| プロパティ | 型           | デフォルト | 説明                     |
| -------- | ------------ | ---------- | ------------------------ |
| `type`   | `"3d-tiles"` | （必須） | Source のタイプ。        |
| `url`    | `string`     | （必須） | `tileset.json` の URL。  |
| `crs`    | `string`     | —          | コンテンツの座標参照系。 |

## 使用例

```typescript
import ThreeView from "@navara/three";

const tileset = view.addSource({
  type: "3d-tiles",
  url: "https://example.com/tileset.json",
});
view.addLayer({ type: "3d-tiles", source: tileset, model: { opacity: 1.0 } });
```

## 関連リソース

- [About Source](../../../three/source/about/)
- [ModelMaterial](../../../three/material/model-material/) — 3D モデルの描画オプション
