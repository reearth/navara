# Overview

Replaced the mask-based Selective Effect pipeline with an MRT-integrated single-pass approach. Previously, target meshes were re-rendered into mask RTs with at least 2 fixed passes (Occlusion + Mask). Now effectIds and emissive are written directly into the main GBuffer, eliminating mask passes entirely. Occlusion is deferred to a separate PR.

## What I've done

- Expanded GBuffer to 4 MRT attachments (color, normal, effectIds bitmask, emissive)
- Added `#ifdef USE_SELECTIVE_EFFECT` compile-time branching for SelectiveEffect output control
- Implemented bitmask encoding for effectIds (up to 11 slots via HalfFloat)
- Added shared `selective_effect_mask.glsl` chunk for Bloom/Outline extract shaders
- Made each mesh compute its own effectIdsMask autonomously (no scene traversal)
- Added SelectiveEffect support for all mesh/feature types: Polygon, Model, Point/Billboard, Polyline, Arcline, Box/Sphere/Cylinder/Plane/Tube/InstancedBox
- Standard Material (Polygon/Model) uses Three.js native `material.emissive`; ShaderMaterial (Polyline/InstancedSprite/Arcline) uses custom `uEmissiveColor * uEmissiveIntensity`
- Removed old pipeline (MaskController, MaskContext, effectObjectCache, userData.selectiveEffectConfig, etc.)
- Added BufferView-based MRT debug visualization
- Fixed `resolutionScale` being ignored on resize in Bloom/Outline passes

## What I haven't done

- Silhouette occlusion (will be reimplemented as separate extension with own RT + depth-OFF pass)
- Draped meshes (clampToGround / texture baking) do not support SelectiveEffect due to non-MRT rendering path

## How I tested

- Visual verification of Bloom + Outline on all supported mesh/feature types via selective-bloom-effect / selective-outline-effect examples
- Real-time parameter changes via Tweakpane in debug/selective-effect
- MRT buffer inspection via BufferView (EffectIds bitmask, Emissive RGB)
- `cargo make build-example` / `cargo make format` / `cargo make lint` / `cargo make test`

## Which point I want you to review particularly

- GBuffer 4-attachment design: performance impact of non-SE meshes writing `vec4(0.0)` to attachment 2/3
- Two emissive output paths: Standard Material uses Three.js native `emissive` (pre-multiplied), ShaderMaterial uses custom `uEmissiveColor * uEmissiveIntensity`. Output is identical but may diverge with emissiveMap/toneMapping.

## Screenshots

<img width="1200" height="750" alt="selective-bloom-effect-arcline" src="https://github.com/user-attachments/assets/e0f97fe7-760a-4f85-96ff-1d6a2af6fa95" />
<img width="1200" height="750" alt="selective-outline-effect-arcline" src="https://github.com/user-attachments/assets/a3f121bc-401a-44db-8daa-a9a58f0f1f58" />

## Checklist

- [x] Wrote a clear PR description so reviewers can quickly understand the overview of the changes.
- [x] Confirmed that the proposed code does not include anything with an unknown or incompatible license.
- [ ] Added tests for the changes.
- [ ] Updated the [API documentation](https://github.com/eukarya-inc/navara/blob/main/guide/HOW_TO_WRITE_DOCUMENT.md).
- [ ] Linked related issues.
