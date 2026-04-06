---
title: About
description: Overview and common settings for resource layers
sidebar:
  order: 20
---

Resource layers are layers that load and display geographic data from external data sources. They support various data formats such as GeoJSON, 3D Tiles, terrain data, and more.

## Common Properties

All resource layers have the following common properties:

### type

**Type:** `string`

**Description:** Specifies the data format. This is a required property that determines the type of layer.

| Value             | Description          |
| ----------------- | -------------------- |
| `"geojson"`       | GeoJSON format       |
| `"terrain"`       | Terrain data         |
| `"tiles"`         | Raster tiles         |
| `"cesium3dtiles"` | Cesium 3D Tiles      |
| `"mvt"`           | Mapbox Vector Tiles  |

### data

**Type:** `DataSource`

**Description:** Specifies the data source URL or inline data.

```typescript
// URL specification
data: { url: "https://example.com/data.geojson" }

// Inline data (GeoJSON only)
data: {
  type: "FeatureCollection",
  features: [...]
}
```

## Layer Types

### [Cesium 3D Tiles Layer](../../../three/resource-layer-reference/cesium3dtiles-layer/)

**Use case:** For Cesium 3D Tiles data
**Supported materials:** ModelMaterial

### [GeoJSON Layer](../../../three/resource-layer-reference/geojson-layer/)

**Use case:** For GeoJSON format data
**Supported materials:** PointMaterial, BillboardMaterial, TextMaterial, PolylineMaterial, PolygonMaterial, ModelMaterial

### [MVT Layer](../../../three/resource-layer-reference/mvt-layer/)

**Use case:** For Mapbox Vector Tiles (MVT) data
**Supported materials:** PointMaterial, BillboardMaterial, TextMaterial, PolylineMaterial, PolygonMaterial, VectorTileMaterial

### [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/)

**Use case:** For terrain and elevation data
**Supported materials:** RasterTerrainMaterial

### [Tile Layer](../../../three/resource-layer-reference/tile-layer/)

**Use case:** For raster tile data
**Supported materials:** RasterTileMaterial, ElevationHeatmapMaterial

## Materials

For resource layers, you can specify the following materials depending on the data format. Each material is specified using the corresponding key in the layer configuration.

### [BillboardMaterial](../../../three/resource-layer-reference/billboard-material/)

**Use case:** For billboard rendering
**Config key:** `billboard`
**Supported layers:** GeoJSON Layer, MVT Layer

### [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/)

**Use case:** For elevation heatmap rendering
**Config key:** `elevationHeatmap`
**Supported layers:** Tile Layer

### [ModelMaterial](../../../three/resource-layer-reference/model-material/)

**Use case:** For 3D model rendering
**Config key:** `model`
**Supported layers:** Cesium 3D Tiles Layer

### [PointMaterial](../../../three/resource-layer-reference/point-material/)

**Use case:** For point geometry rendering
**Config key:** `point`
**Supported layers:** GeoJSON Layer, MVT Layer

### [PolygonMaterial](../../../three/resource-layer-reference/polygon-material/)

**Use case:** For polygon geometry rendering
**Config key:** `polygon`
**Supported layers:** GeoJSON Layer, MVT Layer

### [PolylineMaterial](../../../three/resource-layer-reference/polyline-material/)

**Use case:** For polyline geometry rendering
**Config key:** `polyline`
**Supported layers:** GeoJSON Layer, MVT Layer

### [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/)

**Use case:** For raster terrain rendering
**Config key:** `rasterTerrain`
**Supported layers:** Terrain Layer

### [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/)

**Use case:** For raster tile rendering
**Config key:** `rasterTile`
**Supported layers:** Tile Layer

### [TextMaterial](../../../three/resource-layer-reference/text-material/)

**Use case:** For text label rendering
**Config key:** `text`
**Supported layers:** GeoJSON Layer, MVT Layer

### [VectorTileMaterial](../../../three/resource-layer-reference/vector-tile-material/)

**Use case:** For vector tile rendering
**Config key:** `vectorTile`
**Supported layers:** MVT Layer

## Usage Examples

```typescript
// GeoJSON layer (with multiple materials)
const geoJsonLayer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});

// Terrain layer
const terrainLayer = view.addLayer({
  type: "terrain",
  data: { url: "https://example.com/terrain/{z}/{x}/{y}.png" },
  rasterTerrain: { exaggeration: 1.5 },
});

// 3D Tiles layer
const tilesLayer = view.addLayer({
  type: "cesium3dtiles",
  data: { url: "https://example.com/tileset.json" },
  model: { opacity: 1.0 },
});
```

## Related Resources

- [About Layer](../../../three/introduction/about-layer/) - Layer concepts
- [Layer Types](../../../three/api-reference/layer-types/) - Layer class API reference
