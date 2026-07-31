## v0.0.5 - 2026-07-31

### 🚀 Features

- Support maplibre style's line, circle, symbol (#741)
- Batch text labels (#748)
- Support raster dem in TileJSON (#753)

### 🐛 Bug Fixes

- Improve atmosphere assets handling (#747)
- Load atmosphere assets on demand (#749)
- Avoid panic when model material is none (#750)
- Remove unused clamp to ground from the model material (#751)
- Incorrect tileSize on page maplibre-style (#752)

### 🔨 Refactoring

- Update decluttering logic to improve label visibility handling (#742)

## v0.0.4 - 2026-07-28

### 🚀 Features

- Rename snake-case to kebab-case to follow NPM convention (#740)

## v0.0.3 - 2026-07-28

### 🚀 Features

- Increase solar API (#731)
- Add load/error events to GLTF and splat meshes (#734)
- Add SSR geometryBuffer (#735)

### 🐛 Bug Fixes

- Improve rte (#727)
- Multiple polygon in geojson-vt (#726)
- Flickering vector tile (#728)
- Camera jump issue (#733)
- Terrain parent flickering (#730)
- Avoid unnecessary feature evaluation (#736)
- Arcline RTE related bugs (#737)
- Improve text rendering performance (#738)
- Terrain parent flickering (#739)

### 🧹 Miscellaneous

- *(example)* Credit the data sources each example displays (#719)
- Move font family util to rust (#732)
 
## v0.0.2 - 2026-07-22

### 🚀 Features

- Update deps (#720)
- Update postprocessing (#722)
- Add declutter manager to avoid collision between text/sprite. (#717)

### 🐛 Bug Fixes

- Tile gaps (#721)
- Update the outdated pmtiles links, and use cdn endpoints (#723)
- Gltf model RTE (#724)

## v0.0.1 - 2026-07-22

First release 🎉
