---
title: RainDropEffectLayer
description: Rain drop effect layer for navara_three
sidebar:
  order: 57
---

`RainDropEffectLayer`クラスは、画面に雨粒の屈折効果を適用するレイヤーです。雨粒が画面を流れ落ちるアニメーション効果を生成します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### opacity

**Type:** `number | undefined`

**Description:** シェーダー実行後に適用される不透明度を指定します。エフェクトのブレンドに便利です。

**Default:** `1`

**Example:**

```typescript
{
  rainDrop: {
    opacity: 0.8,
  }
}
```

### dropGridSize

**Type:** `number | undefined`

**Description:** 雨粒を配置するために使用されるUVグリッドのサイズを指定します。大きい値ほど小さなセルになります。

**Default:** `12`

**Example:**

```typescript
{
  rainDrop: {
    dropGridSize: 15,
  }
}
```

### dropDensity

**Type:** `number | undefined`

**Description:** 雨粒の生成数を制御するシェーダー内の乗数を指定します。

**Default:** `1`

**Example:**

```typescript
{
  rainDrop: {
    dropDensity: 1.5,
  }
}
```

### dropLayers

**Type:** `number | undefined`

**Description:** シミュレートされるアクティブなレイヤー数を指定します。高い値は小さな雨粒を追加しますが、コストが増えます。

**Default:** `4`

**Example:**

```typescript
{
  rainDrop: {
    dropLayers: 3,
  }
}
```

### dropSizeFactor

**Type:** `number | undefined`

**Description:** グリッドサイズをスケールして雨粒がどれだけ密に詰まっているかを制御します。

**Default:** `0.015`

**Example:**

```typescript
{
  rainDrop: {
    dropSizeFactor: 0.02,
  }
}
```

### noiseScale

**Type:** `number | undefined`

**Description:** ジッターと屈折の揺らぎを駆動するノイズをスケールします。

**Default:** `200`

**Example:**

```typescript
{
  rainDrop: {
    noiseScale: 250,
  }
}
```

### refractionStrength

**Type:** `number | undefined`

**Description:** 屈折によって引き起こされるUV歪みの強度を指定します。

**Default:** `0.3`

**Example:**

```typescript
{
  rainDrop: {
    refractionStrength: 0.5,
  }
}
```

### minDropStrength

**Type:** `number | undefined`

**Description:** 雨粒をレンダリングする前に必要な最小強度を指定します。

**Default:** `0.01`

**Example:**

```typescript
{
  rainDrop: {
    minDropStrength: 0.02,
  }
}
```

### dropFadeStart

**Type:** `number | undefined`

**Description:** 雨粒の表示のスムーズなフェードウィンドウの開始を指定します。

**Default:** `0.3`

**Example:**

```typescript
{
  rainDrop: {
    dropFadeStart: 0.4,
  }
}
```

### dropFadeEnd

**Type:** `number | undefined`

**Description:** 雨粒の表示のスムーズなフェードウィンドウの終了を指定します。

**Default:** `0.8`

**Example:**

```typescript
{
  rainDrop: {
    dropFadeEnd: 0.9,
  }
}
```

### dropThresholdFactor

**Type:** `number | undefined`

**Description:** 生成確率を制御するベース閾値係数を指定します。

**Default:** `0.08`

**Example:**

```typescript
{
  rainDrop: {
    dropThresholdFactor: 0.1,
  }
}
```

### gridDensityLow

**Type:** `number | undefined`

**Description:** 密度が低い時に適用される調整を指定します。

**Default:** `1.15`

**Example:**

```typescript
{
  rainDrop: {
    gridDensityLow: 1.2,
  }
}
```

### gridDensityHigh

**Type:** `number | undefined`

**Description:** 密度が高い時に適用される調整を指定します。

**Default:** `0.85`

**Example:**

```typescript
{
  rainDrop: {
    gridDensityHigh: 0.9,
  }
}
```

### jitterStrengthLow

**Type:** `number | undefined`

**Description:** まばらな雨粒の最大ジッターを指定します。

**Default:** `0.45`

**Example:**

```typescript
{
  rainDrop: {
    jitterStrengthLow: 0.5,
  }
}
```

### jitterStrengthHigh

**Type:** `number | undefined`

**Description:** 密集した雨粒の最小ジッターを指定します。

**Default:** `0.08`

**Example:**

```typescript
{
  rainDrop: {
    jitterStrengthHigh: 0.1,
  }
}
```

## Usage Examples

### 基本的な雨粒エフェクトの追加

```typescript
import ThreeView, { RainDropEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// アニメーションを有効にする（雨粒が流れるため必須）
view.animation = true;

// デフォルトのフォトリアルレイヤーを追加
plugin.addDefaultPhotorealLayers();

// 雨粒エフェクトレイヤーを追加
const rainDropLayer = view.addLayer<RainDropEffectLayer>({
  type: "effect",
  rainDrop: {
    opacity: 0.85,
    dropGridSize: 14,
    dropDensity: 0.8,
    dropLayers: 3,
    refractionStrength: 0.3,
  },
  visible: true,
});
```

## 備考

このエフェクトは`allowDuplication`が`true`に設定されているため、複数のRainDropEffectLayerインスタンスを作成できます。時間とともにアニメーションする雨粒エフェクトを提供します。アニメーションを有効にするために`view.animation = true`を設定する必要があります。
