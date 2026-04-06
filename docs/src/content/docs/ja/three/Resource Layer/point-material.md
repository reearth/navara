---
title: PointMaterial
description: Point material for navara_three
sidebar:
  order: 33
---

`PointMaterial`は、ポイントジオメトリレンダリング用のマテリアルを表します。

## Properties

### center

**Type:** `{ x: number, y: number }`

**Description:** 中心からのシフト量を指定します。範囲は 0 から 1 の間です。単位は、ポイントの丸に対する相対位置です。

**Default:** Required

**Example:**

```typescript
{
  point: {
    center: { x: 0.5, y: 0.5 }
  }
}
```

### clampToGround

**Type:** `boolean`

**Description:** 地面に張り付けるかどうかを指定します。

**Default:** Required

**Example:**

```typescript
{
  point: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** ポイントの色を`Color`インスタンスで指定します。

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  point: {
    color: new Color().setHex(0xff0000)
  }
}
```

### depthTest

**Type:** `boolean | undefined`

**Description:** 前面のモデルが背面のモデルを隠すかどうかを決定する変数です。

**Default:** `true`

**Example:**

```typescript
{
  point: {
    depthTest: true
  }
}
```

### effectIds

**Type:** `string[] | undefined`

**Description:** 適用するセレクティブエフェクトの ID を指定します（例: "bloom", "outline"）。SelectiveBloomEffectLayer や SelectiveOutlineEffectLayer と連携して使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
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
  point: {
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
  point: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number`

**Description:** 高さを指定します。単位はメートルです。

**Default:** Required

**Example:**

```typescript
{
  point: {
    height: 100 // 100メートル
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** 地球表面との重なりを回避します。ポイントが地球表面にめり込まないようにする場合に使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
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
  point: {
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
  point: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** ポイントを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
    show: true
  }
}
```

### size

**Type:** `number`

**Description:** ポイントのサイズを指定します。単位はメートルです。

**Default:** Required

**Example:**

```typescript
{
  point: {
    size: 10 // 10メートル
  }
}
```

### transparent

**Type:** `boolean | undefined`

**Description:** ポイントの透過度を考慮するかどうかを指定します。true にするとエフェクトレイヤーを有効にしたときにポイントがうまく表示されないことがあるので注意してください。

**Default:** `undefined`

**Example:**

```typescript
{
  point: {
    transparent: false
  }
}
```
