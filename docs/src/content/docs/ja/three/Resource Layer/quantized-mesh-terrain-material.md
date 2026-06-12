---
title: QuantizedMeshTerrainMaterial
description: navara_three の quantized-mesh 地形マテリアル
sidebar:
  order: 41
---

`QuantizedMeshTerrainMaterial` は、[quantized-mesh](https://github.com/CesiumGS/quantized-mesh) タイルエンドポイントから地形をレンダリングするためのマテリアルです。[Terrain Layer](../../../three/resource-layer/terrain-layer/) の `quantizedMesh` キーで指定して使用します。

Cesium Ion のアセットを利用する場合は、エンドポイントの解決とアクセストークンの受け渡しを行ってくれる [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) の使用を推奨します。

## プロパティ

### castShadow

**型:** `boolean | undefined`

**説明:** 地形が影を落とすかどうかを指定します。

**デフォルト:** `false`

**例:**

```typescript
{
  quantizedMesh: {
    castShadow: true
  }
}
```

### geographic

**型:** `boolean | undefined`

**説明:** ソースエンドポイントが地理座標系（EPSG:4326）のタイルスキームを使用するかどうか。Cesium Ion の quantized-mesh レイヤーは geographic です。多くのセルフホストレイヤーも同様です。

**デフォルト:** `true`

**例:**

```typescript
{
  quantizedMesh: {
    geographic: true
  }
}
```

### maxZoom

**型:** `number | undefined`

**説明:** エンドポイントから取得する最大ズームレベルを指定します。これを超えるズームレベルではタイルをリクエストしません。

**例:**

```typescript
{
  quantizedMesh: {
    maxZoom: 18
  }
}
```

### minZoom

**型:** `number | undefined`

**説明:** エンドポイントから取得する最小ズームレベルを指定します。

**例:**

```typescript
{
  quantizedMesh: {
    minZoom: 0
  }
}
```

### overscaledMaxZoom

**型:** `number | undefined`

**説明:** 取得可能な最深ズームレベルのタイルから、このズームレベルに達するまで地形をアップサンプリングします。

**デフォルト:** `24`

**例:**

```typescript
{
  quantizedMesh: {
    overscaledMaxZoom: 20
  }
}
```

### receiveShadow

**型:** `boolean | undefined`

**説明:** 地形が影を受けるかどうかを指定します。

**デフォルト:** `false`

**例:**

```typescript
{
  quantizedMesh: {
    receiveShadow: true
  }
}
```

### requestVertexNormals

**型:** `boolean | undefined`

**説明:** タイルリクエストに `octvertexnormals` 拡張を付与し、エンドポイントから頂点ごとの法線を要求します。quantized-mesh データから地形に陰影を付けるために必要で、指定しない場合は地表に対する陰影計算が行われません。

**デフォルト:** `false`

**例:**

```typescript
{
  quantizedMesh: {
    requestVertexNormals: true
  }
}
```

### requestWaterMask

**型:** `boolean | undefined`

**説明:** タイルリクエストに `watermask` 拡張を付与し、エンドポイントからウォーターマスクを要求します。

**デフォルト:** `false`

**例:**

```typescript
{
  quantizedMesh: {
    requestWaterMask: true
  }
}
```

### show

**型:** `boolean | undefined`

**説明:** 地形を表示するかどうかを指定します。

**デフォルト:** `true`

**例:**

```typescript
{
  quantizedMesh: {
    show: true
  }
}
```

### showBoundingBox

**型:** `boolean | undefined`

**説明:** タイルごとのバウンディングボックスを表示するかどうかを指定します。デバッグ用途です。

**デフォルト:** `false`
**例:**

```typescript
{
  quantizedMesh: {
    showBoundingBox: true
  }
}
```

### skirt

**型:** `boolean | undefined`

**説明:** 異なる LOD の隣接タイル間に生じる隙間を隠すため、タイル境界に沿ってスカートを描画するかどうかを指定します。

**デフォルト:** `true`

**例:**

```typescript
{
  quantizedMesh: {
    skirt: true
  }
}
```

### skirtExaggeration

**型:** `number | undefined`

**説明:** 自動計算されるスカート高さに適用する倍率です。`1.0` で計算値そのままになります。

**デフォルト:** `1.0`

**例:**

```typescript
{
  quantizedMesh: {
    skirtExaggeration: 1.5
  }
}
```

### tms

**型:** `boolean | undefined`

**説明:** ソースエンドポイントが TMS タイル座標（y 軸が反転）を使用するかどうか。Cesium Ion の quantized-mesh レイヤーは TMS です。

**デフォルト:** `true`

**例:**

```typescript
{
  quantizedMesh: {
    tms: true
  }
}
```

### token

**型:** `string | undefined`

**説明:** タイルリクエストに付与するアクセストークンです。[CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) を利用する場合は、解決済みの Cesium Ion エンドポイントからプラグインが自動で補うため、手動で設定する必要はありません。

**例:**

```typescript
{
  quantizedMesh: {
    token: "<endpoint access token>"
  }
}
```

## 関連リソース

- [Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) - Terrain レイヤーの概要と使い方
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - ラスター PNG/WebP DEM 向け地形マテリアル
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - Cesium Ion の quantized-mesh アセットを扱う高レベルプラグイン
