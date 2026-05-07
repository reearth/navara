---
title: Effect Descriptor
description: Core effect descriptor types for navara_three
sidebar:
  order: 60
---

Core effect descriptors provided by `@navara/three`. These descriptors are tightly coupled with the internal rendering pipeline (e.g., GBuffer MRT, depth passes), so they are part of `@navara/three` core rather than `@navara/three_default_descs`.

## Available Core EffectDescriptor Types

| Descriptor Type | Description |
|------------|------|
| [SkyEnvMapEffectDesc](./sky-env-map-effect-desc) | A pass that renders the sky environment map |
