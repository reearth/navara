# @navaramap/maplibre-style

MapLibre Style support for Navara. This package provides `MapLibreStylePlugin`, which parses a [MapLibre Style](https://maplibre.org/maplibre-style-spec/) JSON specification and translates its sources and layers into Navara layer operations and per-feature evaluators, so existing styles can be rendered on Navara's 3D globe.

This is an early-stage package: currently only `fill` layers are translated; other layer types are skipped with a warning.

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

Style parsing and expression evaluation are delegated to a `StyleEngine`. The default is `RustStyleEngine`, which evaluates styles in the WASM core; `JsStyleEngine` is a pure-TypeScript implementation based on `@maplibre/maplibre-gl-style-spec`, useful as a reference and for comparison. A custom engine can be passed as the second constructor argument.

## License

MIT OR Apache-2.0
