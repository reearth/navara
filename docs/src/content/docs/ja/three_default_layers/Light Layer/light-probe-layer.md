---
title: LightProbeDesc
description: Light probe layer for navara_three
sidebar:
  order: 152
---

`LightProbeDesc`クラスは、球面調和関数（Spherical Harmonics）を使用したImage-Based Lightingを提供するライトプローブDescriptorを表します。事前計算された環境照明データを使用して、リアルな間接照明を実現します。

## Common Properties

### visible

**Type:** `boolean | undefined`

**Description:** オブジェクトの表示/非表示を制御します。

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  lightProbe: { ... }
}
```

## LightProbe Properties

### lightProbe

**Type:** `object | undefined`

**Description:** ライトプローブの設定オプション。

#### intensity

**Type:** `number | undefined`

**Description:** ライトプローブの強度を指定します。数値が大きいほど明るくなります。

**Default:** `1`

**Example:**

```typescript
{
  lightProbe: {
    intensity: 1.0,
  }
}
```

#### sh

**Type:** `SphericalHarmonics3 | undefined`

**Description:** Three.jsの`SphericalHarmonics3`オブジェクトを直接指定します。球面調和関数の係数を含みます。`coefficients`プロパティを使用するか、`set()`メソッドで係数配列を設定できます。

**Default:** `undefined`

**Example:**

```typescript
import * as THREE from "three";

const nightCoefficients = [
  new THREE.Vector3(0.22, 0.22, 0.28),
  new THREE.Vector3(0.15, 0.15, 0.20),
  // ... 合計9つの係数（3次球面調和関数）
];

const sh = new THREE.SphericalHarmonics3();
sh.coefficients = nightCoefficients;

{
  lightProbe: {
    sh: sh,
    intensity: 0.05
  }
}
```

#### coefficients

**Type:** `number[][] | undefined`

**Description:** 球面調和関数の係数を配列で指定します。各要素は[R, G, B]の3要素配列です。`sh`の代わりにこの方法で係数を設定できます。

:::note
`sh`と`coefficients`の両方が指定された場合、`coefficients`が優先されます。
:::

**Default:** `undefined`

**Example:**

```typescript
{
  lightProbe: {
    coefficients: [
      [0.5, 0.5, 0.5],
      [0.2, 0.2, 0.2],
      // ... 他の係数
    ],
  }
}
```

## 使用例

### 基本的な使用例（夜間シーン）

```typescript
import ThreeView, { LightProbeDesc } from "@navara/three";
import * as THREE from "three";

const view = new ThreeView();
await view.init();

// 夜間用の球面調和関数係数（事前計算済み）
const NIGHT_SH_COEFFICIENTS = [
  [0.22, 0.22, 0.28],
  [0.15, 0.15, 0.20],
  // ... 他の係数
];

// ライトプローブオブジェクトを追加
const lightProbe = view.addLight<LightProbeDesc>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(NIGHT_SH_COEFFICIENTS),
    intensity: 0.05
  }
});
```

### 強度の動的更新

```typescript
// 太陽の位置に応じてライトプローブの強度を更新
view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);

  lightProbe.update({
    visible: isAtNight,
    lightProbe: {
      intensity: isAtNight ? 0.05 : 0
    }
  });
});
```

## 球面調和関数について

球面調和関数（Spherical Harmonics）は、環境照明を効率的に表現する数学的手法です：

- 環境マップをコンパクトな係数セットに圧縮
- リアルタイムレンダリングに適した高速な照明計算
- 間接照明やアンビエントオクルージョンの近似に使用

一般的には、3次の球面調和関数（9係数）が使用されます。

## 注意事項

- ライトプローブは主に間接照明の表現に使用されます。
- 夜間シーンなど、特定の照明環境を再現する際に有効です。
- 球面調和関数の係数は事前に計算または測定する必要があります。
- SkyLightProbeDescと併用することで、より動的な環境照明を実現できます。
