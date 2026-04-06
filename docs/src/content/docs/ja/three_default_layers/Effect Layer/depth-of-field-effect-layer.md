---
title: DepthOfFieldEffectLayer
description: Depth of field effect layer for navara_three
sidebar:
  order: 53
---

`DepthOfFieldEffectLayer`クラスは、被写界深度(Depth of Field)エフェクトを適用するレイヤーです。カメラの焦点面に基づいてボケ効果を生成し、写真のような視覚効果を実現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### focusDistance

**Type:** `number | undefined`

**Description:** フォーカス平面の正規化された距離を指定します。範囲は[0.0, 1.0]です。

**Default:** `0.000006`

**Example:**

```typescript
{
  depthOfField: {
    focusDistance: 0.5,
  }
}
```

### focalLength

**Type:** `number | undefined`

**Description:** 仮想レンズの焦点距離を制御します。フォーカス平面周辺でのシャープネスの落ち方を制御します。範囲は[0.0, 1.0]です。

**Default:** `0.000013`

**Example:**

```typescript
{
  depthOfField: {
    focalLength: 0.00001,
  }
}
```

### bokehScale

**Type:** `number | undefined`

**Description:** ボケハイライトの見かけのサイズをスケールする、ぼかしカーネルに適用される乗数です。

**Default:** `7`

**Example:**

```typescript
{
  depthOfField: {
    bokehScale: 10,
  }
}
```

## Usage Examples

### 基本的な被写界深度エフェクトの追加

```typescript
import ThreeView, { DepthOfFieldEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// 被写界深度エフェクトレイヤーを追加
const depthOfFieldLayer = view.addLayer<DepthOfFieldEffectLayer>({
  type: "effect",
  depthOfField: { },
  visible: true,
});
```

### 3Dタイルと組み合わせた被写界深度

```typescript
import ThreeView, { DepthOfFieldEffectLayer, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルレイヤーを追加
const defaultLayers = plugin.addDefaultPhotorealLayers();
defaultLayers.sun.update({
  sun: {
    intensity: 1,
    castShadow: true,
  },
});

// 被写界深度エフェクトを追加
const depthOfFieldLayer = view.addLayer<DepthOfFieldEffectLayer>({
  type: "effect",
  depthOfField: {
    bokehScale: 7,
    focusDistance: 0.000006,
    focalLength: 0.000013,
  },
  visible: true,
});

// 3Dタイルレイヤーを追加
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 0.1,
    roughness: 0.1,
    castShadow: true,
    receiveShadow: true,
  },
});
```
