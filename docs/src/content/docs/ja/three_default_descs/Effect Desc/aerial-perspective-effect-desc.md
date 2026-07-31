---
title: AerialPerspectiveEffectDesc
description: Aerial perspective effect descriptor for navara_three
sidebar:
  order: 51
---

`AerialPerspectiveEffectDesc`クラスは、大気遠近法エフェクトを表現するDescriptorです。大気による光の散乱(inscatter)と透過(transmittance)を計算し、遠くのオブジェクトほど青みがかって見える効果を実現します。

このエフェクトは `Atmosphere` クラスが提供する事前計算済みテクスチャと太陽・月の方向を使用して、物理的に正確な大気散乱を再現します。

:::tip[関連ドキュメント]
大気システムの詳細については [Atmosphere クラス](../../../three/api/atmosphere/) を参照してください。
:::

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

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

### useNormalBuffer

**Type:** `boolean | undefined`

**Description:** エフェクトに法線バッファをバインドするかどうかを指定します。これは、このパスでマテリアルに対する deferred lighting（irradiance の適用）を行うかどうかの切り替えとして機能します。`false` の場合、法線バッファはエフェクトに渡されず、マテリアルにポストプロセスのライティングは適用されません（大気の in-scatter と transmittance の計算自体は引き続き行われますが、このパスによってマテリアルがライティングし直されることはありません）。シーンのジオメトリが信頼できる法線バッファを出力しない場合（例: 法線情報を持たないタイル glTF アセットなど）に無効化し、マテリアルのライティングをそのまま保ちたいときに使用します。

**Default:** `true`

**Example:**

```typescript
{
  aerialPerspective: {
    useNormalBuffer: false,
  }
}
```

### albedoScale

**Type:** `number | undefined`

**Description:** 内部の `AerialPerspectiveEffect` に渡される `albedoScale` uniform の値を指定します。irradiance パスで diffuse 項を計算する際に、シーンカラーへ乗算されるスケール係数として使用されます。

**Default:** `2 / Math.PI`

**Example:**

```typescript
{
  aerialPerspective: {
    albedoScale: 2 / Math.PI,
  }
}
```

## Usage Examples

### デフォルトエフェクトで大気遠近法を有効にする

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加（AerialPerspectiveEffectDescを含む）
const defaultLayers = plugin.addDefaultPhotorealScene();

// 大気遠近法エフェクトの設定を更新
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    sky: false,
  },
});
```

### 雲の影と組み合わせた大気遠近法

```typescript
import ThreeView from "@navaramap/three";
import { CloudsEffectDesc } from "@navaramap/three-default-descs";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// 雲の影を有効にする場合、irradianceを有効にする
defaultLayers.aerialPerspective.update({
  aerialPerspective: {
    inscatter: true,
    transmittance: true,
    irradiance: true,
  },
});

// 雲エフェクトを追加
view.addEffect<CloudsEffectDesc>({
  clouds: {
    shadows: true,
  },
});
```
