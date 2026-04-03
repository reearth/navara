---
title: AerialPerspectiveEffectLayer
description: Aerial perspective effect layer for navara_three
sidebar:
  order: 51
---

`AerialPerspectiveEffectLayer`クラスは、大気遠近法エフェクトを表現するレイヤーです。大気による光の散乱(inscatter)と透過(transmittance)を計算し、遠くのオブジェクトほど青みがかって見える効果を実現します。

このエフェクトは `Atmosphere` クラスが提供する事前計算済みテクスチャと太陽・月の方向を使用して、物理的に正確な大気散乱を再現します。

:::tip[関連ドキュメント]
大気システムの詳細については [Atmosphere クラス](../../../three/api-reference/atmosphere/) を参照してください。
:::

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

**Example:**
```typescript
{ visible: true }
```

### inscatter

**Type:** `boolean | undefined`

**Description:** 大気中の光の散乱効果を有効にするかどうかを指定します。遠くのオブジェクトが明るく霞んで見える効果です。

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    inscatter: true,
  }
}
```

### transmittance

**Type:** `boolean | undefined`

**Description:** 大気による光の透過効果を有効にするかどうかを指定します。遠くのオブジェクトが暗く見える効果です。

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    transmittance: true,
  }
}
```

### irradiance

**Type:** `boolean | undefined`

**Description:** ポストプロセッシング段階でマテリアルを照らすために使用されます。透明度をサポートしていません。影付きで雲をレンダリングする場合にこのフラグを有効にします。

**Default:** `false`

**Example:**

```typescript
{
  aerialPerspective: {
    irradiance: false,
  }
}
```

### sky

**Type:** `boolean | undefined`

**Description:** 空の色を大気エフェクトに適用するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  aerialPerspective: {
    sky: false,
  }
}
```

### sun

**Type:** `boolean | undefined`

**Description:** 太陽の方向を大気エフェクトに適用するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    sun: true,
  }
}
```

### moon

**Type:** `boolean | undefined`

**Description:** 月の方向を大気エフェクトに適用するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    moon: true,
  }
}
```

## Usage Examples

### デフォルトエフェクトレイヤーで大気遠近法を有効にする

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView();
await view.init();

// デフォルトのエフェクトレイヤーを追加（AerialPerspectiveEffectLayerを含む）
const defaultEffects = view.addDefaultEffectLayers();

// 大気遠近法エフェクトの設定を更新
defaultEffects.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    sky: false,
  },
});
```

### 雲の影と組み合わせた大気遠近法

```typescript
import ThreeView, { CloudsEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

const defaultEffects = view.addDefaultEffectLayers();
view.addDefaultAtmosphereLayers();

// 雲の影を有効にする場合、irradianceを有効にする
defaultEffects.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    irradiance: true,
  },
});

// 雲エフェクトレイヤーを追加
view.addLayer<CloudsEffectLayer>({
  type: "effect",
  clouds: {
    shadows: true,
  },
});
```
