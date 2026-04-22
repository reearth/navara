---
title: Effect Descriptor
description: navara_three のコアエフェクトレイヤータイプ
sidebar:
  order: 60
---

`@navara/three` が提供するコアエフェクトレイヤーです。これらのレイヤーは内部レンダリングパイプライン（GBuffer MRT、デプスパスなど）と密結合しているため、`@navara/three_default_layers` ではなく `@navara/three` コアに含まれています。

## 利用可能なコア EffectDesc タイプ

| レイヤータイプ | 説明 |
|------------|------|
| [SelectiveBloomEffectDesc](./selective-bloom-effect-layer) | セレクティブブルームを適用するエフェクト |
| [SelectiveOutlineEffectDesc](./selective-outline-effect-layer) | セレクティブアウトラインを適用するエフェクト |
| [SkyEnvMapEffectDesc](./sky-env-map-effect-layer) | スカイ環境マップをレンダリングするパス |
