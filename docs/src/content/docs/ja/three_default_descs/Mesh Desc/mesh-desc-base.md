---
title: MeshDesc
description: すべてのメッシュに共通する基底クラスのプロパティと機能
sidebar:
  order: 99
---

`MeshDesc` はすべてのメッシュの基底クラスです。共通の設定プロパティ、トランスフォーム合成、ピッキングのサポートを提供します。ビルトインおよびカスタムのすべてのメッシュはこのクラスを継承しているため、ここで説明する機能はすべてのメッシュで利用できます。

## 共通プロパティ

| プロパティ    | 型                                    | デフォルト | 説明                                                                                        |
| ------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `id`          | `string`                              | 自動生成   | オブジェクトの一意な識別子                                                                      |
| `visible`     | `boolean`                             | `true`     | オブジェクトの表示/非表示を切り替え                                                             |
| `position`    | `{ x: number, y: number, z: number }` | -          | 位置（ECEF座標系）、`matrix`/`matrixWorld` 設定時はローカルオフセット                       |
| `rotation`    | `{ x: number, y: number, z: number }` | -          | 回転（Euler角、ラジアン）、`matrix`/`matrixWorld` 設定時はローカルオフセット                |
| `scale`       | `{ x: number, y: number, z: number }` | -          | スケール、`matrix`/`matrixWorld` 設定時はローカルオフセット                                 |
| `matrix`      | `Matrix4`                             | -          | ローカル変換行列。設定時は `position`/`rotation`/`scale` がこのフレーム内のオフセットになる |
| `matrixWorld` | `Matrix4`                             | -          | ワールド変換行列。設定時は `position`/`rotation`/`scale` がこのフレーム内のオフセットになる |
| `pickable`    | `boolean`                             | `false`    | GPU ベースのクリックピッキングを有効にする                                                  |

## トランスフォーム合成

`MeshDesc` は3つのトランスフォームモードをサポートしています。

### 標準トランスフォーム

`matrix` と `matrixWorld` のいずれも設定されていない場合、`position`、`rotation`、`scale` は ECEF 座標系で Three.js オブジェクトに直接適用されます。標準的な Three.js のトランスフォームと同じ動作です。

### `matrix` によるローカルフレーム

`matrix` を設定すると、Three.js の `matrixAutoUpdate` が無効になり、最終的なローカル行列は以下のように計算されます:

```
effective = matrix · T(position) · R(rotation) · S(scale)
```

ベースフレームを指定し、そのフレーム内でオフセットを表現できます。

### `matrixWorld` によるワールドフレーム

`matrixWorld` を設定すると、`matrixAutoUpdate` と `matrixWorldAutoUpdate` の両方が無効になり、最終的なワールド行列は以下のように計算されます:

```
effective = matrixWorld · T(position) · R(rotation) · S(scale)
```

地理的な配置で最も一般的なモードです。ワールド空間の参照フレーム（例: `eastNorthUpToFixedFrame()` による ENU 接線フレーム）を指定し、そのフレーム内でローカルオフセットを表現できます。地球上にメッシュを配置する際に、フレーム行列を手動で合成する必要がなくなります。

### 例: ENU フレーム内でのメッシュ配置

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  eastNorthUpToFixedFrame,
  degreeToRadian,
} from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("box", BoxMeshDesc);
await view.init();

// 地理的な原点での ENU フレームを計算
const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// 原点から東に200m、上に50mの位置にボックスを配置
const box1 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 100, depth: 50, color: new Color().setHex(0xff0000) },
  matrixWorld: enuFrame,
  position: { x: 200, y: 50, z: 0 },
});

// 北に100mの位置にもう1つのボックスを配置
const box2 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 80, depth: 50, color: new Color().setHex(0x00ff00) },
  matrixWorld: enuFrame,
  position: { x: 0, y: 40, z: 100 },
});
```

## ピッキング

メッシュは、Descriptor設定で `pickable: true` を指定することで GPU ベースのクリックピッキングを有効にできます。ピッキングシステムは、ピッカブルメッシュを専用の 1 ピクセルのレンダーターゲットに各メッシュのバッチ ID を RGB カラーとしてエンコードして描画し、ピクセルを読み取って `"pick"` イベントを発行してクリックされたメッシュを特定します。

:::note
ピッキングを使用するには、ThreeView のコンストラクタで `picking: true` を設定する必要があります。
:::

### 基本的な使い方

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView({ picking: true });
view.registerMesh("box", BoxMeshDesc);
await view.init();

const boxLayer = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
  pickable: true,
});

view.on("pick", (info) => {
  if (info) {
    console.log("選択されたオブジェクト:", info.layerId);
    console.log("バッチ ID:", info.batchId);
  }
});
```

### バッチ ID

バッチ ID は、各ピッカブルメッシュ（またはインスタンスメッシュの各インスタンス）に割り当てられるユニークな 24 ビット整数です。Descriptorリファレンスから読み取り、クリックされたメッシュを特定できます:

```typescript
// 単一メッシュ
const batchId = boxLayer.ref.batchId;

// インスタンスメッシュ — インスタンスごとに1つのバッチ ID
const batchIds = instancedLayer.ref.batchIds;
```

### ピックへの応答

```typescript
view.on("pick", (info) => {
  if (info && info.batchId === boxLayer.ref.batchId) {
    // 選択されたボックスをハイライト
    boxLayer.update({ box: { color: new Color().setHex(0xffff00) } });
  }
});
```

### PickedFeature 型

```typescript
type PickedFeature = {
  batchId: number;                        // 24ビットエンコードされたID
  properties?: Record<string, unknown>;   // フィーチャプロパティ（GISレイヤー用）
  layerId?: string;                       // レイヤー識別子
};
```

カスタム Descriptor でのピッキング実装については、[Custom Descriptor — ピッキングの実装](../../three/core/custom-desc/#カスタム-descriptor-でのピッキング実装) を参照してください。

## 座標変換

`position` プロパティは ECEF（Earth-Centered, Earth-Fixed）座標系を使用します。緯度・経度・高度（測地座標系）から ECEF に変換するには、`geodeticToVector3()` 関数を使用します。

:::note
緯度・経度は**ラジアン**で指定する必要があります。度からラジアンに変換するには `degreeToRadian()` を使用してください。
:::

### 基本的な座標変換

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three";
import { SphereMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshDesc);
await view.init();

// 緯度・経度・高度からECEF座標に変換
const position = geodeticToVector3({
  lat: degreeToRadian(35.681236),  // 緯度（ラジアン）
  lng: degreeToRadian(139.767125), // 経度（ラジアン）
  height: 200,                      // 高度（メートル）
});

// 変換した座標でメッシュを追加
const sphereLayer = view.addMesh<SphereMeshDesc>({
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

### ENU（東-北-上）座標系の使用

ローカル座標系（ENU: East-North-Up）を使用してメッシュを配置するには、`eastNorthUpToFixedFrame()` を使用します。

```typescript
import {
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
} from "@navara/three";
import { GLTFModelDesc } from "@navara/three_default_descs";
import { Vector3, Quaternion, Euler } from "three";

// GLTFModelDesc が登録済みであること

const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// モデルを地表面に沿って配置
const modelLayer = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "/models/building.gltf",
  },
  matrixWorld: enuFrame,
});
```

### 座標変換関数一覧

| 関数                        | 説明                                                    |
| --------------------------- | ------------------------------------------------------- |
| `geodeticToVector3()`       | 測地座標（緯度・経度・高度）をECEF座標（Vector3）に変換 |
| `vector3ToGeodetic()`       | ECEF座標（Vector3）を測地座標に変換                     |
| `degreeToRadian()`          | 度をラジアンに変換                                      |
| `radianToDegree()`          | ラジアンを度に変換                                      |
| `geodeticSurfaceNormal()`   | 指定位置での地球表面の法線ベクトルを取得                |
| `eastNorthUpToFixedFrame()` | ENU座標系への変換行列を取得                             |

詳細は [navara_three_api](../../../three/api/navara_three_api) を参照してください。
