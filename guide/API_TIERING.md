# API Tiering Strategy

This document defines Navara's approach to API surface design, balancing stability for general users with flexibility for advanced use cases.

## Problem Statement

Navara sits between two extremes in the map engine landscape:

- **MapLibre GL JS** - Renderer is fully internal. `CustomLayerInterface` only exposes the raw WebGL context. Simple but restrictive.
- **CesiumJS** - Scene, Renderer, and Framebuffer are widely exposed. Flexible but creates a large API surface that is difficult to evolve without breaking changes.

Navara needs to provide a stable, approachable API for typical map applications while allowing plugin developers to access rendering internals when necessary. Exposing too much too early locks us into implementation details that become impossible to change.

## Design Principle: Tiered API Access

Navara organizes its public API into three tiers with different stability guarantees:

```
┌──────────────────────────────────────────────────┐
│  Tier 0: ThreeView (Stable Public API)           │  General users
│  Camera, layers, fonts, events                   │
├──────────────────────────────────────────────────┤
│  Tier 1: Plugin + ViewContext (Plugin API)        │  Plugin developers
│  Scenes, pass management, renderer reference      │
├──────────────────────────────────────────────────┤
│  Tier 2: Advanced (Opt-in, Unstable)              │  Power users
│  Renderer injection, custom render loops          │
│  Explicitly marked as unstable                    │
└──────────────────────────────────────────────────┘
```

### Tier 0: ThreeView

`ThreeView` is the primary entry point for all users. It provides high-level APIs for map interaction:

- Camera positioning (`setCamera`)
- Layer management (`addLayer`, `updateLayerById`, `deleteLayerById`)
- Plugin registration (`addPlugin`)
- Font management (`addFontFamily`, `removeFontFamily`)
- Lifecycle (`init`, `dispose`, `forceUpdate`)

**Stability guarantee**: Breaking changes require a major version bump. This tier should remain small and well-defined. Rendering details must never leak into this surface.

### Tier 1: Plugin + ViewContext

Plugins receive a `ThreeView` reference and a `ViewContext` via `init(view, ctx)`, where `ctx` is the `ViewContext` provided to plugins. Layer declarations also receive a `ViewContext` instance, which provides controlled access to rendering internals:

- **Scenes** - Access to render groups (mrt, globe, draped, opaque, transparent, etc.)
- **Camera** - The Three.js `PerspectiveCamera`
- **Pass management** - `addPass`, `insertPassBefore`, `insertPassAfter`, `removePass`
- **Renderer reference** - `getRenderer()` returns the `WebGLRenderer` (read-only access)
- **Input buffer** - `getInputBuffer()` for post-processing chains
- **Shadow integration** - `applyShadowMaterial`, `removeShadowMaterial`

**Stability guarantee**: Changes follow the plugin contract. We aim for stability but may introduce breaking changes in minor versions with migration guidance. Plugin authors should expect occasional updates.

**Key constraint**: `ViewContext` is only accessible through the plugin/layer system, not from `ThreeView` directly. This is intentional - it forces the separation between map operation and rendering customization.

### Tier 2: Advanced (Future)

For use cases that require deeper integration, such as:

- Injecting an externally-created `WebGLRenderer` (e.g., embedding Navara in an existing Three.js application)
- Overriding the render loop
- Replacing the effect composer pipeline

These APIs should be:

- Explicitly marked as unstable (e.g., `unstable_` prefix or a separate import path)
- Documented with clear warnings about forward-compatibility
- Only introduced when concrete use cases justify them

**Stability guarantee**: None. These APIs may change or be removed in any release.

## Decision Framework

When deciding where a new API belongs, ask:

| Question | If yes | If no |
|----------|--------|-------|
| Does a general map application need this? | Tier 0 | Continue |
| Does a plugin/custom descriptor need this? | Tier 1 (ViewContext) | Continue |
| Is there a proven, concrete use case? | Tier 2 (unstable) | Do not add yet |

### Rules

1. **Never expose rendering details in Tier 0.** Once a renderer method appears on `ThreeView`, it cannot be removed without a major version bump.
2. **ViewContext is the boundary.** All rendering access flows through `ViewContext`, which is only available inside plugins and layers.
3. **Demand concrete use cases for Tier 2.** "Someone might want this" is not sufficient justification. Wait for real requests with specific scenarios.
4. **Prefer methods over direct property access.** `getRenderer()` is better than a public `renderer` property because it allows future indirection (e.g., returning a proxy, swapping implementations).

## Addressing "Give Me the Renderer" Requests

When users request direct renderer access, identify the underlying need:

| Underlying need | Solution |
|-----------------|----------|
| Embed Navara in an existing Three.js app | Add `renderer` option to `ThreeViewOptions` (Tier 0, low risk) |
| Custom post-processing effects | Use `ViewContext` pass management - already supported in Tier 1 |
| Read pixels / capture screenshots | Add a dedicated method to `ThreeView` (Tier 0) |
| Fully replace the rendering pipeline | Tier 2 - only when demand is validated |

The most common request ("I want to pass my own renderer") is typically about **embedding**, not about controlling the rendering pipeline. This can be solved with a constructor option without exposing any rendering internals.

## Raw Access Policy

Navara wraps rendering engine objects (e.g., Three.js `PerspectiveCamera`) in its own types (e.g., `ThreeViewCamera`). These wrappers expose a `raw` property for direct access to the underlying object.

**Policy**: `raw` access is allowed but unstable. Navara does not restrict it at the API level — Three.js interoperability makes this impractical. Instead, the contract is documented:

- **Navara-managed state wins.** Properties controlled by the ECS (position, orientation, projection) are overwritten each frame. Direct mutations via `raw` have no lasting effect.
- **No stability guarantee.** Code using `raw` is coupled to Three.js, not to Navara. If the underlying engine changes, the consumer is responsible for updating their code.
- **Prefer Navara APIs when available.** `camera.positionECEF` over `camera.raw.position`, `camera.far` over `camera.raw.far`, etc.

`raw` is an escape hatch for cases where no Navara abstraction exists (e.g., passing a `PerspectiveCamera` to a Three.js utility). It is not a substitute for Tier 0/1 APIs.
