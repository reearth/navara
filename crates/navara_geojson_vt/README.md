# navara_geojson_vt

A Rust port of [maplibre/geojson-vt](https://github.com/maplibre/geojson-vt) — a library for slicing GeoJSON into vector tiles on the fly.

## Features

- **Pre-indexing**: Splits GeoJSON features into tiles up to a configurable `index_max_zoom` level, building a spatial index for fast tile retrieval.
- **On-demand drill-down**: For zoom levels beyond `index_max_zoom`, dynamically generates tiles by splitting from the nearest indexed ancestor tile up to `max_zoom`.

## Cache Strategy

Tiles are cached in two internal `HashMap`s — one for generated tile data (`tiles`) and one for source features used to drill down further (`sources`).

- **Pre-indexed tiles** (z <= `index_max_zoom`) are created once during construction and are **never evicted**. They serve as the foundation for on-demand drill-down.
- **Drill-down tiles** (z > `index_max_zoom`) are generated on demand and cached for reuse. These tiles can be evicted via `remove_tile()` to reclaim memory — for example, when tiles leave the viewport.
- **Re-drilling**: Because pre-indexed sources are always preserved, evicted drill-down tiles can be transparently regenerated on the next `get_tile()` call with no data loss.

## Not Supported

The following features from the original JS library or common tile server use cases are **not** implemented:

- **Dynamic data updates** — The index is built once from a static GeoJSON input. There is no API for adding, removing, or modifying features after construction.
- **Clustering** — Point clustering (as in [supercluster](https://github.com/mapbox/supercluster)) is out of scope for this crate.
