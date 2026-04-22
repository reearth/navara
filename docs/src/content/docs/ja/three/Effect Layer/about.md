---
title: Effect Descriptor
description: navara_three のコアエフェクトタイプ
sidebar:
  order: 60
---

`@navara/three` が提供するコアエフェクトです。これらのオブジェクトは内部レンダリングパイプライン（GBuffer MRT、デプスパスなど）と密結合しているため、`@navara/three_default_layers` ではなく `@navara/three` コアに含まれています。

## 利用可能なコア EffectDesc タイプ

| Descriptor タイプ                                              | 説明                                         |
| -------------------------------------------------------------- | -------------------------------------------- |
| [SelectiveBloomEffectDesc](./selective-bloom-effect-layer)     | セレクティブブルームを適用するエフェクト     |
| [SelectiveOutlineEffectDesc](./selective-outline-effect-layer) | セレクティブアウトラインを適用するエフェクト |
| [SkyEnvMapEffectDesc](./sky-env-map-effect-layer)              | スカイ環境マップをレンダリングするパス       |
