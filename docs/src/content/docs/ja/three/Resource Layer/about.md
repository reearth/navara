---
title: About
description: リソースレイヤーの概要と共通設定
sidebar:
  order: 20
---

リソースレイヤーは、外部データソースから地理データを読み込んで表示するレイヤーです。GeoJSON、3D Tiles、地形データなど、様々なデータフォーマットに対応しています。

## 共通プロパティ

すべてのリソースレイヤーは以下の共通プロパティを持ちます：

### type

**Type:** `string`

**Description:** データフォーマットを指定します。レイヤーの種類を決定する必須プロパティです。

| 値                | 説明                 |
| ----------------- | -------------------- |
| `"geojson"`       | GeoJSON フォーマット |
| `"terrain"`       | 地形データ           |
| `"tiles"`         | ラスタータイル       |
| `"cesium3dtiles"` | Cesium 3D Tiles      |
| `"mvt"`           | Mapbox Vector Tiles  |

### data

**Type:** `DataSource`

**Description:** データソースの URL やインラインデータを指定します。

```typescript
// URL 指定
data: { url: "https://example.com/data.geojson" }

// インラインデータ（GeoJSON のみ）
data: {
  type: "FeatureCollection",
  features: [...]
}
```

## レイヤータイプ一覧

### [Cesium 3D Tiles Layer](../../../three/resource-layer-reference/cesium3dtiles-layer/)

**用途:** Cesium 3D Tiles データ用
**対応マテリアル:** ModelMaterial

### [GeoJSON Layer](../../../three/resource-layer-reference/geojson-layer/)

**用途:** GeoJSON フォーマットデータ用
**対応マテリアル:** PointMaterial, BillboardMaterial, TextMaterial, PolylineMaterial, PolygonMaterial, ModelMaterial

### [MVT Layer](../../../three/resource-layer-reference/mvt-layer/)

**用途:** Mapbox Vector Tiles（MVT）データ用
**対応マテリアル:** PointMaterial, BillboardMaterial, TextMaterial, PolylineMaterial, PolygonMaterial, VectorTileMaterial

### [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/)

**用途:** 地形・標高データ用
**対応マテリアル:** RasterTerrainMaterial

### [Tile Layer](../../../three/resource-layer-reference/tile-layer/)

**用途:** ラスタータイルデータ用
**対応マテリアル:** RasterTileMaterial, ElevationHeatmapMaterial

## マテリアル一覧

リソースレイヤーでは、データフォーマットに応じて以下のマテリアルを指定できます。各マテリアルはレイヤー設定内の対応するキーで指定します。

### [BillboardMaterial](../../../three/resource-layer-reference/billboard-material/)

**用途:** ビルボードレンダリング用
**設定キー:** `billboard`
**対応レイヤー:** GeoJSON Layer, MVT Layer

### [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/)

**用途:** 標高ヒートマップレンダリング用
**設定キー:** `elevationHeatmap`
**対応レイヤー:** Tile Layer

### [ModelMaterial](../../../three/resource-layer-reference/model-material/)

**用途:** 3D モデルレンダリング用
**設定キー:** `model`
**対応レイヤー:** Cesium 3D Tiles Layer

### [PointMaterial](../../../three/resource-layer-reference/point-material/)

**用途:** ポイントジオメトリレンダリング用
**設定キー:** `point`
**対応レイヤー:** GeoJSON Layer, MVT Layer

### [PolygonMaterial](../../../three/resource-layer-reference/polygon-material/)

**用途:** ポリゴンジオメトリレンダリング用
**設定キー:** `polygon`
**対応レイヤー:** GeoJSON Layer, MVT Layer

### [PolylineMaterial](../../../three/resource-layer-reference/polyline-material/)

**用途:** ポリラインジオメトリレンダリング用
**設定キー:** `polyline`
**対応レイヤー:** GeoJSON Layer, MVT Layer

### [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/)

**用途:** ラスター地形レンダリング用
**設定キー:** `rasterTerrain`
**対応レイヤー:** Terrain Layer

### [RasterTileMaterial](../../../three/resource-layer-reference/raster-tile-material/)

**用途:** ラスタータイルレンダリング用
**設定キー:** `rasterTile`
**対応レイヤー:** Tile Layer

### [TextMaterial](../../../three/resource-layer-reference/text-material/)

**用途:** テキストラベルレンダリング用
**設定キー:** `text`
**対応レイヤー:** GeoJSON Layer, MVT Layer

### [VectorTileMaterial](../../../three/resource-layer-reference/vector-tile-material/)

**用途:** ベクタータイルレンダリング用
**設定キー:** `vectorTile`
**対応レイヤー:** MVT Layer

## 使用例

```typescript
// GeoJSON レイヤー（複数のマテリアルを指定）
const geoJsonLayer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});

// 地形レイヤー
const terrainLayer = view.addLayer({
  type: "terrain",
  data: { url: "https://example.com/terrain/{z}/{x}/{y}.png" },
  rasterTerrain: { exaggeration: 1.5 },
});

// 3D Tiles レイヤー
const tilesLayer = view.addLayer({
  type: "cesium3dtiles",
  data: { url: "https://example.com/tileset.json" },
  model: { opacity: 1.0 },
});
```

## 関連リソース

- [About Layer](../../../three/introduction/about-layer/) - レイヤーの概念
- [Layer Types](../../../three/api-reference/desc-types/) - Layer クラスの API リファレンス
