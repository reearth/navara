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
- surfaces the document's `attribution` credit through the view's built-in attribution UI ([`view.attribution`](../../three/plugins/attributionplugin/)) automatically.

TileJSON has no field that reliably distinguishes raster imagery from vector tiles, so the target source `type` (`"raster-tile"` or `"vector-tile"`) is declared by the caller.

To build a custom credit UI instead, opt out of the built-in one (`new ThreeView({ defaultAttribution: false })`) and read each document's attribution from the [`loaded`](#events) event.

## Usage

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

const view = new ThreeView({ container });

const tilejson = new TileJsonPlugin();

view.addPlugin(new DefaultPlugin());
view.addPlugin(tilejson);
await view.init();

// Fetch a TileJSON document and register it as a raster source. The document's
// `minzoom` / `maxzoom` / `scheme` are forwarded to the source, and its
// `attribution` is shown by the built-in attribution UI.
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
new TileJsonPlugin();
```

Register the plugin with `view.addPlugin()` **before** `view.init()`. The constructor takes no options: attribution is handled through the view's built-in UI, and callers who want a custom UI subscribe to the [`loaded`](#events) event.

## Methods

### addSource(desc)

```typescript
addSource(desc: TileJsonSourceDescription): Promise<Source>
```

Fetches the TileJSON document at `desc.url`, then creates one source of the requested `desc.type` from it. Must be called **after** `view.init()`; otherwise the call throws.

The mapping from the document to the created source is:

| TileJSON field  | `raster-tile` source         | `vector-tile` source         |
| --------------- | ---------------------------- | ---------------------------- |
| `tiles[0]`      | `url`                        | `url`                        |
| `minzoom`       | `minZoom`                    | — (engine has no field)      |
| `maxzoom`       | `maxZoom`                    | `maxZoom`                    |
| `scheme: "tms"` | `tms: true`                  | — (engine has no field)      |
| `attribution`   | shown via `view.attribution` | shown via `view.attribution` |

A TileJSON `tiles` array may list several mirror endpoints for the same tileset. Navara sources take a single URL, so only the first endpoint is used; any extra endpoints are ignored with a `console.warn`.

`attribution` credit is added to the view's built-in attribution UI (`view.attribution`). Credits from multiple `addSource()` calls are de-duplicated, so a shared or repeated credit renders once. When the built-in UI is disabled (`defaultAttribution: false`), this step is skipped — read the attribution from the [`loaded`](#events) event instead.

After the source is registered, a [`loaded`](#events) event fires with the created source, the parsed document, and its attribution.

Returns the created [`Source`](../../three/source/about/) handle. Layers can reference it either by the returned handle or by `desc.id`.

### on / once / off

```typescript
on<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
once<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
off<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
```

Subscribe to, subscribe once to, or unsubscribe from a plugin [event](#events). See [`loaded`](#events) for the payload.

### dispose()

```typescript
dispose(): void
```

Removes the credits this plugin contributed to `view.attribution` (matched structurally by their HTML) and drops all event listeners. The built-in UI is owned by the view, not the plugin, so only this plugin's own credits are removed — not the whole UI. When the view is disposed first, `view.attribution` is already gone and this is a no-op.

## Events

Subscribe with [`on`](#on--once--off) / `once` and unsubscribe with `off`.

### loaded

Fires once per successful `addSource()`, after the source is registered. Its payload lets callers drive a custom credit UI without relying on the built-in one.

| Property      | Type                  | Description                                              |
| ------------- | --------------------- | -------------------------------------------------------- |
| `source`      | `Source`              | The Navara source created for the document.              |
| `tilejson`    | `TileJson`            | The fetched and validated TileJSON document.             |
| `attribution` | `string \| undefined` | The document's `attribution` HTML, when it declares one. |

```typescript
const view = new ThreeView({ container, defaultAttribution: false });
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);
await view.init();

tilejson.on("loaded", ({ source, attribution }) => {
  if (attribution) renderMyCredit(source.id, attribution);
});
```

## Types

### TileJsonSourceType

```typescript
type TileJsonSourceType = "raster-tile" | "vector-tile";
```

Which Navara source type a TileJSON document is materialized into. Declared by the caller because TileJSON has no field that reliably distinguishes raster imagery from vector tiles.

### TileJsonSourceDescription

| Property | Type                  | Description                                                                                                                                                         |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`   | `TileJsonSourceType`  | Navara source type to create, as in `addSource`.                                                                                                                    |
| `url`    | `string`              | URL of the TileJSON 3.0.0 document to fetch and expand (not a tile template).                                                                                       |
| `id`     | `string \| undefined` | Optional caller-provided source id. Handy for referencing the source from layers by id without holding the returned handle. When omitted, the engine generates one. |

### TileJsonLoadedEvent

Payload of the [`loaded`](#loaded) event. See the table above.

### TileJson

The subset of a TileJSON 3.0.0 document this plugin consumes. Other spec fields (`bounds`, `center`, `grids`, …) are ignored.

| Property      | Type                  | Default | Description                                                                     |
| ------------- | --------------------- | ------- | ------------------------------------------------------------------------------- |
| `tilejson`    | `string`              | —       | Semver of the TileJSON spec the document conforms to, e.g. `"3.0.0"`. Required. |
| `tiles`       | `string[]`            | —       | Tile URL templates (`{z}/{x}/{y}`). Required and non-empty per the spec.        |
| `attribution` | `string \| undefined` | —       | Attribution / credit HTML shown through the view's built-in attribution UI.     |
| `minzoom`     | `number \| undefined` | `0`     | Minimum zoom level. Applied to raster sources only.                             |
| `maxzoom`     | `number \| undefined` | `30`    | Maximum zoom level.                                                             |
| `scheme`      | `"xyz" \| "tms"`      | `"xyz"` | Tiling scheme. `"tms"` flips the Y axis (raster sources only).                  |

The document is validated when fetched: `addSource()` rejects if `tilejson` is missing or is not a `major.minor.patch` version, or if `tiles` is missing or empty.

## Notes

- **The document URL, not a tile template.** `desc.url` is the address of the TileJSON JSON document. The tile URL template comes from the document's `tiles` field — don't pass a `{z}/{x}/{y}` template here.
- **The source `type` is your choice.** TileJSON does not mark a tileset as raster or vector, so pick `"raster-tile"` or `"vector-tile"` to match the tiles the document serves.
- **Vector sources ignore `minzoom` and `scheme`.** The engine's vector-tile source has no `minZoom` or `tms` field, so only `maxzoom` carries over for `"vector-tile"`.

## Related Resources

- [AttributionPlugin](../../three/plugins/attributionplugin/) — the built-in attribution (credit) UI reached via `view.attribution`, which this plugin feeds by default
- [About three_plugins](../about/) — Package overview
- [Raster Layer](../../three/layer/raster-layer/) — Raster layer reference

