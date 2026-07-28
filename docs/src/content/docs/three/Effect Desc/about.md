---
title: Effect Descriptor
description: Core effect descriptor types for navara_three
sidebar:
  order: 1050
---

Core effect descriptors provided by `@navaramap/three`. These descriptors are tightly coupled with the internal rendering pipeline (e.g., GBuffer MRT, depth passes), so they are part of `@navaramap/three` core rather than `@navaramap/three-default-descs`.

:::note
Effect descriptors are split across two packages. This page lists only the few that live in `@navaramap/three` core. Most effects (bloom, SSAO, tone mapping, FXAA, …) are provided by `@navaramap/three-default-descs` — see [Effect Descriptor (three_default_descs)](../../../three_default_descs/effect-desc/about/).
:::

## Available Core EffectDescriptor Types

| Descriptor Type | Description |
|------------|------|
| [SkyEnvMapEffectDesc](./sky-env-map-effect-desc) | A pass that renders the sky environment map |
