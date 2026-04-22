---
title: Effect Descriptor
description: Effect descriptor types for navara_three
sidebar:
  order: 50
---

`EffectLayer`は、レンダリングパイプラインにポストプロセッシングエフェクトを適用するためのレイヤータイプです。アンチエイリアシング、被写界深度、トーンマッピングなど、様々なビジュアルエフェクトを追加できます。

## 利用可能なEffectLayerタイプ

navara_threeでは、以下のEffectLayerタイプが利用可能です:

| レイヤータイプ | 説明 |
|------------|------|
| [AerialPerspectiveEffectLayer](./aerial-perspective-effect-layer) | 大気による光の散乱と透過を表現するエフェクト |
| [CloudsEffectLayer](./clouds-effect-layer) | リアルタイムボリュメトリック雲をレンダリングするエフェクト |
| [ColorGradingLUTEffectLayer](./color-grading-lut-effect-layer) | LUTを使用したカラーグレーディングを適用するエフェクト |
| [DepthOfFieldEffectLayer](./depth-of-field-effect-layer) | カメラの焦点面に基づいてボケ効果を適用するエフェクト |
| [FogLightEffectLayer](./fog-light-effect-layer) | ポイントライトからのボリュメトリックフォグを生成するエフェクト |
| [FXAAEffectLayer](./fxaa-effect-layer) | FXAA(Fast Approximate Anti-Aliasing)を適用するエフェクト |
| [LensFlareEffectLayer](./lens-flare-effect-layer) | 太陽や月からのレンズフレアを生成するエフェクト |
| [RainDropEffectLayer](./rain-drop-effect-layer) | 画面に雨粒の屈折効果を適用するエフェクト |
| [SMAAEffectLayer](./smaa-effect-layer) | SMAA(Subpixel Morphological Anti-Aliasing)を適用するエフェクト |
| [SSAOEffectLayer](./ssao-effect-layer) | スクリーンスペースアンビエントオクルージョンを適用するエフェクト |
| [SSREffectLayer](./ssr-effect-layer) | リアルタイムスクリーンスペース反射を生成するエフェクト |
| [ToneMappingEffectLayer](./tone-mapping-effect-layer) | HDRからLDRへの色調整を行うエフェクト |

## 基本的な使い方

EffectLayerは、レイヤークラスを登録した後、`view.addEffect()`メソッドで追加します:

```typescript
import ThreeView from "@navara/three";
import { AerialPerspectiveEffectLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// レイヤークラスを登録
view.registerEffect("aerialPerspective", AerialPerspectiveEffectLayer);

await view.init();

const aerialPerspectiveLayer = view.addEffect<AerialPerspectiveEffectLayer>({
  aerialPerspective: {},
});
```

## 共通プロパティ

すべてのEffectLayerは、以下の基本設定を持ちます:

- `id`: レイヤーの一意な識別子
- `visible`: レイヤーの表示/非表示を切り替え

詳細な使用方法は、各レイヤータイプのドキュメントを参照してください。
