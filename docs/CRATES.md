# Rust Crates Reference

This document provides detailed documentation for all 40+ Rust crates in the Navara workspace.

## Core Systems (7 crates)

### **`navara_core`**
- **Purpose**: Fundamental GIS mathematical utilities, AABB, ellipsoid calculations
- **Key Features**: Coordinate systems, ellipsoid math, bounding box operations
- **Used by**: All other crates as foundation

### **`navara_ecs`** 
- **Purpose**: Bevy ECS wrapper and application orchestration (central coordinator)
- **Key Features**: Main engine loop, system coordination, component management
- **Used by**: `navara_wasm` as the primary engine coordinator

### **`navara_math`**
- **Purpose**: Core mathematical operations and types
- **Key Features**: Vector math, matrix operations, geometric calculations
- **Used by**: All crates requiring mathematical operations

### **`navara_quadtree`**
- **Purpose**: Spatial data structures for Level-of-Detail management
- **Key Features**: Hierarchical spatial indexing, LOD calculations, tree traversal
- **Used by**: Tile management, spatial queries, culling systems

### **`navara_component`**
- **Purpose**: Common component definitions and ordering
- **Key Features**: Shared ECS components, component traits, ordering systems
- **Used by**: All ECS-based crates

### **`navara_frame`**
- **Purpose**: Frame management utilities
- **Key Features**: Frame timing, synchronization, lifecycle management
- **Used by**: Main engine loop and rendering systems

### **`navara_buffer_store`**
- **Purpose**: Buffer management and storage
- **Key Features**: Memory pool management, buffer allocation, resource tracking
- **Used by**: Rendering and geometry processing systems

## Rendering & Visualization (4 crates)

### **`navara_camera`**
- **Purpose**: 3D camera system with input handling
- **Key Features**: Camera controls, projection matrices, frustum calculations
- **Used by**: Main engine, input systems, culling operations

### **`navara_fog`**
- **Purpose**: Atmospheric fog effects
- **Key Features**: Distance-based fog, atmospheric scattering simulation
- **Used by**: Rendering pipeline for atmospheric effects

### **`navara_material`**
- **Purpose**: Material system for rendering
- **Key Features**: Material definitions, shader parameters, texture management
- **Used by**: Feature rendering and visualization systems

### **`navara_occluder`**
- **Purpose**: Occlusion culling for performance optimization
- **Key Features**: Visibility determination, frustum culling, occlusion queries
- **Used by**: Rendering pipeline for performance optimization

## Feature Rendering (2 crates)

### **`navara_feature`**
- **Purpose**: High-level feature rendering (billboards, models, points, polygons, text)
- **Key Features**: Feature type definitions, rendering strategies, batch processing
- **Used by**: Layer management for rendering geospatial features

### **`navara_feature_component`**
- **Purpose**: ECS components for different feature types
- **Key Features**: Component definitions for points, lines, polygons, models, text
- **Used by**: `navara_feature` and ECS systems

## Data Handling & Formats (7 crates)

### **`navara_layer`**
- **Purpose**: Layer management system with multi-format support
- **Key Features**: Layer hierarchies, data source management, format abstraction
- **Used by**: Main engine for organizing and managing data layers

### **`navara_tile`**
- **Purpose**: Core tiling system for raster/vector data
- **Key Features**: Tile hierarchies, tile requests, caching, LOD management
- **Used by**: Layer management for tiled data sources

### **`navara_tile_component`**
- **Purpose**: ECS components for tile system
- **Key Features**: Tile-specific components, tile state management
- **Used by**: `navara_tile` and ECS systems

### **`navara_cesium3dtiles`**
- **Purpose**: Cesium 3D Tiles format support (buildings, models)
- **Key Features**: 3D Tiles parsing, tileset management, 3D model loading
- **Used by**: Layer management for 3D building/model data

### **`navara_mvt`**
- **Purpose**: Mapbox Vector Tiles support
- **Key Features**: MVT parsing, vector feature extraction
- **Used by**: Vector tile layers

### **`navara_mvt_parser`**
- **Purpose**: Low-level MVT parsing utilities
- **Key Features**: Protobuf parsing, geometry decoding
- **Used by**: `navara_mvt` for MVT data processing

### **`navara_geojson`**
- **Purpose**: GeoJSON format support
- **Key Features**: GeoJSON parsing, feature collection handling
- **Used by**: Layer management for GeoJSON data sources

### **`navara_parser`**
- **Purpose**: Unified parsing interface for all formats
- **Key Features**: Format detection, parser coordination, data normalization
- **Used by**: Data loading systems across all formats

## Geometry Processing (2 crates)

### **`navara_geometry`**
- **Purpose**: Geometric processing and mesh generation
- **Key Features**: Mesh creation, geometry operations, spatial calculations
- **Used by**: Feature rendering, terrain processing

### **`martini`**
- **Purpose**: High-performance terrain mesh generation (RTIN algorithm)
- **Key Features**: Terrain triangulation, height field processing, LOD meshes
- **Used by**: Terrain rendering systems

## WebAssembly Modules (6 crates)

### **`navara_wasm`**
- **Purpose**: Main WASM engine interface (full functionality)
- **Key Features**: Complete 3D engine, all 40+ crates integration
- **Exports**: Full engine API to TypeScript

### **`navara_wasm_worker`**
- **Purpose**: Web Worker WASM for background processing
- **Key Features**: CPU-intensive operations, terrain mesh generation
- **Exports**: Background processing API

### **`navara_wasm_api`**
- **Purpose**: Lightweight API bindings for utilities
- **Key Features**: Math operations, coordinate transforms (6 crates only)
- **Exports**: Utility functions API

### **`navara_wasm_types`**
- **Purpose**: Shared type definitions across WASM boundary
- **Key Features**: Type serialization, JavaScript-Rust type mapping
- **Used by**: All WASM modules for consistent type definitions

### **`navara_wasm_utils`**
- **Purpose**: WASM utility functions
- **Key Features**: Memory management, error handling, logging
- **Used by**: All WASM modules

### **`navara_wasm_transferable`**
- **Purpose**: Efficient data transfer utilities
- **Key Features**: Zero-copy transfers, buffer management
- **Used by**: WASM modules for performance-critical data exchange

## Background Processing (1 crate)

### **`navara_worker`**
- **Purpose**: Background task coordination and CPU-intensive operations
- **Key Features**: Task queuing, thread management, work distribution
- **Used by**: Main engine for offloading heavy computations

## Support & Utilities (11 crates)

### **Input/Events (4 crates)**

#### **`navara_input`**
- **Purpose**: Input handling and event processing
- **Key Features**: Mouse, keyboard, touch input processing
- **Used by**: Camera controls, interaction systems

#### **`navara_event`**
- **Purpose**: Event system foundation
- **Key Features**: Event definitions, event bus, event routing
- **Used by**: All systems requiring event communication

#### **`navara_event_store`**
- **Purpose**: Event storage and history management
- **Key Features**: Event persistence, event replay, debugging
- **Used by**: Event system for state management

#### **`navara_layer_event`**
- **Purpose**: Layer-specific event handling
- **Key Features**: Layer events, data loading events, layer state changes
- **Used by**: Layer management system

### **Utilities (4 crates)**

#### **`navara_window`**
- **Purpose**: Window and viewport management
- **Key Features**: Window dimensions, viewport calculations, screen coordinates
- **Used by**: Rendering systems, camera, input handling

#### **`navara_data_requester`**
- **Purpose**: Data fetching and request management
- **Key Features**: HTTP requests, data caching, request queuing
- **Used by**: Tile loading, data source management

#### **`navara_mesh`**
- **Purpose**: Mesh data structures and operations
- **Key Features**: Mesh definitions, vertex management, mesh utilities
- **Used by**: Geometry processing, rendering

#### **`navara_texture_fragment`**
- **Purpose**: Texture fragment management
- **Key Features**: Texture atlasing, fragment allocation, texture optimization
- **Used by**: Rendering systems for texture management

### **Format Handlers (2 crates)**

#### **`navara_b3dm`**
- **Purpose**: Batched 3D Model format support
- **Key Features**: B3DM parsing, 3D model batching
- **Used by**: 3D Tiles system for building models

#### **`navara_glb`**
- **Purpose**: GLB/GLTF model support
- **Key Features**: GLB parsing, 3D model loading, animation support
- **Used by**: 3D model rendering, asset loading

### **Development (1 crate)**

#### **`navara_bin`**
- **Purpose**: Binary utilities and development tools
- **Key Features**: CLI tools, development utilities, debugging aids
- **Used by**: Development workflow, testing

#### **`navara_mock`**
- **Purpose**: Mock implementations for testing
- **Key Features**: Test doubles, mock data sources, testing utilities
- **Used by**: Test suites across the codebase

## Crate Dependency Overview

### **Foundation Layer**
- `navara_core`, `navara_math` - Used by almost all crates
- `navara_component` - Used by all ECS-based crates

### **Engine Coordination**
- `navara_ecs` - Central coordinator, integrates most crates
- `navara_buffer_store`, `navara_frame` - Core engine services

### **Data Processing Pipeline**
```
Data Sources → Parser → Layer → Feature → Geometry → Rendering
     ↓           ↓        ↓        ↓         ↓          ↓
   Various → navara_parser → navara_layer → navara_feature → navara_geometry → Render Systems
```

### **WASM Integration**
- `navara_wasm` - Integrates all 40+ crates
- `navara_wasm_api` - Uses only 6 core crates (`navara_core`, `navara_math`, `navara_camera`, etc.)
- `navara_wasm_worker` - Uses processing-focused crates

This modular architecture allows for:
- **Selective compilation** (WASM API uses only needed crates)
- **Clear separation of concerns** (each crate has specific responsibility)  
- **Flexible integration** (crates can be composed in different ways)
- **Performance optimization** (heavy operations can be moved to workers)