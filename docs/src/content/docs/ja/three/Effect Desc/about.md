---
title: Effect Descriptor
description: navara_three のコアエフェクトタイプ
sidebar:
  order: 1050
---

`@navaramap/three` が提供するコアエフェクトです。これらのオブジェクトは内部レンダリングパイプライン（GBuffer MRT、デプスパスなど）と密結合しているため、`@navaramap/three-default-descs` ではなく `@navaramap/three` コアに含まれています。

:::note
エフェクト Descriptor は 2 つのパッケージに分かれています。このページには `@navaramap/three` コアに含まれる一部のみを掲載しています。大半のエフェクト（bloom・SSAO・トーンマッピング・FXAA など）は `@navaramap/three-default-descs` が提供します。[Effect Descriptor（three_default_descs）](../../../three_default_descs/effect-desc/about/) を参照してください。
:::

## 利用可能なコア EffectDesc タイプ

| Descriptor タイプ                                | 説明                                   |
| ------------------------------------------------ | -------------------------------------- |
| [SkyEnvMapEffectDesc](./sky-env-map-effect-desc) | スカイ環境マップをレンダリングするパス |
