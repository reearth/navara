---
title: TileJsonPlugin
description: Register a TileJSON 3.0.0 tile source on navara_three from its document URL.
sidebar:
  order: 6
---

## Overview

`TileJsonPlugin` fetches a [TileJSON 3.0.0](https://github.com/mapbox/tilejson-spec/tree/master/3.0.0) document and registers it as a single Navara source. Instead of hand-copying a tile URL template, zoom range, and attribution into `view.addSource()`, you point the plugin at the document URL and it derives those fields for you.

`addSource()` mirrors [`ThreeView.addSource`](../../three/source/about/): you pass a discriminated `type` plus an optional `id`, with `url` pointing at the TileJSON document rather than at a tile template. The plugin then:

- reads the first tile endpoint, `minzoom` / `maxzoom`, and `scheme` from the document and forwards them to the source;
- surfaces the document's `attribution` credit through an [AttributionPlugin](../attributionplugin/) you supply.

TileJSON has no field that reliably distinguishes raster imagery from vector tiles, so the target source `type` (`"raster-tile"` or `"vector-tile"`) is declared by the caller.

## Usage

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { AttributionPlugin, TileJsonPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container });

// TileJsonPlugin surfaces each document's `attribution` through this plugin,
// so an AttributionPlugin is required. Register it separately — the caller
// owns its lifecycle.
const attribution = new AttributionPlugin();
const tilejson = new TileJsonPlugin({ attribution });

view.addPlugin(new DefaultPlugin());
view.addPlugin(attribution);
view.addPlugin(tilejson);
await view.init();

// Fetch a TileJSON document and register it as a raster source. The document's
// `minzoom` / `maxzoom` / `scheme` are forwarded to the source, and its
// `attribution` is shown by the AttributionPlugin.
const source = await tilejson.addSource({
  type: "raster-tile",
  id: "basemap",
  url: "https://example.com/tiles.json",
});

// Reference the source by the returned handle...
view.addLayer({ type: "raster", source });
// ...or directly by the id passed above.
view.addLayer({ type: "raster", source: "basemap" });
```

## Constructor

```typescript
new TileJsonPlugin(options: TileJsonPluginOptions)
```

Register the plugin with `view.addPlugin()` **before** `view.init()`.

### TileJsonPluginOptions

| Property      | Type                | Description                                                                                                                                                        |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attribution` | `AttributionPlugin` | AttributionPlugin used to surface each TileJSON's `attribution` credit. Required. Its lifecycle is the caller's responsibility — register it via `view.addPlugin()`. |

The supplied AttributionPlugin should be dedicated to TileJSON-sourced credits: the plugin renders its collected credits by replacing the shown list, so it does not compose with other callers of the same AttributionPlugin.

## Methods

### addSource(desc)

```typescript
addSource(desc: TileJsonSourceDescription): Promise<Source>
```

Fetches the TileJSON document at `desc.url`, then creates one source of the requested `desc.type` from it. Must be called **after** `view.init()`; otherwise the call throws.

The mapping from the document to the created source is:

| TileJSON field | `raster-tile` source | `vector-tile` source |
| -------------- | -------------------- | -------------------- |
| `tiles[0]`     | `url`                | `url`                |
| `minzoom`      | `minZoom`            | — (engine has no field) |
| `maxzoom`      | `maxZoom`            | `maxZoom`            |
| `scheme: "tms"`| `tms: true`          | — (engine has no field) |
| `attribution`  | shown via AttributionPlugin | shown via AttributionPlugin |

A TileJSON `tiles` array may list several mirror endpoints for the same tileset. Navara sources take a single URL, so only the first endpoint is used; any extra endpoints are ignored with a `console.warn`.

The document's `attribution` credit is collected and shown through the AttributionPlugin. Credits from multiple `addSource()` calls are merged and de-duplicated, so calling the same AttributionPlugin repeatedly keeps a single combined list.

Returns the created [`Source`](../../three/source/about/) handle. Layers can reference it either by the returned handle or by `desc.id`.

### dispose()

```typescript
dispose(): void
```

Clears the credits this plugin collected. The supplied AttributionPlugin is **not** disposed — it is owned by the caller, so dispose it yourself when tearing down the view.

## Types

### TileJsonSourceType

```typescript
type TileJsonSourceType = "raster-tile" | "vector-tile";
```

Which Navara source type a TileJSON document is materialized into. Declared by the caller because TileJSON has no field that reliably distinguishes raster imagery from vector tiles.

### TileJsonSourceDescription

| Property | Type                  | Description                                                                                                     |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `type`   | `TileJsonSourceType`  | Navara source type to create, as in `addSource`.                                                              |
| `url`    | `string`              | URL of the TileJSON 3.0.0 document to fetch and expand (not a tile template).                                 |
| `id`     | `string \| undefined` | Optional caller-provided source id. Handy for referencing the source from layers by id without holding the returned handle. When omitted, the engine generates one. |

### TileJson

The subset of a TileJSON 3.0.0 document this plugin consumes. Other spec fields (`bounds`, `center`, `grids`, …) are ignored.

| Property      | Type                  | Default  | Description                                                                    |
| ------------- | --------------------- | -------- | ------------------------------------------------------------------------------ |
| `tilejson`    | `string`              | —        | Semver of the TileJSON spec the document conforms to, e.g. `"3.0.0"`. Required. |
| `tiles`       | `string[]`            | —        | Tile URL templates (`{z}/{x}/{y}`). Required and non-empty per the spec.        |
| `attribution` | `string \| undefined` | —        | Attribution / credit HTML shown through the AttributionPlugin.                 |
| `minzoom`     | `number \| undefined` | `0`      | Minimum zoom level. Applied to raster sources only.                            |
| `maxzoom`     | `number \| undefined` | `30`     | Maximum zoom level.                                                            |
| `scheme`      | `"xyz" \| "tms"`      | `"xyz"`  | Tiling scheme. `"tms"` flips the Y axis (raster sources only).                 |

The document is validated when fetched: `addSource()` rejects if `tilejson` is missing or is not a `major.minor.patch` version, or if `tiles` is missing or empty.

## Notes

- **The document URL, not a tile template.** `desc.url` is the address of the TileJSON JSON document. The tile URL template comes from the document's `tiles` field — don't pass a `{z}/{x}/{y}` template here.
- **The source `type` is your choice.** TileJSON does not mark a tileset as raster or vector, so pick `"raster-tile"` or `"vector-tile"` to match the tiles the document serves.
- **Vector sources ignore `minzoom` and `scheme`.** The engine's vector-tile source has no `minZoom` or `tms` field, so only `maxzoom` carries over for `"vector-tile"`.

## Related Resources

- [AttributionPlugin](../attributionplugin/) — Data attribution (credit) UI, required by this plugin
- [About three_plugins](../about/) — Package overview
- [Raster Layer](../../three/layer/raster-layer/) — Raster layer reference
