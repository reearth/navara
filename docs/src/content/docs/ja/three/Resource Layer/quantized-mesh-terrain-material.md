---
title: QuantizedMeshTerrainMaterial
description: navara_three の quantized-mesh 地形マテリアル
sidebar:
  order: 41
---

`QuantizedMeshTerrainMaterial` は、[quantized-mesh](https://github.com/CesiumGS/quantized-mesh) タイルエンドポイントから地形をレンダリングするためのマテリアルです。[Terrain Layer](../../../three/resource-layer/terrain-layer/) の `quantizedMesh` キーで指定して使用します。

Cesium Ion のアセットを利用する場合は、エンドポイントの解決とアクセストークンの受け渡しを行ってくれる [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) の使用を推奨します。

## 対応仕様

Navara は quantized-mesh 形式のうち以下に対応しています。

### タイル形式

| 機能                        | 説明                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| quantized-mesh (`.terrain`) | XYZ エンドポイントで配信される、メッシュ化済みの地形タイル（[quantized-mesh 1.0](https://github.com/CesiumGS/quantized-mesh)） |

### 拡張

| 拡張                            | 有効化方法             | 説明                                                                            |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Oct-Encoded Per-Vertex Normals  | `requestVertexNormals` | リクエストに `octvertexnormals` を付与します。地形表面に陰影（ライティング）を付けるために必要です。 |
| Water Mask                      | `requestWaterMask`     | リクエストに `watermask` を付与します。表面で陸と水を区別します。                |

### タイリングスキーム

| スキーム                | 有効化方法                   | 備考                                                                  |
| ----------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Geographic (EPSG:4326)  | `geographic: true`（既定）   | Cesium World Terrain や多くのセルフホストエンドポイント。ルート 2 つ、等緯度、±90°。 |
| WebMercator (EPSG:3857) | `geographic: false`          | WebMercator グリッドで配信されるエンドポイント向け。ルート 1 つ、±85.05°。 |

`tms` フラグは、エンドポイントが TMS タイル座標（y 軸が反転）を使用するかどうかを制御します。Cesium Ion のレイヤーは TMS で、これが既定値です。

## 他レイヤーとの併用

quantized-mesh 地形レイヤーは 3D サーフェスを提供します。その上に他のレイヤーを重ねて表示できます。

| レイヤー                                                               | 併用             | 備考                                                                                          |
| ---------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| [Tile Layer](../../../three/resource-layer/tile-layer/)（`rasterTile`） | ✅ 可            | ラスター画像（航空写真、衛星画像、地図タイル）を再投影し、地形メッシュにドレープします。複数のラスターレイヤーを重ねられます。 |
| [Tile Layer](../../../three/resource-layer/tile-layer/)（`hillshade`）  | ✅ 可            | DEM タイルから計算した陰影起伏を 3D サーフェス上に描画します。                                 |
| [MVT Layer](../../../three/resource-layer/mvt-layer/)（ベクタータイル） | ❌ 現状未対応    | ベクタータイルは現状 quantized-mesh 地形にドレープできません。                                 |

ラスタータイルは WebMercator、Geographic の quantized-mesh 地形は等緯度のため、1 つの地形タイルが複数のラスタータイルにまたがります。Navara はこの重なりを解決し、各ラスタータイルをフラグメント単位で再投影するため、Geographic 地形上でもラスター画像が正しく整列します。例については [Terrain Layer › ラスター画像との併用](../../../three/resource-layer/terrain-layer/#ラスター画像との併用) を参照してください。

:::note
ラスター画像（WebMercator）は約 ±85.05° までしか存在しませんが、Geographic 地形は ±90° まで到達します。極付近では、利用可能な最後の画像行を極冠まで引き伸ばすことで、表面が空白にならないようにしています。
:::

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

- [Terrain Layer](../../../three/resource-layer/terrain-layer/) - Terrain レイヤーの概要と使い方
- [RasterTerrainMaterial](../../../three/resource-layer/raster-terrain-material/) - ラスター PNG/WebP DEM 向け地形マテリアル
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - Cesium Ion の quantized-mesh アセットを扱う高レベルプラグイン
