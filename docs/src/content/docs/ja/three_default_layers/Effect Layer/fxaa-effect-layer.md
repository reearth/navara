---
title: FXAAEffectLayer
description: FXAA effect layer for navara_three
sidebar:
  order: 54
---

`FXAAEffectLayer`クラスは、FXAA(Fast Approximate Anti-Aliasing)アンチエイリアシングエフェクトを適用するレイヤーです。画像のジャギーを軽減し、滑らかな外観を実現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

**Example:**
```typescript
{ visible: true }
```

## Usage Examples

### FXAAアンチエイリアシングの有効化

```typescript
import ThreeView, { FXAAEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// FXAAエフェクトレイヤーを追加
view.addEffect<FXAAEffectLayer>({
  fxaa: {},
});
```

## 備考

FXAAEffectLayerは特別な設定パラメータを持ちません。レンダリングパイプラインの最後の段階で適用されます。SMAAよりも軽量ですが、品質は若干劣ります。パフォーマンスを重視する場合に適しています。
