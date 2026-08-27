---
title: Vector Layer
description: Render a geojson or vector-tile source with per-geometry materials
sidebar:
  order: 410
---

A `vector` layer renders the features of a [`geojson`](../../../three/source/geojson-source/) or [`vector-tile`](../../../three/source/vector-tile-source/) source with per-geometry materials (points, lines, polygons, and so on).

## Properties

| Property       | Type                    | Description                                                                                          |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `type`         | `"vector"`              | Layer type (required).                                                                               |
| `source`       | `Source \| string`      | The `geojson` / `vector-tile` source to render (required).                                           |
| `sourceLayers` | `string[]`              | For `vector-tile` sources: which source layers within the tileset to render. Ignored for GeoJSON.   |

### Render options (materials)

Specify one or more, depending on the geometry types present:

| Material                                                                     | Config key  | Default geometry              |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------- |
| [PointMaterial](../../../three/material/point-material/)               | `point`     | Point, MultiPoint             |
| [BillboardMaterial](../../../three/material/billboard-material/)       | `billboard` | Point (icon display)          |
| [TextMaterial](../../../three/material/text-material/)                 | `text`      | Point (label display)         |
| [PolylineMaterial](../../../three/material/polyline-material/)         | `polyline`  | LineString, MultiLineString   |
| [PolygonMaterial](../../../three/material/polygon-material/)           | `polygon`   | Polygon, MultiPolygon         |

By default each material renders only the geometry listed above. The `geometryTypes` option widens this per material, so one source geometry can render as several representations at once. See [Deriving representations with geometryTypes](#deriving-representations-with-geometrytypes).

## Examples

### GeoJSON features

```typescript
import ThreeView, { Color } from "@navaramap/three";

const view = new ThreeView(/* options */);
await view.init();

const points = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [139.7051, 35.6927] },
      },
    ],
  },
});

view.addLayer({
  type: "vector",
  source: points,
  point: {
    color: new Color().setHex(0xffffff),
    size: 0.1,
    sizeInMeters: true,
    clampToGround: true,
  },
});
```

### Vector tiles with a sub-layer filter

Reference one `vector-tile` source from several layers and pick which source layers each one renders with `sourceLayers`. Because they share a source, the tiles are fetched only once.

```typescript
const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/tiles/{z}/{x}/{y}.mvt",
  maxZoom: 16,
});

// Water areas
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

// Buildings
view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555"), clampToGround: true },
});
```

### Deriving representations with geometryTypes

The `point`, `billboard`, `text`, and `polyline` materials accept a `geometryTypes` array listing the source geometry categories they consume: `"point"`, `"line"`, or `"polygon"`. When the array is omitted, each material consumes only its native category (`["point"]` for point-like materials and `["line"]` for `polyline`). Setting the array replaces the default, so include the native category when you still want it.

Derivation is downward only:

- `polyline` with `"polygon"`: every polygon boundary ring (the outer ring and any holes) renders as a closed polyline at the ring's base height. Extruded side edges are not included, so use the polygon material's [`outline`](../../../three/material/polygon-material/#outline) for extruded polygons.
- `point` / `billboard` / `text` with `"line"`: one point per line-string vertex.
- `point` / `billboard` / `text` with `"polygon"`: one point per polygon-ring vertex (the closing duplicate vertex is skipped).

```typescript
// Data mixing LineString and Polygon features:
// polygons render filled with their boundaries stroked, and
// lines render as polylines with the same material.
view.addLayer({
  type: "vector",
  source,
  polygon: { color: new Color().setStyle("#2d6a4f"), clampToGround: true },
  polyline: {
    color: new Color().setStyle("#ffffff"),
    width: 2,
    clampToGround: true,
    geometryTypes: ["line", "polygon"],
  },
});
```

Each derived representation is a full-featured instance of its material. A boundary polyline supports `width`, `clampToGround`, and per-feature styling exactly like a polyline built from line geometry, and it carries the source feature's properties.

`geometryTypes` applies when geometry is built, so set it at layer creation. Calling `layer.update()` with a new value only affects tiles loaded afterwards. Tiles already on screen keep the geometry they were built with, so re-create the layer to change the derivation everywhere.

On tiled rendering paths (vector tile sources, or materials with `tiled` / `clampToGround`), derivation walks each tile's clipped rings. Boundary polylines handle this automatically: edges introduced by tile clipping are dropped, so tile outlines never render through polygon interiors. Points derived from polygons on vector tiles can still appear at clip-introduced vertices near tile edges; if that matters, prefer an untiled GeoJSON layer for point derivation.

## Related Resources

- [GeoJSON Source](../../../three/source/geojson-source/) / [Vector Tile Source](../../../three/source/vector-tile-source/)
- [PointMaterial](../../../three/material/point-material/) / [PolygonMaterial](../../../three/material/polygon-material/) / [PolylineMaterial](../../../three/material/polyline-material/): detailed material settings
