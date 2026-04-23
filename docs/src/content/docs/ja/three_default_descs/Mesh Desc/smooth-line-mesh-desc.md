---
title: SmoothLineMeshDesc
description: Smooth line mesh descriptor for navara_three
sidebar:
  order: 107
---

`SmoothLineMeshDesc`クラスは、カトマル・ロム曲線による滑らかなラインを描画するためのメッシュです。地点の配列から滑らかな曲線を生成し、破線やポイントマーカーの表示もサポートします。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Properties

### tension

**Type:** `number`

**Description:** 曲線の張力を指定します。0は直線、値が大きいほど滑らかな曲線になります。

**Default:** `0.5`

**Example:**

```typescript
{
  smoothLines: {
    tension: 0.8,
  }
}
```

### closed

**Type:** `boolean`

**Description:** 最後の点を最初の点に接続して閉じた曲線にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  smoothLines: {
    closed: true,
  }
}
```

### segments

**Type:** `number`

**Description:** 各点の間の補間セグメント数を指定します。

**Default:** `1`

**Example:**

```typescript
{
  smoothLines: {
    segments: 10,
  }
}
```

### lineWidth

**Type:** `number`

**Description:** ラインの太さをピクセル単位で指定します。

**Default:** `1`

**Example:**

```typescript
{
  smoothLines: {
    lineWidth: 3,
  }
}
```

### dashed

**Type:** `boolean`

**Description:** 破線パターンでレンダリングするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  smoothLines: {
    dashed: true,
  }
}
```

### dashSize

**Type:** `number`

**Description:** 破線の各ダッシュの長さを指定します。

**Default:** `1000`

**Example:**

```typescript
{
  smoothLines: {
    dashSize: 500,
  }
}
```

### dashOffset

**Type:** `number`

**Description:** 破線パターンのオフセットを指定します。

**Default:** `0`

**Example:**

```typescript
{
  smoothLines: {
    dashOffset: 100,
  }
}
```

### gapSize

**Type:** `number`

**Description:** 破線の間隔の長さを指定します。

**Default:** `500`

**Example:**

```typescript
{
  smoothLines: {
    gapSize: 300,
  }
}
```

### color

**Type:** `number`

**Description:** ラインの色を16進数カラーコード(0x + hex)で指定します。

**Default:** `0xffffff`

**Example:**

```typescript
{
  smoothLines: {
    // color omitted in example to focus on geometry settings
  }
}
```

### showPoints

**Type:** `boolean`

**Description:** ライン上のサンプル点を表示するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  smoothLines: {
    showPoints: false,
  }
}
```

### pointSize

**Type:** `number`

**Description:** ポイントマーカーのサイズを指定します。

**Default:** `2`

**Example:**

```typescript
{
  smoothLines: {
    pointSize: 5,
  }
}
```

### pointColor

**Type:** `number`

**Description:** ポイントマーカーの色を16進数カラーコード(0x + hex)で指定します。

**Default:** `0xffffff`

**Example:**

```typescript
{
  smoothLines: {
    // pointColor omitted in example
  }
}
```

### points

**Type:** `LngLatHeight[]`

**Description:** ラインを構成する地点を経度緯度高度の配列で指定します。

**Default:** `[]`

**Example:**

```typescript
{
  smoothLines: {
    points: [
      { lng: 139.7671, lat: 35.6812, height: 100 },
      { lng: 139.7700, lat: 35.6850, height: 150 },
      { lng: 139.7750, lat: 35.6900, height: 100 }
    ],
  }
}
```

## Usage Examples

```typescript
import ThreeView, { SmoothLineMeshDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// SmoothLineMeshDescを追加
const smoothLineDesc = view.addMesh<SmoothLineMeshDesc>({
  smoothLines: {
    tension: 0.5,
    segments: 10,
    lineWidth: 3,
    // color omitted in example
    showPoints: true,
    pointSize: 5,
    // pointColor omitted in example
    points: [
      { lng: 139.7671, lat: 35.6812, height: 100 },
      { lng: 139.7700, lat: 35.6850, height: 150 },
      { lng: 139.7750, lat: 35.6900, height: 100 },
    ],
  },
});
```
