---
title: DepthOfFieldEffectDesc
description: Depth of field effect descriptor for navara_three
sidebar:
  order: 53
---

`DepthOfFieldEffectDesc`クラスは、被写界深度(Depth of Field)エフェクトを適用するDescriptorです。カメラの焦点面に基づいてボケ効果を生成し、写真のような視覚効果を実現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### focusDistance

**Type:** `number | undefined`

**Description:** カメラからフォーカス平面までの距離をワールド単位(メートル)で指定します。この距離にあるオブジェクトはシャープに表示され、それより手前や奥にあるオブジェクトほど徐々にぼけていきます。

**Default:** `1000`

**Example:**

```typescript
{
  depthOfField: {
    focusDistance: 500,
  }
}
```

### focalLength

**Type:** `number | undefined`

**Description:** フォーカス範囲をワールド単位(メートル)で指定します。フォーカス平面周辺でのシャープネスの落ち方を制御します。値が小さいほどフォーカス距離付近の狭い範囲だけがシャープになり、値が大きいほど広い範囲がシャープに保たれます。

**Default:** `1000`

**Example:**

```typescript
{
  depthOfField: {
    focalLength: 300,
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
import ThreeView from "@navaramap/three";
import { DepthOfFieldEffectDesc } from "@navaramap/three_default_descs";

const view = new ThreeView();
await view.init();

// 被写界深度エフェクトを追加
const depthOfFieldDesc = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: { },
  visible: true,
});
```

### 3Dタイルと組み合わせた被写界深度

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { DepthOfFieldEffectDesc } from "@navaramap/three_default_descs";
import { DefaultPlugin } from "@navaramap/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加
const defaultLayers = plugin.addDefaultPhotorealScene();
defaultLayers.sun.update({
  sun: {
    intensity: 1,
    castShadow: true,
  },
});

// 被写界深度エフェクトを追加
const depthOfFieldDesc = view.addEffect<DepthOfFieldEffectDesc>({
  depthOfField: {
    bokehScale: 7,
    focusDistance: 500,
    focalLength: 300,
  },
  visible: true,
});

// 3Dタイルを追加
const buildingsSource = view.addSource({
  type: "3d-tiles",
  url: "https://example.com/tileset.json",
});

view.addLayer({
  type: "3d-tiles",
  source: buildingsSource,
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
