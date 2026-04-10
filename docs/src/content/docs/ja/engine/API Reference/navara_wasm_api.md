---
title: navara_wasm_api
description: navara_wasm API reference for utility functions
sidebar:
  order: 4
---

navara_wasm_api は、地理空間計算、座標変換、交差判定などのユーティリティ機能を提供する API です。この API は、3D 地理空間アプリケーションで必要な数学的計算を簡単に実行できるように設計されています。

## Ellipsoid Functions

WGS84 楕円体の基本パラメータを取得する関数群です。

### getWGS84SemiMajorAxis()

WGS84 楕円体の長半径を取得します。

```typescript
getWGS84SemiMajorAxis(): number
```

**Returns:**

WGS84 楕円体の長半径（メートル）

**Example:**

```typescript
const semiMajorAxis = getWGS84SemiMajorAxis();
console.log(`長半径: ${semiMajorAxis} m`); // 長半径: 6378137 m
```

### getWGS84SemiMinorAxis()

WGS84 楕円体の短半径を取得します。

```typescript
getWGS84SemiMinorAxis(): number
```

**Returns:**

WGS84 楕円体の短半径（メートル）

**Example:**

```typescript
const semiMinorAxis = getWGS84SemiMinorAxis();
console.log(`短半径: ${semiMinorAxis} m`); // 短半径: 6356752.314245 m
```

### getWGS84EccentricitySquared()

WGS84 楕円体の離心率の二乗を取得します。

```typescript
getWGS84EccentricitySquared(): number
```

**Returns:**

WGS84 楕円体の離心率の二乗

### getWGS84Flattening()

WGS84 楕円体の扁平率を取得します。

```typescript
getWGS84Flattening(): number
```

**Returns:**

WGS84 楕円体の扁平率

### getWGS84Eccentricity()

WGS84 楕円体の離心率を取得します。

```typescript
getWGS84Eccentricity(): number
```

**Returns:**

WGS84 楕円体の離心率

## Coordinate Transformation

座標系間の変換を行う関数群です。

### geodeticToXyz(lle: LLE)

測地座標（緯度経度高度）を ECEF 座標系（地心直交座標系）に変換します。

```typescript
geodeticToXyz(lle: LLE): Vec3
```

**Parameters:**

- `lle`: 変換する測地座標
  - `lat`: 緯度（ラジアン）
  - `lng`: 経度（ラジアン）
  - `height`: 高度（メートル）

**Returns:**

ECEF 座標系での位置 [x, y, z]

**Example:**

```typescript
const lle = { lat: 0.6283, lng: 2.4435, height: 100 }; // 東京付近
const ecef = geodeticToXyz(lle);
console.log(`ECEF座標: [${ecef.x}, ${ecef.y}, ${ecef.z}]`);
```

### xyzToGeodetic(vec3: Vec3)

ECEF 座標系を測地座標（緯度経度高度）に変換します。

```typescript
xyzToGeodetic(vec3: Vec3): LLE
```

**Parameters:**

- `vec3`: 変換する ECEF 座標 [x, y, z]

**Returns:**

測地座標:
- `lat`: 緯度（ラジアン）
- `lng`: 経度（ラジアン）
- `height`: 高度（メートル）

**Example:**

```typescript
const ecef = { x: -3946416, y: 3364068, z: 3702654 }; // 東京付近のECEF座標
const lle = xyzToGeodetic(ecef);
console.log(`緯度: ${lle.lat}, 経度: ${lle.lng}, 高度: ${lle.height}`);
```

### angleToRadian(degree: number)

角度を度からラジアンに変換します。

```typescript
angleToRadian(degree: number): number
```

**Parameters:**

- `degree`: 度単位の角度

**Returns:**

ラジアン単位の角度

**Example:**

```typescript
const radians = angleToRadian(90);
console.log(`90度 = ${radians} ラジアン`); // 90度 = 1.5708 ラジアン
```

### angleToDegree(radian: number)

角度をラジアンから度に変換します。

```typescript
angleToDegree(radian: number): number
```

**Parameters:**

- `radian`: ラジアン単位の角度

**Returns:**

度単位の角度

**Example:**

```typescript
const degrees = angleToDegree(Math.PI);
console.log(`π ラジアン = ${degrees} 度`); // π ラジアン = 180 度
```

## Screen-World Projection

スクリーン座標と世界座標間の変換を行う関数群です。

### screenToWorld(window, transform, frustum, screen_pos)

スクリーン座標を世界座標に変換します。

```typescript
screenToWorld(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  screen_pos: Vec2
): Vec3 | null
```

**Parameters:**

- `window`: ウィンドウ情報
- `transform`: カメラの変換行列
- `frustum`: カメラの視錐台
- `screen_pos`: スクリーン座標 [x, y]

**Returns:**

世界座標での位置、または交差しない場合は null

**Example:**

```typescript
const worldPos = screenToWorld(window, cameraTransform, frustum, {
  x: 400,
  y: 300,
});
if (worldPos) {
  console.log(`世界座標: [${worldPos.x}, ${worldPos.y}, ${worldPos.z}]`);
}
```

### worldToScreen(window, transform, frustum, world_pos)

世界座標をスクリーン座標に変換します。

```typescript
worldToScreen(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  world_pos: Vec3
): Vec2 | null
```

**Parameters:**

- `window`: ウィンドウ情報
- `transform`: カメラの変換行列
- `frustum`: カメラの視錐台
- `world_pos`: 世界座標での位置

**Returns:**

スクリーン座標、または視野外の場合は null

**Example:**

```typescript
const screenPos = worldToScreen(
  window,
  cameraTransform,
  frustum,
  worldPosition
);
if (screenPos) {
  console.log(`スクリーン座標: [${screenPos.x}, ${screenPos.y}]`);
}
```

## Intersection and Ray Casting

交差判定とレイキャスティングを行う関数群です。

### getPlaneFromPointNormal(point, normal)

点と法線ベクトルから平面を作成します。

```typescript
getPlaneFromPointNormal(point: Vec3, normal: Vec3): Plane
```

**Parameters:**

- `point`: 平面上の点
- `normal`: 平面の法線ベクトル

**Returns:**

作成された平面

**Example:**

```typescript
const point = { x: 0, y: 0, z: 0 };
const normal = { x: 0, y: 0, z: 1 }; // Z軸方向
const plane = getPlaneFromPointNormal(point, normal);
```

### getPickRay(window, transform, frustum, screen_pos)

スクリーン座標からピッキング用のレイを生成します。

```typescript
getPickRay(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  screen_pos: Vec2
): Ray
```

**Parameters:**

- `window`: ウィンドウ情報
- `transform`: カメラの変換行列
- `frustum`: カメラの視錐台
- `screen_pos`: スクリーン座標

**Returns:**

生成されたレイ

**Example:**

```typescript
const ray = getPickRay(window, cameraTransform, frustum, { x: 400, y: 300 });
console.log(`レイの原点: [${ray.origin.x}, ${ray.origin.y}, ${ray.origin.z}]`);
```

### getRayPlaneIntersection(ray, plane)

レイと平面の交点を計算します。

```typescript
getRayPlaneIntersection(ray: Ray, plane: Plane): Vec3 | null
```

**Parameters:**

- `ray`: 交差判定を行うレイ
- `plane`: 交差判定を行う平面

**Returns:**

交点の座標、または交差しない場合は null

**Example:**

```typescript
const intersection = getRayPlaneIntersection(ray, plane);
if (intersection) {
  console.log(
    `交点: [${intersection.x}, ${intersection.y}, ${intersection.z}]`
  );
}
```

### getHeightFromEllipsoid(point)

指定した点の楕円体からの高度を取得します。

```typescript
getHeightFromEllipsoid(point: Vec3): number
```

**Parameters:**

- `point`: 高度を計算する点の ECEF 座標

**Returns:**

楕円体からの高度（メートル）

**Example:**

```typescript
const height = getHeightFromEllipsoid({ x: -3946416, y: 3364068, z: 3702654 });
console.log(`高度: ${height} m`);
```

## Surface Normal and Reference Frames

地表面の法線ベクトルと参照フレームを計算する関数群です。

### geodeticSurfaceNormal(lle)

測地座標での地表面法線ベクトルを計算します。

```typescript
geodeticSurfaceNormal(lle: LLE): Vec3
```

**Parameters:**

- `lle`: 測地座標

**Returns:**

正規化された地表面法線ベクトル

**Example:**

```typescript
const lle = { lat: 0.6283, lng: 2.4435, height: 0 };
const normal = geodeticSurfaceNormal(lle);
console.log(`法線ベクトル: [${normal.x}, ${normal.y}, ${normal.z}]`);
```

### eastNorthUpToFixedFrame(origin)

East-North-Up 座標系から固定フレームへの変換行列を取得します。

```typescript
eastNorthUpToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: 原点の ECEF 座標

**Returns:**

4x4 変換行列（列優先順序で 16 要素の配列）

**Example:**

```typescript
const origin = { x: -3946416, y: 3364068, z: 3702654 };
const matrix = eastNorthUpToFixedFrame(origin);
// 4x4行列として使用
```

### northEastDownToFixedFrame(origin)

North-East-Down 座標系から固定フレームへの変換行列を取得します。

```typescript
northEastDownToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: 原点の ECEF 座標

**Returns:**

4x4 変換行列（列優先順序で 16 要素の配列）

### northUpEastToFixedFrame(origin)

North-Up-East 座標系から固定フレームへの変換行列を取得します。

```typescript
northUpEastToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: 原点の ECEF 座標

**Returns:**

4x4 変換行列（列優先順序で 16 要素の配列）

### northWestUpToFixedFrame(origin)

North-West-Up 座標系から固定フレームへの変換行列を取得します。

```typescript
northWestUpToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: 原点の ECEF 座標

**Returns:**

4x4 変換行列（列優先順序で 16 要素の配列）

## Usage Examples

### 基本的な座標変換

```typescript
// 度をラジアンに変換
const latRad = angleToRadian(35.6762); // 東京の緯度
const lngRad = angleToRadian(139.6503); // 東京の経度

// 測地座標をECEF座標に変換
const lle = { lat: latRad, lng: lngRad, height: 100 };
const ecef = geodeticToXyz(lle);

// ECEF座標を測地座標に戻す
const convertedLle = xyzToGeodetic(ecef);
```

### スクリーンピッキング

```typescript
// マウス位置からレイを生成
const mousePos = { x: event.clientX, y: event.clientY };
const ray = getPickRay(window, cameraTransform, frustum, mousePos);

// 地面との交点を計算
const groundPlane = getPlaneFromPointNormal(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }
);
const intersection = getRayPlaneIntersection(ray, groundPlane);

if (intersection) {
  console.log("地面をクリックした位置:", intersection);
}
```

### 座標系変換行列の使用

```typescript
// 東京の位置でEast-North-Up座標系を設定
const tokyoEcef = geodeticToXyz({
  lat: angleToRadian(35.6762),
  lng: angleToRadian(139.6503),
  height: 0,
});

const enuMatrix = eastNorthUpToFixedFrame(tokyoEcef);
// この行列を使用してローカル座標系でオブジェクトを配置
```
