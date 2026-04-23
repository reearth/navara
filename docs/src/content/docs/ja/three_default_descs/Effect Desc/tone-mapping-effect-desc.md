---
title: ToneMappingEffectDesc
description: Tone mapping effect descriptor for navara_three
sidebar:
  order: 62
---

`ToneMappingEffectDesc`クラスは、トーンマッピングエフェクトを適用するDescriptorです。HDR(High Dynamic Range)からLDR(Low Dynamic Range)への色調整を行い、画面に表示可能な範囲に変換します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### mode

**Type:** `ToneMappingMode | undefined`

**Description:** トーンマッピングのモードを指定します。利用可能なモードには、AGX、ACES_FILMIC、LINEAR、REINHARD、REINHARD2、UNREALなどがあります。

**Default:** `ToneMappingMode.AGX`

**Example:**

```typescript
{
  toneMapping: {
    mode: ToneMappingMode.ACES_FILMIC,
  }
}
```

## Usage Examples

### デフォルトエフェクトでトーンマッピングを使用

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加（ToneMappingEffectDescを含む）
const defaultLayers = plugin.addDefaultPhotorealScene();

// 露出を設定
view.toneMappingExposure = 10;
```

### 異なるトーンマッピングモードの使用

```typescript
import ThreeView, { ToneMappingEffectDesc, ToneMappingMode } from "@navara/three";

const view = new ThreeView();
await view.init();

// AGXモード（デフォルト、バランスの取れた結果）
view.addEffect<ToneMappingEffectDesc>({
  toneMapping: {
    mode: ToneMappingMode.AGX,
  },
});

// または、ACES Filmicモード（映画的な外観）
view.addEffect<ToneMappingEffectDesc>({
  toneMapping: {
    mode: ToneMappingMode.ACES_FILMIC,
  },
});

// Reinhardモード
view.addEffect<ToneMappingEffectDesc>({
  toneMapping: {
    mode: ToneMappingMode.REINHARD,
  },
});
```

### 露出調整と組み合わせた使用

```typescript
import ThreeView, { ToneMappingMode } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

const defaultLayers = plugin.addDefaultPhotorealScene();

// トーンマッピングを有効化
defaultLayers.toneMapping.update({
  visible: true,
  toneMapping: {
    mode: ToneMappingMode.AGX,
  },
});

// 露出を調整（明るいシーン）
view.toneMappingExposure = 15;

// 露出を調整（暗いシーン）
view.toneMappingExposure = 5;
```

### 個別にトーンマッピングDescriptorを追加

```typescript
import ThreeView, { ToneMappingEffectDesc, SMAAEffectDesc, ToneMappingMode } from "@navara/three";

const view = new ThreeView();
await view.init();

view.toneMappingExposure = 3;

// トーンマッピングエフェクトを追加
view.addEffect<ToneMappingEffectDesc>({
  toneMapping: {
    mode: ToneMappingMode.NEUTRAL,
  },
});

// SMAAエフェクトを追加（トーンマッピングの後に適用）
view.addEffect<SMAAEffectDesc>({
  smaa: {},
});
```

## 備考

適切なトーンマッピングを適用することで、HDRレンダリングの結果を視覚的に魅力的な画像に変換できます。AGXモードはデフォルトで使用され、バランスの取れた結果を提供します。`view.toneMappingExposure`で露出を調整できます。
