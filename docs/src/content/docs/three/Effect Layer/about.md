---
title: Effect Descriptor
description: Core effect descriptor types for navara_three
sidebar:
  order: 60
---

Core effect descriptors provided by `@navara/three`. These layers are tightly coupled with the internal rendering pipeline (e.g., GBuffer MRT, depth passes), so they are part of `@navara/three` core rather than `@navara/three_default_layers`.

## Available Core EffectDescriptor Types

| Descriptor Type | Description |
|------------|------|
| [SelectiveBloomEffectLayer](./selective-bloom-effect-layer) | An effect that applies selective bloom |
| [SelectiveOutlineEffectLayer](./selective-outline-effect-layer) | An effect that applies selective outlines |
| [SkyEnvMapEffectLayer](./sky-env-map-effect-layer) | A pass that renders the sky environment map |
