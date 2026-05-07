---
title: Effect Descriptor
description: navara_three のコアエフェクトタイプ
sidebar:
  order: 60
---

`@navara/three` が提供するコアエフェクトです。これらのオブジェクトは内部レンダリングパイプライン（GBuffer MRT、デプスパスなど）と密結合しているため、`@navara/three_default_descs` ではなく `@navara/three` コアに含まれています。

## 利用可能なコア EffectDesc タイプ

| Descriptor タイプ                                              | 説明                                         |
| -------------------------------------------------------------- | -------------------------------------------- |
| [SelectiveBloomEffectDesc](./selective-bloom-effect-desc)     | セレクティブブルームを適用するエフェクト     |
| [SelectiveOutlineEffectDesc](./selective-outline-effect-desc) | セレクティブアウトラインを適用するエフェクト |
| [SkyEnvMapEffectDesc](./sky-env-map-effect-desc)              | スカイ環境マップをレンダリングするパス       |
