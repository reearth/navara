---
title: LensFlareEffectDesc
description: Lens flare effect descriptor for navara_three
sidebar:
  order: 56
---

`LensFlareEffectDesc`クラスは、レンズフレアエフェクトを生成するDescriptorです。太陽や月からの光がカメラレンズで反射する効果を表現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

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
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加（LensFlareEffectDescを含む）
const defaultLayers = plugin.addDefaultPhotorealScene();

// レンズフレアを有効にして強度を設定
defaultLayers.lensFlare.update({
  visible: true,
  lensFlare: {
    intensity: 0.005,
  },
});
```
