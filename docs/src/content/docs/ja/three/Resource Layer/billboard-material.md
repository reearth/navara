---
title: BillboardMaterial
description: Billboard material for navara_three
sidebar:
  order: 31
---

`BillboardMaterial`は、ビルボードレンダリング用のマテリアルを表します。

## Properties

### alphaTest

**Type:** `number | undefined`

**Description:** 画像の RGBA の A が 閾値 以下の場合はそのピクセルをレンダリングしないようになります。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    alphaTest: 0.5
  }
}
```

### center

**Type:** [`Vec2`](./point-material#vec2)

**Description:** 中心からのシフト量を指定します。範囲は 0 から 1 の間です。

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    center: { x: 0.5, y: 0.5 }
  }
}
```

### clampToGround

**Type:** `boolean`

**Description:** 地面に沿わせるかどうかを指定します。

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** ビルボードの色を`Color`インスタンスで指定します。

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  billboard: {
    color: new Color().setHex(0xffffff)
  }
}
```

### depthTest

**Type:** `boolean`

**Description:** 前面のモデルが背面のモデルを隠すかどうかを決定する変数です。

**Default:** `true`

**Example:**

```typescript
{
  billboard: {
    depthTest: true
  }
}
```

### effectIds

**Type:** `string[] | undefined`

**Description:** 適用するセレクティブエフェクトの ID を指定します（例: "bloom", "outline"）。SelectiveBloomEffectDesc や SelectiveOutlineEffectDesc と連携して使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    effectIds: ["bloom", "outline"]
  }
}
```

### emissiveColor

**Type:** `Color | undefined`

**Description:** 発光色を`Color`インスタンスで指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  billboard: {
    emissiveColor: new Color().setHex(0xff0000)
  }
}
```

### emissiveIntensity

**Type:** `number | undefined`

**Description:** 発光の強度を指定します。Bloom エフェクトが有効な場合のデフォルト値は 0.3 です。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number`

**Description:** ビルボードの高さを指定します。単位はメートルです。

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    height: 100 // 100メートル
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** 地球表面との重なりを回避します。ビルボードが地球表面にめり込まないようにする場合に使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    offsetDepth: true
  }
}
```

### sizeInMeters

**Type:** `boolean | undefined`

**Description:** サイズをメートル単位で指定するかどうか。false の場合、サイズはピクセル単位です。

**Default:** `true`

**Example:**

```typescript
{
  billboard: {
    sizeInMeters: true
  }
}
```

### selectiveEffectOcclusion

**Type:** `string | undefined`

**Description:** セレクティブエフェクトマスクパスの深度動作を指定します。"normal" または "silhouette" を指定できます。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** ビルボードを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    show: true
  }
}
```

### size

**Type:** `number`

**Description:** ビルボードのサイズを指定します。単位はメートルです。

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    size: 10 // 10メートル
  }
}
```

### transparent

**Type:** `boolean | undefined`

**Description:** ビルボードの透過度を考慮するかどうかを指定します。true にするとエフェクトレイヤーを有効にしたときにビルボードがうまく表示されないことがあるので注意してください。

**Default:** `undefined`

**Example:**

```typescript
{
  billboard: {
    transparent: false
  }
}
```

### url

**Type:** `string`

**Description:** オブジェクトの URL を指定します。画像ファイルをサポートします。

**Default:** Required

**Example:**

```typescript
{
  billboard: {
    url: "https://example.com/icons/marker.png"
  }
}
```
