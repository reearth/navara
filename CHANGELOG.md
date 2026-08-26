## v0.0.8 - 2026-08-26

### 🚀 Features

- Add easing to fly to API ([#784](https://github.com/reearth/navara/pull/784))
- Update npm dependencies (minor) ([#789](https://github.com/reearth/navara/pull/789))
- Add mesh API - geodetic frame   ([#785](https://github.com/reearth/navara/pull/785))

### 🐛 Bug Fixes

- Repair broken sibling links and stale repo URLs in the docs ([#780](https://github.com/reearth/navara/pull/780))
- Fix review
- Picking tolerance ([#781](https://github.com/reearth/navara/pull/781))
- Camera fov/fovy getters and vertical fov handling ([#782](https://github.com/reearth/navara/pull/782))
- Billboard color space ([#795](https://github.com/reearth/navara/pull/795))

### 🧹 Miscellaneous

- Update dependency node to v24.19.0 ([#790](https://github.com/reearth/navara/pull/790))
- Update actions/checkout action to v7 ([#791](https://github.com/reearth/navara/pull/791))
- Pin step-security/harden-runner action to v2.21.0 ([#786](https://github.com/reearth/navara/pull/786))
- Update cargo dependencies (minor) ([#788](https://github.com/reearth/navara/pull/788))
- Update actions/setup-node action to v7 ([#792](https://github.com/reearth/navara/pull/792))
- Update pnpm/action-setup action to v6 ([#793](https://github.com/reearth/navara/pull/793))

## v0.0.7 - 2026-08-21

### 🚀 Features

- Add sampleTerrainMostDetailed ([#774](https://github.com/reearth/navara/pull/774))

### 🐛 Bug Fixes

- Improve polygon outline jitter ([#768](https://github.com/reearth/navara/pull/768))
- SSR and FogLight order ([#769](https://github.com/reearth/navara/pull/769))
- Bump Overture tiles URL release ([#770](https://github.com/reearth/navara/pull/770))
- Mvt text flicker ([#771](https://github.com/reearth/navara/pull/771))
- Text material flicker ([#772](https://github.com/reearth/navara/pull/772))
- Lazy font face fetch ([#773](https://github.com/reearth/navara/pull/773))
- Improve pickTerrainPosition precision ([#775](https://github.com/reearth/navara/pull/775))
- Remove height from sampleTerrainHeight arg ([#776](https://github.com/reearth/navara/pull/776))
- Shadow error and horizon culling for polyline ([#777](https://github.com/reearth/navara/pull/777))
- Tiled geojson deletion ([#778](https://github.com/reearth/navara/pull/778))
- Tiled polygon and polyline on the geodesic path ([#779](https://github.com/reearth/navara/pull/779))

## v0.0.6 - 2026-08-17

### 🚀 Features

- Replace legacy data with source completely ([#756](https://github.com/reearth/navara/pull/756))
- Increase animation speed and dash speed multiplier for PersonViewPlugin ([#759](https://github.com/reearth/navara/pull/759))
- Enhance person view plugin ([#761](https://github.com/reearth/navara/pull/761))
- Set reflectivity for watermask automatically ([#762](https://github.com/reearth/navara/pull/762))
- Dynamic MRT buffers ([#765](https://github.com/reearth/navara/pull/765))

### 🐛 Bug Fixes

- Improve text rendering quality ([#754](https://github.com/reearth/navara/pull/754))
- Improve pmtiles overture example ([#755](https://github.com/reearth/navara/pull/755))
- Improve CSM precision ([#758](https://github.com/reearth/navara/pull/758))
- Interpolate terrain height sampling API ([#760](https://github.com/reearth/navara/pull/760))
- Improve fog light quality ([#766](https://github.com/reearth/navara/pull/766))
- Improve SSR quality ([#767](https://github.com/reearth/navara/pull/767))

## v0.0.5 - 2026-07-31

### 🚀 Features

- Support maplibre style's line, circle, symbol ([#741](https://github.com/reearth/navara/pull/741))
- Batch text labels ([#748](https://github.com/reearth/navara/pull/748))
- Support raster dem in TileJSON ([#753](https://github.com/reearth/navara/pull/753))

### 🐛 Bug Fixes

- Improve atmosphere assets handling ([#747](https://github.com/reearth/navara/pull/747))
- Load atmosphere assets on demand ([#749](https://github.com/reearth/navara/pull/749))
- Avoid panic when model material is none ([#750](https://github.com/reearth/navara/pull/750))
- Remove unused clamp to ground from the model material ([#751](https://github.com/reearth/navara/pull/751))
- Incorrect tileSize on page maplibre-style ([#752](https://github.com/reearth/navara/pull/752))

### 🔨 Refactoring

- Update decluttering logic to improve label visibility handling ([#742](https://github.com/reearth/navara/pull/742))

## v0.0.4 - 2026-07-28

### 🚀 Features

- Rename snake-case to kebab-case to follow NPM convention ([#740](https://github.com/reearth/navara/pull/740))

## v0.0.3 - 2026-07-28

### 🚀 Features

- Increase solar API ([#731](https://github.com/reearth/navara/pull/731))
- Add load/error events to GLTF and splat meshes ([#734](https://github.com/reearth/navara/pull/734))
- Add SSR geometryBuffer ([#735](https://github.com/reearth/navara/pull/735))

### 🐛 Bug Fixes

- Improve rte ([#727](https://github.com/reearth/navara/pull/727))
- Multiple polygon in geojson-vt ([#726](https://github.com/reearth/navara/pull/726))
- Flickering vector tile ([#728](https://github.com/reearth/navara/pull/728))
- Camera jump issue ([#733](https://github.com/reearth/navara/pull/733))
- Terrain parent flickering ([#730](https://github.com/reearth/navara/pull/730))
- Avoid unnecessary feature evaluation ([#736](https://github.com/reearth/navara/pull/736))
- Arcline RTE related bugs ([#737](https://github.com/reearth/navara/pull/737))
- Improve text rendering performance ([#738](https://github.com/reearth/navara/pull/738))
- Terrain parent flickering ([#739](https://github.com/reearth/navara/pull/739))

### 🧹 Miscellaneous

- *(example)* Credit the data sources each example displays ([#719](https://github.com/reearth/navara/pull/719))
- Move font family util to rust ([#732](https://github.com/reearth/navara/pull/732))
 
## v0.0.2 - 2026-07-22

### 🚀 Features

- Update deps ([#720](https://github.com/reearth/navara/pull/720))
- Update postprocessing ([#722](https://github.com/reearth/navara/pull/722))
- Add declutter manager to avoid collision between text/sprite. ([#717](https://github.com/reearth/navara/pull/717))

### 🐛 Bug Fixes

- Tile gaps ([#721](https://github.com/reearth/navara/pull/721))
- Update the outdated pmtiles links, and use cdn endpoints ([#723](https://github.com/reearth/navara/pull/723))
- Gltf model RTE ([#724](https://github.com/reearth/navara/pull/724))

## v0.0.1 - 2026-07-22

First release 🎉
