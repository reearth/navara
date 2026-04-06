---
title: RasterTileMaterial
description: Raster tile material for navara_three
sidebar:
  order: 37
---

`RasterTileMaterial`は、ラスタータイルレンダリング用のマテリアルを表します。

## Properties

### color

**Type:** `Color`

**Description:** ラスタータイルの色を`Color`インスタンスで指定します。

**Example:**

```typescript
import { Color } from "@navara/three";

{
  rasterTile: {
    color: new Color().setHex(0xffffff)
  }
}
```

### maxSse

**Type:** `number`

**Description:** 詳細レベル（LOD）の詳細度を決定するために使用される最大値です。値が高いほど、パフォーマンスは向上しますが、視覚的な品質は低下します。

**Default:** `2`

**Example:**

```typescript
{
  rasterTile: {
    maxSse: 4
  }
}
```

### maxZoom

**Type:** `number`

**Description:** 最大ズームレベルを指定します。この値を超えるズームレベルではタイルが表示されません。

**Example:**

```typescript
{
  rasterTile: {
    maxZoom: 18
  }
}
```

### minZoom

**Type:** `number | undefined`

**Description:** 最小ズームレベルを指定します。この値未満のズームレベルではタイルが表示されません。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    minZoom: 0
  }
}
```

### opacity

**Type:** `number | undefined`

**Description:** ラスタータイルの画像の不透明度を指定します。範囲は 0.0 から 1.0 です。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    opacity: 0.8
  }
}
```

### segments

**Type:** `number`

**Description:** ポリゴン分割のセグメント数を指定します。セグメント数が多いほど、より滑らかな球面が得られます。

**Example:**

```typescript
{
  rasterTile: {
    segments: 32
  }
}
```

### shouldComputeNormalFromVertex

**Type:** `boolean | undefined`

**Description:** 頂点から法線を計算するかどうかを指定します。Terrain が追加されている場合は自動で`true`になります。Terrain が追加されていない場合に`true`にした場合は、太陽光の影が表示されるようになります。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    shouldComputeNormalFromVertex: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** ラスタータイルを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    show: true
  }
}
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** バウンディングボックスを表示するかどうかを指定します。デバッグ目的で使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    showBoundingBox: true
  }
}
```

### tms

**Type:** `boolean | undefined`

**Description:** TMS（Tile Map Service）形式を使用するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    tms: false
  }
}
```

### wireframe

**Type:** `boolean | undefined`

**Description:** ワイヤーフレーム表示にするかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  rasterTile: {
    wireframe: false
  }
}
```
