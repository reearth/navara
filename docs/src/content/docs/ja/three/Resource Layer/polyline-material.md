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

**Description:** 適用するセレクティブエフェクトの ID を指定します（例: "bloom", "outline"）。SelectiveBloomEffectLayer や SelectiveOutlineEffectLayer と連携して使用します。

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

### useGroundNormals

**Type:** `boolean | undefined`

**Description:** 地形の影をポリラインに反映するかどうかを指定します。`clampToGround` が `true` の場合に有効です。

**Default:** `undefined`

**Example:**

```typescript
{
  polyline: {
    useGroundNormals: true
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
