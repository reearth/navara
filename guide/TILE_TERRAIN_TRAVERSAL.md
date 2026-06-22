# Tile & Terrain Traversal

How Navara streams a 3D globe: how terrain geometry and raster imagery are
selected per frame, kept at the right level of detail, and stitched together.
This document covers the **Rust engine side** (the `navara_tile` crate and the
quadtrees it walks). For how the resolved textures are then baked onto a single
mesh on the **TypeScript/GPU side**, see
[TILE_TEXTURE_COMPOSITING.md](TILE_TEXTURE_COMPOSITING.md). For the surrounding
architecture see [ARCHITECTURE.md](ARCHITECTURE.md).

## Overview

A globe is rendered as a pyramid of tiles. As the camera moves, the engine must
decide, every frame:

- which **terrain** tiles to mesh (the 3D surface), and
- which **raster** tiles to drape on them (satellite, OSM, … imagery).

These two questions look similar but pull in different directions:

| | Terrain | Raster imagery |
| --- | --- | --- |
| Provides | 3D geometry (the mesh) | a texture draped on geometry |
| Tiling scheme | WebMercator **or** Geographic | WebMercator only |
| LOD transition | **strict** — swap parent → children only when _all_ children are ready (no holes in the surface) | **lenient** — show the parent immediately, refine children as they load |
| Count | exactly one terrain source | any number of raster layers |

Because the schemes can differ (Cesium quantized-mesh terrain defaults to
**Geographic**, while raster tiles are **WebMercator**), a single tile pyramid
cannot represent both: one Geographic terrain tile overlaps **several**
WebMercator raster tiles (an N:M relationship — the grids do not nest).

So Navara runs **two independent quadtrees with two independent traversals**,
and joins them by geographic extent:

```mermaid
flowchart LR
  subgraph Terrain["Terrain pipeline (WM or Geographic)"]
    TQT["TerrainTileQuadtree<br/>(geometry + mesh)"]
    TT["traverse_terrain()<br/>strict LOD"]
    TQT --- TT
  end
  subgraph Raster["Raster pipeline (WebMercator only)"]
    RQT["RasterTileQuadtree<br/>(textures only)"]
    RT["traverse_raster()<br/>lenient LOD"]
    RQT --- RT
  end
  CAM["Camera / frustum"] --> TT
  CAM --> RT
  TT -->|"pulls textures by extent"| JOIN{{"resolve_raster_texture()"}}
  RQT --> JOIN
  JOIN --> MAT["update_mesh_material()<br/>drape onto terrain mesh"]
```

The terrain traversal owns the **render unit** (the mesh that actually gets
drawn). The raster traversal only loads and tracks textures; the terrain tile
**pulls** the best matching raster texture when it builds its material.

## The two tile types

Both quadtrees are instances of the generic `Quadtree<usize, T>`
(`navara_quadtree`), so a second lightweight tile type is cheap to add.

```mermaid
classDiagram
  class TerrainTile {
    coords: TileXYZ
    extent, aabb, bounding_region
    tiling_scheme: WM | Geographic
    terrain_data: Box~dyn TerrainData~
    cached_mesh_handle
    hillshade_entity_ids
    max_height / min_height
    were_children_rendered
  }
  class RasterTile {
    coords: TileXYZ — WM only
    extent, aabb, bounding_region
    texture_fragment_entity_ids
    ready_parent_tile_handle
    were_children_rendered
  }
  class TerrainData {
    <<trait>>
    construct_terrain_mesh()
    upsample()
    compute_height_at_point()
  }
  TerrainTile --> TerrainData
  TerrainData <|.. RasterDEMData
  TerrainData <|.. QuantizedMeshData
```

- **`TerrainTile`** (`crates/navara_tile_component/src/terrain_tile.rs`) carries
  the geometry: a `TerrainData` implementation (raster-DEM, quantized-mesh, or
  ellipsoid), the built GPU mesh handle, terrain heights, and the per-layer
  **hillshade** entities. Hillshade stays on the terrain side because it is
  derived from the terrain DEM and needs neighbour-tile edges.
- **`RasterTile`** (`crates/navara_tile_component/src/raster_tile.rs`) is
  deliberately tiny: it owns only the per-layer texture-fragment entities and a
  parent-fallback handle. It has no mesh, no heights, no terrain data — it is
  never drawn directly.

`TileXYZ` plus the `TilingScheme` fully determine a tile's geographic extent
(`crates/navara_core/src/tiles.rs`):

```mermaid
flowchart TB
  WM["WebMercator { tms }<br/>1 root (0,0,0)<br/>2^z × 2^z tiles<br/>±85°, non-linear in latitude"]
  GEO["Geographic { tms }<br/>2 roots (0,0,0) & (1,0,0)<br/>2^(z+1) × 2^z tiles<br/>±90°, equal-degree"]
```

## Per-frame system pipeline

All of this runs as an ordered chain of Bevy systems registered by `TilePlugin`
(`crates/navara_tile/src/lib.rs`). The raster systems run **before** the terrain
systems so the freshly-requested textures are available to pull from:

```mermaid
flowchart TD
  subgraph Update["Update schedule (TileSet, chained)"]
    direction TB
    UL["update_layer / delete_layer"] --> IGT["init_globe_tiling<br/>(terrain roots, scheme)"]
    IGT --> IRT["init_raster_tiling<br/>(WM root)"]
    IRT --> URT["update_raster_tiles<br/>→ traverse_raster()"]
    URT --> CRC["clear_raster_caches<br/>(prune stale raster tiles)"]
    CRC --> UT["update_terrain<br/>→ traverse_terrain()"]
    UT --> TM["transfer_mesh<br/>(worker → GPU mesh)"]
    TM --> UMM["update_mesh_material<br/>(pull + drape)"]
    UMM --> FILT["filter_requestable_raster_texture_fragment<br/>filter_requestable_*_hillshade / data"]
    FILT --> CC["clear_caches (terrain)"]
  end
```

The `filter_requestable_*` systems are rate limiters: they cap how many texture
/ DEM requests are in flight at once and reject the overflow so it is retried
next frame.

## Terrain traversal — strict LOD

`traverse_terrain()` (`crates/navara_tile/src/tile/traverse.rs`) walks the terrain
quadtree from each root and decides, recursively, whether a tile renders, its
children render, or nothing renders yet. It is a screen-space-error (SSE)
refinement with a **strict swap**: a parent is only hidden once **all** of its
children have a prepared mesh, so the surface never shows a hole.

```mermaid
flowchart TD
  A["visit tile"] --> B{frustum / horizon culled?}
  B -- yes --> CULL["Culled"]
  B -- no --> C["compute SSE, readiness"]
  C --> D{"SSE ≤ max_sse ?"}
  D -- "yes (tile is detailed enough)" --> E{renderable?}
  E -- yes --> R["TileRendered"]
  E -- "no" --> REQ["request terrain data → NotFound"]
  D -- "no (need more detail)" --> F["recurse into 4 children"]
  F --> G{all children prepared?}
  G -- yes --> CMP["ChildrenMeshesPrepared<br/>activate children, hide parent"]
  G -- "no" --> H["keep parent visible<br/>(children fill in as ready)"]
```

Two subtleties make terrain + imagery work together:

- **Upsampling to follow imagery.** A terrain tile keeps subdividing past its own
  data's max zoom by **upsampling** the parent mesh (`overscaled_max_zoom`). This
  is what lets fine raster (e.g. OSM z23) sit on coarse terrain (e.g.
  quantized-mesh z18): the terrain geometry is subdivided to z23 so there is a
  surface to drape the z23 texture onto. Keeping the terrain subdivided to the
  finest raster layer's depth also keeps the N:M overlap small (≈1 raster tile
  per terrain tile).
- **Geometry-first rendering.** A terrain tile is "ready" to render as soon as
  its **geometry** is ready — it does not wait for textures. Textures are
  requested lazily and pulled in as they arrive (see below). Terrain-side
  texture readiness (`is_texture_ready`) therefore only gates on **hillshade**,
  which is terrain-owned.

The mesh itself is built off the main thread: `traverse_terrain` requests the DEM /
quantized-mesh bytes, a worker constructs the mesh, and `transfer_mesh` moves the
result onto a `TileMeshMarker` entity.

```mermaid
sequenceDiagram
  participant T as traverse_terrain
  participant W as worker (navara_worker)
  participant TM as transfer_mesh
  T->>T: request_terrain_data() (DEM / .terrain bytes)
  T->>W: spawn ConstructTerrainMesh / UpsampleTerrainMesh task
  W-->>TM: task completed (geometry)
  TM->>TM: store buffers, spawn TileMeshMarker + Mesh + Material
```

## Raster traversal — lenient LOD

`traverse_raster()` (`crates/navara_tile/src/raster/traverse.rs`) is much
simpler than the terrain traversal because raster tiles own no mesh and are never
drawn directly. Its only jobs are to **select** the right LOD by SSE, **request**
the textures along the path, and keep visited tiles alive so the terrain can fall
back to a parent while children load.

```mermaid
flowchart TD
  A["visit raster tile"] --> M["mark visited<br/>(RasterTileCacheManager)"]
  M --> B{culled?}
  B -- yes --> STOP1["return"]
  B -- no --> RQ["request_raster_texture_fragment()<br/>(idempotent, per regular layer)"]
  RQ --> D{"SSE ≤ max_sse<br/>or beyond max zoom?"}
  D -- yes --> STOP2["stop — detailed enough"]
  D -- "no" --> CH["recurse into 4 children"]
```

There is no "swap" logic and no "all children ready" barrier: the lenient
behaviour ("show the parent while waiting for children") is handled entirely at
**pull time** by walking up to the nearest ready ancestor.

Stale raster tiles (not visited recently) are pruned by `clear_raster_caches`,
which keeps the live set bounded. Visited ancestors stay alive, so a fallback
texture is always available while zooming.

**Borrowing terrain height.** A raster tile owns no geometry, so on its own it
sits flat at sea level. But SSE depends on the camera-to-tile distance, so a
flat tile over elevated terrain measures itself as farther away than it really
is and stops subdividing too early — leaving coarse imagery on a detailed
(upsampled) surface. To avoid this, the raster traversal looks up the tile's
elevation in the `TerrainInformationQuadtree` (populated by the terrain pipeline)
and calls `update_heights` before computing SSE, so the imagery refines in step
with the terrain. A terrain-mesh change therefore also re-triggers the raster
traversal even when the camera is still.

## Joining the two — the pull

When `update_mesh_material` (`crates/navara_tile/src/tile/system.rs`) builds a
terrain tile's material, it resolves each layer:

- **hillshade layers** → from the terrain tile's own `hillshade_entity_ids`
  (with the terrain-side parent fallback), and
- **regular raster layers** → **pulled** from the raster quadtree by
  `resolve_raster_texture()` (`crates/navara_tile/src/raster/resolve.rs`).

```mermaid
sequenceDiagram
  participant UMM as update_mesh_material
  participant RQT as RasterTileQuadtree
  participant MAT as RasterTileInternalMaterial
  UMM->>RQT: resolve_raster_texture(terrain.coords, layer)
  alt exact WM tile ready
    RQT-->>UMM: (entity, identity UV)
  else fall back to ready ancestor
    RQT-->>UMM: (ancestor entity, uv_transform sub-rect)
  else nothing ready
    RQT-->>UMM: None
  end
  UMM->>MAT: texture_fragments + layer_uv_transforms
```

`resolve_raster_texture` first looks for the exact WebMercator tile at the
terrain tile's coordinates; if its texture is not loaded, it climbs to the
nearest ready ancestor and returns a power-of-two UV sub-rect so the coarser
texture drapes correctly. This ancestor fallback is why decoupling render-
readiness from texture-readiness never produces a blank tile — there is almost
always _some_ ancestor texture to show while the exact tile loads.

The resulting `(entity, uv_transform)` per layer is handed to the material, and
the TypeScript side bakes them into the tile's atlas — continued in
[TILE_TEXTURE_COMPOSITING.md](TILE_TEXTURE_COMPOSITING.md).

## Texture fragment ownership

Both pipelines spawn texture-fragment entities that carry a
`TileTextureFragmentMarker(handle)`. The handle indexes **different quadtrees**
depending on the pipeline, so the two are kept apart by component type rather
than by the marker alone:

| | Component | Marker handle indexes | Rate-limited by |
| --- | --- | --- | --- |
| Raster texture | `TextureFragment` | `RasterTileQuadtree` | `filter_requestable_raster_texture_fragment` |
| Hillshade | `DataRequester` (+ `HillshadeTextureMarker`) | `TerrainTileQuadtree` | `filter_requestable_hillshade_data_requester` |

Each rate limiter clears rejected slots against its **own** quadtree. Mixing them
up (interpreting a raster handle against the terrain quadtree) corrupts unrelated
tiles, so the queries are scoped precisely: the raster filter matches
`With<TextureFragment>`, the hillshade filter matches `With<HillshadeTextureMarker>`.

## Scheme support status

The split architecture is in place and the join is **extent-based by design**,
but the pull is implemented in two stages:

```mermaid
flowchart LR
  subgraph Now["Implemented (WebMercator)"]
    A["terrain.coords == raster.coords<br/>identity lookup + ancestor fallback"]
  end
  subgraph Next["Planned (Geographic, N:M)"]
    B["web_mercator_overlapping_tiles(extent, z)<br/>→ N WM tiles per terrain tile"]
    C["uv_rect_from_extents()<br/>arbitrary translate + scale"]
    D["composite N textures per layer<br/>(tileComposite, offscreen)"]
  end
  A -.->|generalize| B
```

- **Today**, terrain and raster share the WebMercator scheme, so the join is an
  identity coordinate lookup (a terrain tile pulls the raster tile at the same
  `x/y/z`). WebMercator terrain (including WebMercator quantized-mesh) and
  terrain-less raster maps render through the pull.
- **Next**, for **Geographic** terrain (the quantized-mesh default), one terrain
  tile overlaps multiple WebMercator raster tiles. The pull generalizes to
  resolve the **set** of overlapping tiles with extent-based UV rects, and the
  TypeScript compositor stitches them per terrain tile. Until then a Geographic
  terrain tile finds no identity match and simply renders without imagery (it
  does not crash).

## Key files

| Concern | Path |
| --- | --- |
| Terrain tile | `crates/navara_tile_component/src/terrain_tile.rs` |
| Raster tile | `crates/navara_tile_component/src/raster_tile.rs` |
| Tiling scheme / extents | `crates/navara_core/src/tiles.rs` |
| Terrain traversal | `crates/navara_tile/src/tile/traverse.rs` |
| Raster traversal | `crates/navara_tile/src/raster/traverse.rs` |
| Raster texture request | `crates/navara_tile/src/raster/request.rs` |
| Pull / resolve | `crates/navara_tile/src/raster/resolve.rs` |
| Material drape | `crates/navara_tile/src/tile/system.rs` (`update_mesh_material`) |
| Hillshade request | `crates/navara_tile/src/texture_fragment/helpers.rs` |
| Plugin / system order | `crates/navara_tile/src/lib.rs` |
