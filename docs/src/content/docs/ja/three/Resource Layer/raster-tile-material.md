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

:::note
`maxSse`、`segments`、`shouldComputeNormalFromVertex` などのグローブレベルの設定は、このマテリアルではなく [Globe](../../../three/api/globe/) API で設定します。
:::

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

