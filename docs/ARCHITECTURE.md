# Architecture Documentation

This document provides detailed architectural information for the Navara 3D globe map engine.

## GIS Engine to Rendering Engine Communication

Based on the system architecture, Navara employs a layered communication pattern between the GIS engine and rendering engine:

### **Data Flow Architecture**
```
Users/Application
       ↓
   Application ←→ GPU (WebGL rendering)
       ↓
Rendering Engine Layer
├─ API Library (@navara/three_api)
├─ Core Library (@navara/three) 
└─ Rendering Engine (Three.js)
       ↑
   Rendering Data
       ↑
GIS Engine Layer (WASM)
├─ navara_wasm_api (Type conversion & utilities)
├─ navara_wasm (Main engine interface)
└─ navara_ecs (Central coordinator)
       ↑
   GIS Computations
       ↑
GIS Processing Modules
├─ navara_core, navara_quadtree
├─ navara_parser, navara_geometry  
├─ navara_tiles, etc.
└─ Independent GIS processes
```

### **Communication Mechanisms**

#### **1. WASM Bridge Layer - Two Distinct Approaches**

**`navara_wasm` (Full Engine - 40+ crates)**
- **Stateful 3D engine** with complete ECS system (`navara_ecs` main loop)
- **Complex GIS operations**: Layer management, tile hierarchies, feature batching
- **Event-driven architecture**: Handles rendering events, data loading, worker task coordination
- **All GIS processing modules**: Uses the complete set of processing modules for comprehensive functionality
- **Memory-intensive**: Maintains persistent state, buffers, and complex data structures

**`navara_wasm_api` (Lightweight Utilities - 6 crates only)**
- **Stateless utility functions** for specific mathematical operations
- **Simple GIS operations**: Coordinate transformations, geometric calculations, ray intersections
- **Minimal GIS processing**: Uses only core math modules (`navara_core`, `navara_math`, `navara_camera`)
- **No persistent state**: Each function call is independent and lightweight
- **Fast initialization**: Small binary optimized for utility operations

#### **2. Rendering Data Transmission (Primary: `navara_wasm`)**
- **`navara_wasm`** processes complex geospatial data through its full GIS module suite:
  - Tile loading and parsing (`navara_tile`, `navara_parser`)
  - Feature processing and batching (`navara_feature`, `navara_geometry`)
  - Layer management (`navara_layer`) with multiple format support
- Transmits rendering-ready information including:
  - Transformed geometry data (meshes, vertices, indices)
  - Camera matrices and view parameters from ECS system
  - Material properties and texture references
  - Level-of-detail (LOD) information from quadtree structures
  - Event-driven updates for new mesh additions

#### **3. Application Layer Integration - Dual Path Architecture**
- **`@navara/three`** (Main 3D Engine Interface)
  - Receives comprehensive processed data from `navara_wasm`
  - Handles complex layer management and stateful operations
  - Manages event-driven rendering updates and buffer transfers
- **`@navara/three_api`** (Utility Bridge)
  - Provides lightweight bridge to `navara_wasm_api` utilities
  - Handles simple coordinate transformations and geometric calculations
  - Used for specific operations like screen-to-world coordinate conversion
- Application layer can choose appropriate interface based on complexity needs
- GPU receives final rendering commands via WebGL from Three.js

### **Independent Processing Model - Module Specialization**

#### **Full Engine Processing (`navara_wasm` with 40+ modules)**
- **Complex coordinated operations** through ECS system:
  - Multi-layer tile hierarchies with LOD management (`navara_quadtree`, `navara_tile`)
  - Feature batching and geometry processing (`navara_feature`, `navara_geometry`) 
  - Format parsing for MVT, GeoJSON, 3D Tiles (`navara_mvt`, `navara_geojson`, `navara_cesium3dtiles`)
  - Background worker task delegation (`navara_worker`) for heavy computations
  - Buffer management and memory optimization (`navara_buffer_store`)
- **Results consolidated through ECS system** before transmission to rendering layer
- **Event-driven coordination** between all processing modules

#### **Utility Processing (`navara_wasm_api` with 6 core modules)**
- **Independent mathematical operations** with no state coordination:
  - Direct coordinate transformations (`navara_core`, `navara_math`)
  - Simple geometric calculations (ray intersections, surface normals)
  - Camera-related utilities (`navara_camera`) for view transformations
  - Reference frame conversions (ENU, NED coordinate systems)
- **Each function executes independently** - no cross-module coordination needed
- **Immediate results** - no ECS processing or event system involvement

### **Performance Optimizations**
- **Zero-copy transfers** where possible between WASM and JavaScript
- **Buffer pooling** for efficient memory management across the boundary
- **Spatial culling** performed in GIS layer before sending data to renderer
- **Background processing** via Web Workers for CPU-intensive GIS operations

This architecture ensures clear separation of concerns: the GIS engine handles all geospatial computations and data processing, while the rendering engine focuses purely on visual representation and GPU optimization.

## Multi-Language Architecture

The project implements a sophisticated multi-language architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Navara Architecture                      │
├─────────────────────────────────────────────────────────────┤
│  TypeScript Frontend (Three.js + Web APIs)                 │
│  ├─ @navara/three     - Main 3D rendering engine          │
│  ├─ @navara/core      - Core utilities and types          │
│  ├─ @navara/worker    - Web Worker coordination           │
│  └─ @navara/three_api - API bridge utilities              │
├─────────────────────────────────────────────────────────────┤
│  WebAssembly Interface Layer                               │
│  ├─ navara_wasm        - Main engine (40+ crates)         │
│  ├─ navara_wasm_worker - Background processing            │
│  └─ navara_wasm_api    - Utility functions               │
├─────────────────────────────────────────────────────────────┤
│  Rust Core Engine (Bevy ECS)                              │
│  ├─ Core Systems       - Math, geometry, ECS              │
│  ├─ Rendering          - Camera, materials, effects       │
│  ├─ Data Handling      - Tiles, features, formats         │
│  ├─ Geometry Processing - Meshes, spatial structures      │
│  └─ Support Systems    - Events, workers, utilities       │
└─────────────────────────────────────────────────────────────┘
```

## TypeScript Web Ecosystem

### **Core Packages**
- **`@navara/core`** (`web/navara_core/`) - Core utilities, event management, type definitions
- **`@navara/three`** (`web/navara_three/`) - Main Three.js integration with comprehensive 3D engine
- **`@navara/worker`** (`web/navara_worker/`) - Web Worker abstraction with task queuing
- **`@navara/three_api`** (`web/navara_three_api/`) - Bridge between Three.js and WASM API

### **WASM Integration** (`web/wasm/`)
- **`navara_engine`** - Main engine functionality (generated from `navara_wasm`)
- **`navara_engine_worker`** - Background processing (generated from `navara_wasm_worker`)
- **`navara_engine_api`** - Utility functions (generated from `navara_wasm_api`)

## Build System Architecture

### **Multi-Target WASM Compilation**
The project compiles three separate WASM modules for different purposes:

1. **Main Engine** (`navara_wasm`) → `web/wasm/navara_engine/`
   - Full 3D engine functionality
   - Camera, layers, features, tiles
   - ECS system integration

2. **Web Worker** (`navara_wasm_worker`) → `web/wasm/navara_engine_worker/`
   - Performance-critical background tasks
   - Terrain mesh construction
   - Polygon/polyline batch processing

3. **API Bindings** (`navara_wasm_api`) → `web/wasm/navara_engine_api/`
   - Lightweight utility functions
   - Coordinate transformations
   - Mathematical operations

### **Build Pipeline**
```bash
# Build sequence (enforced by cargo-make):
1. Compile WASM modules (Rust → WebAssembly)
2. Generate TypeScript bindings
3. Install web dependencies (pnpm workspace)
4. Build TypeScript packages
5. Copy assets and prepare examples
```

## Supported Geospatial Formats

The engine supports comprehensive geospatial data formats:

- **Raster Tiles** - Standard web map tiles (XYZ, TMS)
- **Vector Tiles** - Mapbox Vector Tiles (MVT) format
- **3D Tiles** - Cesium 3D Tiles specification (buildings, point clouds)
- **GeoJSON** - Feature collections and geometries
- **Terrain Data** - Height maps and digital elevation models
- **3D Models** - GLB/GLTF models with geospatial positioning

## Performance Features

### **Rendering Optimizations**
- **Frustum Culling** - Automatic geometry culling outside camera view
- **Level-of-Detail (LOD)** - Hierarchical detail management
- **Tile Management** - Automatic loading/unloading based on viewport
- **GPU Acceleration** - WebGL-based rendering pipeline

### **Computational Optimizations**
- **Web Workers** - CPU-intensive tasks offloaded to background threads
- **WASM Performance** - Core algorithms implemented in Rust
- **Memory Management** - Efficient buffer pooling and zero-copy transfers
- **Spatial Indexing** - Quadtree-based spatial data structures

## Three.js Integration

### **Rendering Pipeline**
- **Multi-Render Targets** - Separate color, normal, and depth buffers
- **Post-Processing** - SSAO, tone mapping, anti-aliasing, lens flare
- **Atmospheric Effects** - Realistic atmosphere with scattering
- **Weather Effects** - Volumetric clouds and fog systems

### **Key Dependencies**
- **Three.js** - Core 3D rendering
- **@takram/three-*** - Specialized extensions for atmosphere, clouds, geospatial effects
- **Postprocessing library** - Advanced visual effects

## Key Technologies

### **Rust Ecosystem**
- **Bevy ECS** - Entity Component System framework
- **wasm-bindgen** - WebAssembly bindings generation
- **geo-types** - Geometric types and operations
- **serde** - Serialization/deserialization

### **Web Ecosystem**
- **Three.js** - 3D rendering engine
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **pnpm workspaces** - Monorepo package management

### **Build Tools**
- **cargo-make** - Task runner and build orchestration
- **wasm-pack** - WebAssembly package builder
- **cargo-watch** - File watching for automatic rebuilds

## Code Quality Standards

- **Clippy**: Configured with `-D warnings` (warnings treated as errors)
- **Rust 1.93.0**: Exact toolchain version for consistency
- **ESLint**: Strict TypeScript linting with reearth configuration
- **Format on save**: Both Rust and TypeScript code formatting enforced

## Testing Strategy

- **Rust Tests**: Unit and integration tests with `cargo test`
- **TypeScript Tests**: Vitest for web package testing
- **Parallel Execution**: `cargo make test` runs both test suites simultaneously

## Memory Management

- **Zero-copy transfers** between WASM and JavaScript where possible
- **Buffer pooling** for efficient memory usage
- **Automatic cleanup** of geometry and texture resources
- **Reference counting** for shared resources

This architecture provides a robust, high-performance foundation for complex geospatial visualizations while maintaining developer productivity through excellent tooling and hot reload capabilities.