---
title: FXAAEffectDesc
description: FXAA effect descriptor for navara_three
sidebar:
  order: 54
---

`FXAAEffectDesc`クラスは、FXAA(Fast Approximate Anti-Aliasing)アンチエイリアシングエフェクトを適用するDescriptorです。画像のジャギーを軽減し、滑らかな外観を実現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

**Example:**
```typescript
{ visible: true }
```

## Usage Examples

### FXAAアンチエイリアシングの有効化

```typescript
import ThreeView, { FXAAEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// FXAAエフェクトを追加
view.addEffect<FXAAEffectDesc>({
  fxaa: {},
});
```

## 備考

FXAAEffectDescは特別な設定パラメータを持ちません。レンダリングパイプラインの最後の段階で適用されます。SMAAよりも軽量ですが、品質は若干劣ります。パフォーマンスを重視する場合に適しています。
