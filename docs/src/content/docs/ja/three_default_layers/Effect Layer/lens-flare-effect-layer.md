---
title: LensFlareEffectLayer
description: Lens flare effect layer for navara_three
sidebar:
  order: 56
---

`LensFlareEffectLayer`クラスは、レンズフレアエフェクトを生成するレイヤーです。太陽や月からの光がカメラレンズで反射する効果を表現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### intensity

**Type:** `number | undefined`

**Description:** レンズフレアエフェクトの強度を指定します。

**Default:** `0.005`

**Example:**

```typescript
{
  lensFlare: {
    intensity: 1.5,
  }
}
```

## Usage Examples

### デフォルトエフェクトでレンズフレアを有効化

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView();
await view.init();

// デフォルトのエフェクトレイヤーを追加（LensFlareEffectLayerを含む）
const defaultEffects = view.addDefaultEffectLayers();

// レンズフレアを有効にして強度を設定
defaultEffects.lensFlare.update({
  visible: true,
  lensFlare: {
    intensity: 0.005,
  },
});
```
