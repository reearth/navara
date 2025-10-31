# navara_globe

Globe resource and configuration management for Navara.

This crate provides a centralized `Globe` resource that manages shared properties across different material types (VectorTile, RasterTile, and RasterTerrain).

## Features

- Centralized globe configuration
- Shared properties for materials (max_sse, color, segments, etc.)
- Integration with Bevy ECS
- WASM-compatible for web integration
