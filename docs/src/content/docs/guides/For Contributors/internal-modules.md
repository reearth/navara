---
title: Internal Modules
description: Details on internal WASM modules, Rust crates, and the ECS system used in Navara.
sidebar:
  order: 8
---

## Module Organization

Navara's Rust codebase consists of over 40 crates organized into functional groups. Each crate is structured as a [Bevy ECS](https://bevyengine.org/) Plugin, registering its own systems, components, and resources into the shared ECS world. This design makes the engine modular and composable. For example, `navara_wasm_api` uses only 6 core crates, while `navara_wasm` integrates all of them. This section provides an overview of the major module categories.

## Core Systems

The foundation of the engine is built on a small set of core crates that nearly every other module depends on.

`navara_core` provides fundamental GIS mathematical utilities, AABB calculations, and ellipsoid math. `navara_math` handles vector and matrix operations, geometric calculations, and other core mathematical types. Together, these two crates form the mathematical foundation for all geospatial processing.

`navara_ecs` is the central coordinator, wrapping the Bevy ECS framework to orchestrate the main engine loop. It manages system execution order, component registration, and frame-by-frame state updates including input processing, tile state transitions, and draw command generation.

`navara_quadtree` provides hierarchical spatial indexing for level-of-detail management. It powers tile management, spatial queries, and culling operations throughout the engine.

## Data Handling and Format Support

Navara supports multiple geospatial data formats, each handled by a dedicated crate.

`navara_layer` manages the layer hierarchy and data source abstraction, providing a unified interface regardless of the underlying format. `navara_tile` handles the core tiling system for raster and vector data, including tile request scheduling, caching, and LOD management.

Format-specific crates handle parsing: `navara_mvt` for Mapbox Vector Tiles, `navara_geojson` for GeoJSON feature collections, `navara_cesium3dtiles` for 3D Tiles tilesets, `navara_b3dm` for batched 3D models, and `navara_glb` for GLB/GLTF models. `navara_parser` provides a unified parsing interface that coordinates these format-specific parsers.

## Feature Rendering

`navara_feature` handles high-level feature rendering strategies including billboards, 3D models, points, polygons, polylines, and text. It defines how geospatial features are translated into renderable geometry. `navara_feature_component` provides the ECS component definitions for each feature type.

`navara_material` manages the material system — material definitions, shader parameters, and texture management. `navara_geometry` handles geometric processing such as mesh generation and spatial calculations, while `martini` provides high-performance terrain mesh generation using the RTIN algorithm.

## WASM Modules and Build Pipeline

The Rust crates are compiled into three separate WASM modules, each targeting a different use case.

**`navara_wasm`** compiles to `web/wasm/navara_engine/` and includes the full 3D engine with all 40+ crates. It provides the complete engine API — camera, layers, features, tiles, and the ECS system integration. This is the module that `@navara/three` communicates with.

**`navara_wasm_worker`** compiles to `web/wasm/navara_engine_worker/` and includes processing-focused crates. It runs in Web Workers for CPU-intensive background tasks such as terrain mesh construction and polygon/polyline batch processing.

**`navara_wasm_api`** compiles to `web/wasm/navara_engine_api/` and includes only 6 core crates (`navara_core`, `navara_math`, `navara_camera`, and a few others). It provides lightweight, stateless utility functions for coordinate transformations and mathematical operations. This is the module that `@navara/three_api` communicates with.

The build pipeline, orchestrated by cargo-make, follows a strict sequence: first compiling the Rust crates to WASM, then generating TypeScript bindings via wasm-bindgen, installing web dependencies, building the TypeScript packages, and finally preparing examples and assets.

## WASM API Design Policy

Navara enforces a strict policy that WASM-generated classes are never exposed directly in public TypeScript APIs. Classes produced by `wasm-bindgen` have manual memory management requirements — if Rust frees memory, any JavaScript references become invalid, leading to use-after-free errors or memory leaks.

Instead, public functions in `@navara/three` and `@navara/three_api` accept plain JavaScript objects or Three.js types as input, create WASM objects internally, perform the operation, convert results back to plain JavaScript/Three.js types, and free the WASM objects. This wrapper pattern ensures that consumers never need to manage WASM memory manually.

The `NormalizeWASMClass<T>` utility type (from `@navara/core`) is used to derive TypeScript types from WASM class definitions by stripping `free()` methods and converting getter/setter pairs into plain properties.

## Support Systems

Several crates provide infrastructure that the rest of the engine depends on.

`navara_camera` implements the 3D camera system with input handling, projection matrices, and frustum calculations. `navara_input` processes mouse, keyboard, and touch input. `navara_event` and `navara_event_store` provide the event bus for inter-system communication. `navara_data_requester` manages HTTP requests, data caching, and request queuing for tile and data loading.

`navara_buffer_store` handles memory pool management and buffer allocation for efficient resource tracking. `navara_window` manages viewport dimensions and screen coordinate calculations. `navara_occluder` provides occlusion culling for rendering performance, and `navara_fog` implements distance-based atmospheric fog effects.
