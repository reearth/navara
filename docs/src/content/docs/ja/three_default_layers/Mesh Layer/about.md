---
title: Mesh Layer
description: Mesh layer types for navara_three
sidebar:
  order: 100
---

`MeshLayer`は、3Dメッシュオブジェクトをシーンに追加するためのレイヤータイプです。様々な3Dオブジェクトを表示できます。

## 利用可能なMeshLayerタイプ

navara_threeでは、以下のMeshLayerタイプが利用可能です:

| レイヤータイプ | 説明 |
|------------|------|
| [ArclineMeshLayer](./arcline-mesh-layer) | 2点間を結ぶアーク状のラインを描画するレイヤー |
| [BoxMeshLayer](./box-mesh-layer) | 立方体(Box)ジオメトリを描画するレイヤー |
| [InstancedBoxMeshLayer](./instanced-box-mesh-layer) | GPU インスタンシングを使用して複数のボックスを1回の描画コールでレンダリングするレイヤー |
| [CylinderMeshLayer](./cylinder-mesh-layer) | 円柱(Cylinder)ジオメトリを描画するレイヤー |
| [GLTFModelLayer](./gltf-model-layer) | GLTF/GLB形式の3Dモデルを読み込み・表示するレイヤー |
| [GlowGlobeMeshLayer](./glow-globe-mesh-layer) | 地球の周りにフレネル効果による光彩(グロー)を表示するレイヤー |
| [PlaneMeshLayer](./plane-mesh-layer) | 平面(Plane)ジオメトリを描画するレイヤー |
| [RainMeshLayer](./rain-mesh-layer) | 雨のパーティクルエフェクトを表示するレイヤー |
| [SkyBoxMeshLayer](./sky-box-mesh-layer) | シンプルなスカイボックスを描画するレイヤー |
| [SkyMeshLayer](./sky-mesh-layer) | 大気散乱による空と太陽・月を描画するレイヤー |
| [SmoothLineMeshLayer](./smooth-line-mesh-layer) | カトマル・ロム曲線による滑らかなラインを描画するレイヤー |
| [SnowMeshLayer](./snow-mesh-layer) | 雪のパーティクルエフェクトを表示するレイヤー |
| [SphereMeshLayer](./sphere-mesh-layer) | 球体(Sphere)ジオメトリを描画するレイヤー |
| [StarsLayer](./stars-layer) | 星空を描画するレイヤー |
| [TubeMeshLayer](./tube-mesh-layer) | チューブ(Tube)ジオメトリを描画するレイヤー |
| [AxesHelperLayer](./axes-helper-layer) | 3軸を可視化するデバッグ用ヘルパーレイヤー |
| [ArrowHelperLayer](./arrow-helper-layer) | ベクトル方向を可視化するデバッグ用ヘルパーレイヤー |

## 基本的な使い方

MeshLayerは、レイヤークラスを登録した後、`view.addLayer()`メソッドに`type: "mesh"`を指定して追加します:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// レイヤークラスを登録
view.registerMesh("box", BoxMeshLayer);

await view.init();

// BoxMeshLayerを追加
const boxLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

## 共通プロパティ

すべてのMeshLayerは、以下の基本設定を持ちます:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | 自動生成 | レイヤーの一意な識別子 |
| `visible` | `boolean` | `true` | レイヤーの表示/非表示を切り替え |
| `position` | `{ x: number, y: number, z: number }` | - | メッシュの位置（ECEF座標系） |
| `rotation` | `{ x: number, y: number, z: number }` | - | メッシュの回転（Euler角、ラジアン） |
| `scale` | `{ x: number, y: number, z: number }` | - | メッシュのスケール |

## 座標変換

MeshLayerの`position`プロパティはECEF（Earth-Centered, Earth-Fixed）座標系を使用します。緯度・経度・高度（測地座標系）からECEF座標系に変換するには、`geodeticToVector3()`関数を使用します。

:::note
緯度・経度は**ラジアン**で指定する必要があります。度からラジアンに変換するには`degreeToRadian()`を使用してください。
:::

### 基本的な座標変換

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three";
import { SphereMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshLayer);
await view.init();

// 緯度・経度・高度からECEF座標に変換
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // 緯度（ラジアン）
  lng: degreeToRadian(139.767125), // 経度（ラジアン）
  height: 200,                      // 高度（メートル）
});

// 変換した座標でメッシュレイヤーを追加
const sphereLayer = view.addLayer<SphereMeshLayer>({
  type: "mesh",
  sphere: {
    radius: 100,
    color: new Color().setHex(0x00aaff),
  },
  position: {
    x: position.x,
    y: position.y,
    z: position.z,
  },
});
```

### 地表面に沿った回転の設定

メッシュを地球表面に沿って配置するには、`geodeticSurfaceNormal()`で地表面の法線ベクトルを取得し、回転を計算します。

```typescript
import {
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
} from "@navara/three";
import { GLTFModelLayer } from "@navara/three_default_layers";
import { Vector3, Quaternion, Euler } from "three";

// GLTFModelLayer が登録済みであること

// 位置を計算
const lat = degreeToRadian(35.681236);
const lng = degreeToRadian(139.767125);
const height = 0;

const position = geodeticToVector3({ lat, lng, height });

// 地表面の法線ベクトルを取得
const normal = geodeticSurfaceNormal({ lat, lng, height });

// Y軸（上方向）を法線に合わせる回転を計算
const up = new Vector3(0, 1, 0);
const quaternion = new Quaternion().setFromUnitVectors(up, normal);
const euler = new Euler().setFromQuaternion(quaternion);

// モデルを地表面に沿って配置
const modelLayer = view.addLayer<GLTFModelLayer>({
  type: "mesh",
  gltfModel: {
    url: "/models/building.gltf",
  },
  position: { x: position.x, y: position.y, z: position.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});
```

### ENU（東-北-上）座標系の使用

ローカル座標系（ENU: East-North-Up）を使用してメッシュを配置するには、`eastNorthUpToFixedFrame()`を使用します。

```typescript
import {
  geodeticToVector3,
  eastNorthUpToFixedFrame,
  degreeToRadian,
} from "@navara/three";
import { Vector3 } from "three";

const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});

// ENU変換行列を取得
const enuMatrix = eastNorthUpToFixedFrame(position);

// ENU行列から東・北方向ベクトルを抽出
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// 東方向に100m移動した位置を計算
const offsetPosition = position.clone().add(east.multiplyScalar(100));
```

### ECEF座標から測地座標への逆変換

ECEF座標から緯度・経度・高度に戻すには、`vector3ToGeodetic()`と`radianToDegree()`を使用します。

```typescript
import {
  vector3ToGeodetic,
  radianToDegree,
} from "@navara/three";

// メッシュの現在位置を取得
const worldPosition = meshLayer.ref.getWorldPosition();

// ECEF座標から測地座標に変換
const geodetic = vector3ToGeodetic(worldPosition);

// ラジアンから度に変換
const latitude = radianToDegree(geodetic.lat);
const longitude = radianToDegree(geodetic.lng);
const height = geodetic.height;

console.log(`緯度: ${latitude}°, 経度: ${longitude}°, 高度: ${height}m`);
```

### 座標変換関数一覧

| 関数 | 説明 |
|------|------|
| `geodeticToVector3()` | 測地座標（緯度・経度・高度）をECEF座標（Vector3）に変換 |
| `vector3ToGeodetic()` | ECEF座標（Vector3）を測地座標に変換 |
| `degreeToRadian()` | 度をラジアンに変換 |
| `radianToDegree()` | ラジアンを度に変換 |
| `geodeticSurfaceNormal()` | 指定位置での地球表面の法線ベクトルを取得 |
| `eastNorthUpToFixedFrame()` | ENU座標系への変換行列を取得 |

詳細は [navara_three_api](../API%20Reference/navara_three_api) を参照してください。

詳細な使用方法は、各レイヤータイプのドキュメントを参照してください。
