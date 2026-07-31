# @navaramap/maplibre-style

MapLibre Style support for Navara. This package provides `MapLibreStylePlugin`, which parses a [MapLibre Style](https://maplibre.org/maplibre-style-spec/) JSON specification and translates its sources and layers into Navara layer operations and per-feature evaluators, so existing styles can be rendered on Navara's 3D globe.

## Supported Features

### Layer Types & Properties

Only the properties listed below are actually implemented and functional. Other MapLibre Style Spec properties in the same layer type are parsed but ignored.

#### ✅ `fill`

- **Paint:** `fill-color`, `fill-opacity`
- **Note:** `fill-outline-color`, `fill-antialias`, `fill-translate` etc. are not supported

#### ✅ `fill-extrusion`

- **Paint:** `fill-extrusion-color`, `fill-extrusion-opacity`, `fill-extrusion-height`, `fill-extrusion-base`
- **Note:** Vertical height values only; no translation or pattern support

#### ✅ `line`

- **Paint:** `line-color`, `line-opacity`, `line-width`
- **Note:** `line-dasharray`, `line-pattern`, `line-cap`, `line-join` are not supported

#### ✅ `circle`

- **Paint:** `circle-color`, `circle-opacity`, `circle-radius`
- **Note:** `circle-stroke-*`, `circle-blur`, `circle-translate` are not supported

#### ✅ `symbol`

- **Paint:** `icon-color`, `icon-opacity`, `text-color`, `text-opacity`
- **Layout:** `icon-image`, `icon-size`, `text-field`, `text-size`, `text-font`
- **Note:**
  - `text-font` only uses the first font in the array (no font fallback support)
  - `text-halo-color`, `text-halo-width`, `text-anchor`, `icon-anchor`, `text-offset`, `icon-offset` are parsed but not applied
  - Text rendering uses SDF (signed distance field)
  - No text rotation, collision detection, or symbol sorting

#### ⚠️ `hillshade`

- **Paint:** No paint properties are processed

#### ⚠️ `raster`

- **Paint:** No paint properties are processed (raster displays as-is from source)
- **Note:**
  - Properties like `raster-opacity`, `raster-brightness`, `raster-contrast` are parsed but not applied
  - Basic raster tile display only

#### ❌ Not Supported

- `background`, `sky` - No source, not applicable
- `heatmap` - Not implemented

### Source Types

#### ✅ `geojson`

```json
{
  "type": "geojson",
  "data": { "type": "FeatureCollection", "features": [...] }
}
```

or

```json
{
  "type": "geojson",
  "data": "https://example.com/data.geojson"
}
```

#### ✅ `vector`

```json
{
  "type": "vector",
  "tiles": ["https://example.com/{z}/{x}/{y}.pbf"]
}
```

- **Note:** Only `tiles` array is supported; `url` (TileJSON) is not

#### ✅ `raster`

```json
{
  "type": "raster",
  "tiles": ["https://example.com/{z}/{x}/{y}.png"],
  "tileSize": 256
}
```

#### ✅ `raster-dem`

```json
{
  "type": "raster-dem",
  "tiles": ["https://example.com/{z}/{x}/{y}.png"],
  "encoding": "terrarium" | "mapbox"
}
```

- Supports `terrarium` and `mapbox` encodings
- Can be used with `terrain` property for 3D terrain rendering

#### ❌ Not Supported

- `image`, `video`, `canvas` - Not implemented

### Expression Support

All [MapLibre expression operators](https://maplibre.org/maplibre-style-spec/expressions/) are supported:

- **Lookup:** `get`, `has`, `in`, `index-of`, `length`
- **Decision:** `case`, `match`, `coalesce`
- **Type:** `to-boolean`, `to-number`, `to-string`, `to-color`, `array`, `literal`, `typeof`
- **String:** `concat`, `upcase`, `downcase`
- **Math:** `+`, `-`, `*`, `/`, `%`, `^`, `sqrt`, `log10`, `ln`, `abs`, `ceil`, `floor`, `round`, `min`, `max`
- **Comparison:** `==`, `!=`, `>`, `>=`, `<`, `<=`
- **Logical:** `!`, `all`, `any`
- **Zoom:** `zoom` ⚠️ currently returns 0 (zoom-based styling not fully implemented)
- **Geometry:** `geometry-type`, `id`, `properties`

### Navara Extensions

Navara is compatible with the standard MapLibre Style Spec without custom extensions.

## Usage

Pass the style JSON to the plugin and add it before `view.init()`:

```typescript
import ThreeView from "@navaramap/three";
import { MapLibreStylePlugin } from "@navaramap/maplibre-style";
import style from "./style.json";

const view = new ThreeView();
view.addPlugin(new MapLibreStylePlugin(style)); // must happen before init()
await view.init();

// Credit the style's data sources through the built-in attribution UI.
view.attribution?.add([
  {
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
]);
```

### Style Engines

Style parsing and expression evaluation are delegated to a `StyleEngine`:

- **`RustStyleEngine`** (default) - Evaluates styles in WASM for better performance, powered by the `maplibre-expr` Rust crate
- **`JsStyleEngine`** - Pure TypeScript implementation based on `@maplibre/maplibre-gl-style-spec`, useful as a reference and for comparison

A custom engine can be passed as the second constructor argument:

```typescript
import { MapLibreStylePlugin, JsStyleEngine } from "@navaramap/maplibre-style";

const plugin = new MapLibreStylePlugin(style, new JsStyleEngine());
view.addPlugin(plugin);
```

## Known Limitations

### Sources

- **No TileJSON support** - The `url` field (which points to TileJSON documents) is not supported. Use the `tiles` array with direct tile template URLs instead.
  ```json
  // ❌ Not supported
  { "type": "vector", "url": "https://example.com/tiles.json" }

  // ✅ Use this instead
  { "type": "vector", "tiles": ["https://example.com/{z}/{x}/{y}.pbf"] }
  ```

### Layers

- **Limited property support** - Many MapLibre Style Spec properties are not implemented (see layer types section above for supported properties)
- **No patterns or sprites** - `fill-pattern`, `line-pattern`, sprite-based icons not supported
- **No advanced line styling** - Dasharray, gradient, caps, joins not implemented
- **Limited raster support** - Raster layers have basic support but may not render identically to MapLibre GL JS
- **No heatmap layers** - Not yet implemented
- **No background/sky layers** - These don't have sources and aren't supported

### Expressions

- **Zoom not fully implemented** - The `zoom` expression always returns 0, so zoom-dependent styles (e.g., `["interpolate", ["zoom"], ...]`) won't work as expected
- **Camera expressions not supported** - `pitch`, `distance-from-center`, etc. are not available

### Symbol Layers

- **Text rendering** - Uses SDF (signed distance field) text rendering, which may differ slightly from MapLibre GL JS
- **Icon/text collision** - No collision detection between symbols
- **Text rotation** - Limited support for rotated text
- **No symbol sorting** - z-order not controlled by `symbol-sort-key`

### Performance

- **Large feature counts** - Symbol layers with thousands of features may have performance implications on lower-end devices

## License

MIT OR Apache-2.0
