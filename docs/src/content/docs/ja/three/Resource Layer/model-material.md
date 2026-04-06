---
title: ModelMaterial
description: Model material for navara_three
sidebar:
  order: 32
---

`ModelMaterial`は、3D モデルレンダリング用のマテリアルを表します。

## Properties

### animationActiveClip

**Type:** `string | undefined`

**Description:** GLTF に登録されているアニメーションを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationActiveClip: "Walk"
  }
}
```

:::tip[フルアニメーション制御]
`animationAutoPlay`、`animationClips`、`animationCrossfadeDuration`、`animationEnabled`、`animationLoop` などの高度なアニメーション機能については、メッシュレイヤーとしてフルアニメーション制御を提供する [GLTFModelLayer](../../../three_default_layers/mesh-layer/gltf-model-layer/) を使用してください。
:::

### animationSpeed

**Type:** `number | undefined`

**Description:** アニメーションの再生速度を指定します。1.0 が通常速度です。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationSpeed: 1.0
  }
}
```

### applyWaterNormal

**Type:** `boolean | undefined`

**Description:** 水の法線マップを適用するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    applyWaterNormal: true
  }
}
```

### castShadow

**Type:** `boolean | undefined`

**Description:** モデルが影を投影するかどうかを指定します。View で影を有効にして、太陽光レイヤの castShadow を有効にすると動作します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    castShadow: true
  }
}
```

### clampToGround

**Type:** `boolean | undefined`

**Description:** 地面に張り付けるかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** モデルの色を`Color`インスタンスで指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  model: {
    color: new Color().setHex(0xffffff)
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
  model: {
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
  model: {
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
  model: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number | undefined`

**Description:** モデルの高さを指定します。単位はメートルです。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    height: 50 // 50メートル
  }
}
```

### ior

**Type:** `number | undefined`

**Description:** 屈折率（Index of Refraction）を指定します。物質を透過する光の屈折に影響します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    ior: 1.5 // ガラスの屈折率
  }
}
```

### maxSse

**Type:** `number | undefined`

**Description:** 詳細レベル（LOD）の詳細度を決定するために使用される最大値です。値が高いほど、パフォーマンスは向上しますが、視覚的な品質は低下します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    maxSse: 16
  }
}
```

### metalness

**Type:** `number | undefined`

**Description:** マテリアルの金属度を指定します。0.0 から 1.0 の範囲で指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    metalness: 0.1
  }
}
```

### pointSize

**Type:** `number | undefined`

**Description:** ポイントクラウドとしてレンダリングする場合のポイントサイズを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    pointSize: 2.0
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** モデルが影を受けるかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    receiveShadow: true
  }
}
```

### reflectivity

**Type:** `number | undefined`

**Description:** ポストプロセスまたは環境マップ用の反射率を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    reflectivity: 0.8
  }
}
```

### roughness

**Type:** `number | undefined`

**Description:** ポストプロセス用の反射率（粗さ）を指定します。0.0 から 1.0 の範囲で指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    roughness: 0.1
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
  model: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### shininess

**Type:** `number | undefined`

**Description:** マテリアルの光沢度を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    shininess: 30
  }
}
```

### shouldRotateInDefault

**Type:** `boolean | undefined`

**Description:** モデルの向きを楕円体上で正しく配置するために自動的に調整するプロパティです。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    shouldRotateInDefault: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** モデルを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
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
  model: {
    showBoundingBox: true
  }
}
```

### size

**Type:** `number | undefined`

**Description:** モデルのサイズを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    size: 1.5 // 1.5倍のサイズ
  }
}
```

### specular

**Type:** `boolean | undefined`

**Description:** スペキュラー効果を有効にするかどうかを指定します。有効にすると `shininess` と `specularStrength` の値が使用されます。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    specular: true
  }
}
```

### specularStrength

**Type:** `number | undefined`

**Description:** スペキュラーハイライトの強度を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    specularStrength: 0.5
  }
}
```

### url

**Type:** `string | undefined`

**Description:** データソースの URL を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    url: "https://example.com/models/building.glb"
  }
}
```

### water

**Type:** `boolean | undefined`

**Description:** ポリゴンに水面マテリアルを適用するかどうかを指定します。メッシュの読み込みが遅くなる可能性があります。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    water: true
  }
}
```

### waterNormalUrl

**Type:** `string | undefined`

**Description:** 水面の法線マップの URL を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterNormalUrl: "/textures/water_normal.png"
  }
}
```

### waterScaleNormal

**Type:** `number | undefined`

**Description:** 水面法線のスケールを指定します。この値を小さくすると水面が粗くなります。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterScaleNormal: 2.0
  }
}
```

### waterSpeed

**Type:** `number | undefined`

**Description:** 水の波の速度を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterSpeed: 0.003
  }
}
```
