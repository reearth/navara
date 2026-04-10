---
title: Effect Layer
description: navara_three のコアエフェクトレイヤータイプ
sidebar:
  order: 60
---

`@navara/three` が提供するコアエフェクトレイヤーです。これらのレイヤーは内部レンダリングパイプライン（GBuffer MRT、デプスパスなど）と密結合しているため、`@navara/three_default_layers` ではなく `@navara/three` コアに含まれています。

## 利用可能なコア EffectLayer タイプ

| レイヤータイプ | 説明 |
|------------|------|
| [SelectiveBloomEffectLayer](./selective-bloom-effect-layer) | セレクティブブルームを適用するエフェクト |
| [SelectiveOutlineEffectLayer](./selective-outline-effect-layer) | セレクティブアウトラインを適用するエフェクト |
| [SkyEnvMapEffectLayer](./sky-env-map-effect-layer) | スカイ環境マップをレンダリングするパス |
