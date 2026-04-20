---
title: ArclineMeshLayer
description: Arcline mesh layer for navara_three
sidebar:
  order: 101
---

`ArclineMeshLayer`クラスは、2点間を結ぶアーク状のラインを描画するためのメッシュレイヤーです。地球上の2地点間を視覚的に繋ぐ際に使用され、グラデーション、破線パターン、高さ調整などの機能を提供します。

## Properties

### arcLines

**Type:** `Partial<ArcLineConfig> | Partial<ArcLineConfig>[] | undefined`

**Description:** アークラインの設定を指定します。配列を渡すことで複数のアークラインを1つのレイヤーで管理できます。

**Example:**

```typescript
{
  arcLines: {
    thickness: 2,
    srcColor: 0xff0000,
    tgtColor: 0x0000ff,
    geometry: [
      { lng: 139.7, lat: 35.7 },
      { lng: -74.0, lat: 40.7 }
    ]
  }
}
```

### thickness

**Type:** `number`

**Description:** アークラインの太さを指定します。

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    thickness: 2,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** 透明度を有効にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  arcLines: {
    transparent: true,
  }
}
```

### opacity

**Type:** `number`

**Description:** アークラインの不透明度を指定します。0.0(完全透明)から1.0(完全不透明)の範囲で指定します。

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    opacity: 0.8,
  }
}
```

### segments

**Type:** `number`

**Description:** アークラインを構成するセグメント数を指定します。値が大きいほど滑らかな曲線になります。

**Default:** `64`

**Example:**

```typescript
{
  arcLines: {
    segments: 128,
  }
}
```

### srcColor

**Type:** `number`

**Description:** アークラインの始点の色を16進数カラーコード(0x + hex)で指定します。

**Default:** `0xffffff`

**Example:**

```typescript
{
  arcLines: {
    srcColor: 0xff0000,
  }
}
```

### tgtColor

**Type:** `number`

**Description:** アークラインの終点の色を16進数カラーコード(0x + hex)で指定します。

**Default:** `0xffffff`

**Example:**

```typescript
{
  arcLines: {
    tgtColor: 0x0000ff,
  }
}
```

### height

**Type:** `number`

**Description:** 地球表面からの高さをメートル単位で指定します。

**Default:** `0`

**Example:**

```typescript
{
  arcLines: {
    height: 10000, // 10km
  }
}
```

### arcHeightScale

**Type:** `number`

**Description:** アークの高さのスケール係数を指定します。2点間の距離に対する相対的な高さを決定します。

**Default:** `0.3`

**Example:**

```typescript
{
  arcLines: {
    arcHeightScale: 0.5,
  }
}
```

### gradation

**Type:** `number`

**Description:** 色のグラデーション係数を指定します。0に近いほど始点色が強く、1に近いほど終点色が強くなります。

**Default:** `0.5`

**Example:**

```typescript
{
  arcLines: {
    gradation: 0.7,
  }
}
```

### dashed

**Type:** `boolean`

**Description:** 破線パターンを有効にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  arcLines: {
    dashed: true,
  }
}
```

### dashSize

**Type:** `number`

**Description:** 破線の長さをワールド単位で指定します。

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    dashSize: 5000,
  }
}
```

### gapSize

**Type:** `number`

**Description:** 破線の間隔をワールド単位で指定します。

**Default:** `1`

**Example:**

```typescript
{
  arcLines: {
    gapSize: 2000,
  }
}
```

### dashOffset

**Type:** `number`

**Description:** 破線パターンのオフセットをワールド単位で指定します。

**Default:** `0`

**Example:**

```typescript
{
  arcLines: {
    dashOffset: 1000,
  }
}
```

### geometry

**Type:** `LngLat[]`

**Description:** アークラインを構成する地点を経度緯度の配列で指定します。2つの地点で1本のアークラインが作成されます。

**Default:** `[]`

**Example:**

```typescript
{
  arcLines: {
    geometry: [
      { lng: 139.7671, lat: 35.6812 },  // 東京
      { lng: -74.0060, lat: 40.7128 }   // ニューヨーク
    ],
  }
}
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { ArclineMeshLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// ArclineMeshLayerを追加
const arclineLayer = view.addMesh<ArclineMeshLayer>({
  arcLines: {
    thickness: 2,
    srcColor: 0xff0000,
    tgtColor: 0x0000ff,
    arcHeightScale: 0.3,
    segments: 128,
    geometry: [
      { lng: 139.7671, lat: 35.6812 },  // 東京
      { lng: -74.0060, lat: 40.7128 },  // ニューヨーク
    ],
  },
});
```

### 複数のアークライン

```typescript
const arclineLayer = view.addMesh<ArclineMeshLayer>({
  arcLines: [
    {
      thickness: 2,
      srcColor: 0xff0000,
      tgtColor: 0x00ff00,
      geometry: [
        { lng: 139.7, lat: 35.7 },
        { lng: -0.1, lat: 51.5 },
      ],
    },
    {
      thickness: 3,
      srcColor: 0x0000ff,
      tgtColor: 0xffff00,
      dashed: true,
      dashSize: 5000,
      gapSize: 2000,
      geometry: [
        { lng: -74.0, lat: 40.7 },
        { lng: 2.3, lat: 48.9 },
      ],
    },
  ],
});
```

### 動的な更新

```typescript
// レイヤーの設定を更新
arclineLayer.update({
  arcLines: {
    thickness: 5,
    opacity: 0.5,
  },
});
```