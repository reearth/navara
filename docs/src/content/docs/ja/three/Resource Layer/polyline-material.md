---
title: PolylineMaterial
description: Polyline material for navara_three
sidebar:
  order: 35
---

`PolylineMaterial`は、ポリラインジオメトリレンダリング用のマテリアルを表します。

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** ポリラインが影を投影するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    castShadow: true
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
  polyline: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color`

**Description:** ポリラインの色を`Color`インスタンスで指定します。

**Default:** Required

**Example:**

```typescript
import { Color } from "@navara/three";

{
  polyline: {
    color: new Color().setHex(0x0066cc)
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
  polyline: {
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
  polyline: {
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
  polyline: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number | undefined`

**Description:** ポリラインの高さを指定します。単位はメートルです。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    height: 1
  }
}
```

### maxWidth

**Type:** `number | undefined`

**Description:** ピクセル単位の最大線幅。ズームレベルに関係なくレンダリング幅を制限します。小さい値はフラグメントシェーダーのオーバードローを削減し、パフォーマンスが向上します。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    maxWidth: 10
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** ポリラインが影を受けるかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    receiveShadow: true
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
  polyline: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** ポリラインを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    show: true
  }
}
```

### tiled

**Type:** `boolean | undefined`

**Description:** データソースがMVTレイヤーでない場合でも、ポリラインをXYZベクトルタイルに分割してレンダリングします。大きなポリラインのパフォーマンスを向上させることができます。`clampToGround`を有効にすると、`tiled`は暗黙的に`true`に強制されます。

**Default:** `false`

**Example:**

```typescript
{
  polyline: {
    tiled: true
  }
}
```

### width

**Type:** `number`

**Description:** ポリラインの幅を指定します。単位はピクセルです。

**Default:** Required

**Example:**

```typescript
{
  polyline: {
    width: 3
  }
}
```
