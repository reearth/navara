---
title: What is navara?
description: A guide in my new Starlight docs site.
sidebar:
  order: 1
---

## What is navara?

- Navara is a map engine designed as next-generation WebGIS foundational technology, built around a headless architecture and Rust/WASM, combining performance, extensibility, and diverse expressiveness.

## Key Features

### Map Rendering and Visualization

- Supports formats such as MVT, GeoJSON, 3D Tiles, and Raster
- Capable of layer compositing, viewport control, and LOD rendering
- Supports advanced material and effect customization

### 3D Spatial Representation and Animation

- 3D rendering and dynamic effects
- Drawing of terrain, buildings, and objects
- Support for flight, movement, and animated display

### GIS Spatial Processing

- Coordinate transformation (geographic coordinate system to Cartesian coordinate system)
- Spatial indexing (quadtree), frustum and horizon culling
- High-speed tile data management and layer control

## Architecture

- Overview of the architecture. See Ecosystem for details.

- Application Layer

  - Integrates with drawing libraries such as Three.js and Babylon.js (e.g., navara_three)

- WASM Binding Layer

  - Communicates with the Rust GIS engine via WASM (navara_wasm)

- Rust GIS Engine

  - State management and GIS processing via Bevy ECS (coordinate transformation, LOD, tile management)

- Rendering Engine
  - Issues draw commands to the GPU through Three.js, etc.

## Use Cases

- To be added (none yet)
