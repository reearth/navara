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

| Material                                                                     | Config key  | Supported geometry            |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------- |
| [PointMaterial](../../../three/material/point-material/)               | `point`     | Point, MultiPoint             |
| [BillboardMaterial](../../../three/material/billboard-material/)       | `billboard` | Point (icon display)          |
| [TextMaterial](../../../three/material/text-material/)                 | `text`      | Point (label display)         |
| [PolylineMaterial](../../../three/material/polyline-material/)         | `polyline`  | LineString, MultiLineString   |
| [PolygonMaterial](../../../three/material/polygon-material/)           | `polygon`   | Polygon, MultiPolygon         |

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

## Related Resources

- [GeoJSON Source](../../../three/source/geojson-source/) / [Vector Tile Source](../../../three/source/vector-tile-source/)
- [PointMaterial](../../../three/material/point-material/) / [PolygonMaterial](../../../three/material/polygon-material/) / [PolylineMaterial](../../../three/material/polyline-material/) — detailed material settings
