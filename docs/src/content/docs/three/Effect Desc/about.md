---
title: Effect Descriptor
description: Core effect descriptor types for navara_three
sidebar:
  order: 700
---

Core effect descriptors provided by `@navara/three`. These descriptors are tightly coupled with the internal rendering pipeline (e.g., GBuffer MRT, depth passes), so they are part of `@navara/three` core rather than `@navara/three_default_descs`.

:::note
Effect descriptors are split across two packages. This page lists only the few that live in `@navara/three` core. Most effects (bloom, SSAO, tone mapping, FXAA, …) are provided by `@navara/three_default_descs` — see [Effect Descriptor (three_default_descs)](../../../three_default_descs/effect-desc/about/).
:::

## Available Core EffectDescriptor Types

| Descriptor Type | Description |
|------------|------|
| [SkyEnvMapEffectDesc](./sky-env-map-effect-desc) | A pass that renders the sky environment map |
