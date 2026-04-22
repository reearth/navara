---
title: SMAAEffectDesc
description: SMAA effect descriptor for navara_three
sidebar:
  order: 58
---

`SMAAEffectDesc`クラスは、SMAA(Subpixel Morphological Anti-Aliasing)アンチエイリアシングエフェクトを適用するレイヤーです。FXAAよりも高品質なアンチエイリアシングを提供します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### quality

**Type:** `"low" | "medium" | "high" | "ultra" | undefined`

**Description:** SMAAの品質プリセットを指定します。

**Default:** `"medium"`

**Example:**

```typescript
{
  smaa: {
    quality: "high",
  }
}
```

### edgeDetectionMode

**Type:** `"color" | "depth" | "luma" | undefined`

**Description:** エッジ検出モードを指定します。

**Default:** `"color"`

**Example:**

```typescript
{
  smaa: {
    edgeDetectionMode: "luma",
  }
}
```

## Usage Examples

### デフォルトエフェクトでSMAAを使用

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルレイヤーを追加（SMAAが含まれる）
const defaultLayers = plugin.addDefaultPhotorealScene();

// SMAAを有効化して品質を設定
defaultLayers.smaa.update({
  visible: true,
  smaa: {
    quality: "high",
    edgeDetectionMode: "color",
  },
});
```

### 高品質SMAAの設定

```typescript
import ThreeView, { SMAAEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// SMAAエフェクトレイヤーを追加
view.addEffect<SMAAEffectDesc>({
  smaa: {
    quality: "ultra",
    edgeDetectionMode: "luma",
  },
});
```

### SMAAの品質とエッジ検出モードの動的変更

```typescript
import ThreeView, { FXAAEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// 品質をmediumに変更
defaultLayers.smaa.update({
  smaa: {
    quality: "medium",
  },
});

// エッジ検出モードをdepthに変更
defaultLayers.smaa.update({
  smaa: {
    edgeDetectionMode: "depth",
  },
});

// SMAAを無効にしてFXAAに切り替える
defaultLayers.smaa.update({ visible: false });
view.addEffect<FXAAEffectDesc>({
  fxaa: {},
});
```

## 備考

SMAAEffectDescはレンダリングパイプラインの最後の段階で適用されます。FXAAよりも高品質なアンチエイリアシングが必要な場合に使用します。品質プリセットは`low`、`medium`、`high`、`ultra`から選択できます。エッジ検出モードは`color`（最高品質）、`luma`（バランス）、`depth`（最速）から選択できます。
