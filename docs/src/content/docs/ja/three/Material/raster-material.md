---
title: RasterMaterial
description: raster レイヤーのラスター画像描画オプション
sidebar:
  order: 570
---

`RasterMaterial` は、[`raster`](../../../three/layer/raster-layer/) レイヤーの画像の描画オプションを保持します。`raster` キーで設定します。取得・タイリングの設定（ズーム範囲、TMS など）はすべて、参照する [`raster-tile`](../../../three/source/raster-tile-source/) の Source 側にあり、ここにはありません。

## プロパティ

### show

**型:** `boolean | undefined`

**説明:** ラスター画像を表示するかどうか。

```typescript
{ raster: { show: true } }
```

### color

**型:** `Color`

**説明:** ラスター画像に適用するティント色。`Color` インスタンスで指定します。

```typescript
import { Color } from "@navaramap/three";

{ raster: { color: new Color().setHex(0xffffff) } }
```

### opacity

**型:** `number | undefined`

**説明:** ラスター画像の不透明度。`0.0` から `1.0` まで。

```typescript
{ raster: { opacity: 0.8 } }
```

### showBoundingBox

**型:** `boolean | undefined`

**説明:** タイルごとのバウンディングボックスを表示するかどうか。デバッグ用です。

```typescript
{ raster: { showBoundingBox: true } }
```

:::note
`maxSse` や `segments` のようなグローブ全体の設定は、このマテリアルではなく [Globe](/three/api/globe/) API で設定します。
:::

## 関連リソース

- [Raster Layer](../../../three/layer/raster-layer/) — このマテリアルの使い方
- [Raster Tile Source](../../../three/source/raster-tile-source/) — 画像の Source（URL、ズーム、TMS）
