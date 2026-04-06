---
title: Interior Explore
description: 3D建物内をモデル操作で探索する方法
sidebar:
  order: 8
---

![実行結果](@assets/tutorial/model-animation.png)

3D Tiles の建物内をモデル操作しながら探索する方法を学びます。

**このチュートリアルで学べること:**
- 3D Tiles 建物モデルを読み込む
- GLTF/GLB キャラクターモデルを地球上に配置する
- キーボード入力でモデルを移動・回転させる
- カメラをモデルに追従させる
- 建物内部を自由に移動する（地下・飛行モード）

## 基本のシーンをセットアップする

まずは建物探索用のシーンを構築します。影と背景色を設定した `ThreeView` を作成します。

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
  eastNorthUpToFixedFrame,
  JAPAN_GSI_ELEVATION_DECODER,
  type GLTFModelLayer,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
view.addPlugin(plugin);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

// フォトリアルなシーンを一括セットアップ
const layers = plugin.addDefaultPhotorealLayers();

// 太陽の影を有効化
layers.sun.update({
  sun: { castShadow: true },
});
```

## 地形と地図タイルを追加する

探索エリアの地形と衛星写真タイルを追加します。

```typescript
// 地形レイヤー
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false, // 地下のモデルを探索する場合はスカートをオフにする
  },
});

// 衛星写真タイル
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});
```

## 3D Tiles 建物モデルを読み込む

PLATEAU などの Cesium 3D Tiles 形式の建物モデルを読み込みます。建物内を探索するため、影の設定を有効にします。

```typescript
// 3D Tiles 建物モデル
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35, // 楕円体高の調整
  },
});
```

:::note[楕円体高の調整について]
3D Tiles モデルは楕円体高（WGS84）を基準に配置されることがあります。日本では楕円体高とジオイド高の差があるため、`height` プロパティで調整が必要な場合があります。
:::

## キャラクターモデルを配置する

探索用のキャラクター（アバター）として GLTF モデルを配置します。このチュートリアルでは Three.js の公式サンプルに含まれる Soldier.glb モデルを使用します。

:::note[モデルデータの準備]
Soldier.glb は Three.js の公式リポジトリで提供されている外部データです。以下の手順でダウンロードしてください：

1. [Three.js GitHub リポジトリ](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/Soldier.glb) から Soldier.glb をダウンロード
2. プロジェクトの `public/glTF/Soldier/` ディレクトリに配置

このモデルには Idle、Walk、Run のアニメーションクリップが含まれており、モデルの移動操作を実装するのに適しています。他のアニメーション付き GLTF モデルを使用する場合は、アニメーションクリップ名を適宜変更してください。
:::

```typescript
// 開始位置（緯度・経度・標高）
const startLat = 35.6341630282;
const startLng = 139.7420527162;
const startHeight = 23.0;

// 地理座標を ECEF 座標に変換
const startPos = geodeticToVector3({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// 地表法線を取得してモデルを直立させる
const normal = geodeticSurfaceNormal({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// ENU座標系から東・北方向を取得
const enuMatrix = eastNorthUpToFixedFrame(startPos);
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// 初期の向きを設定
const initialYaw = Math.PI * 1.6;
const worldForward = east.clone().multiplyScalar(Math.sin(initialYaw))
                    .add(north.clone().multiplyScalar(Math.cos(initialYaw)));
const worldRight = worldForward.clone().cross(normal).normalize();

// 回転行列からクォータニオンを生成
const quaternion = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(worldRight, normal, worldForward.clone().negate())
);
const euler = new Euler().setFromQuaternion(quaternion);

// キャラクターモデルを追加
const modelLayer = view.addLayer<GLTFModelLayer>({
  type: "mesh",
  gltfModel: {
    // Credit:
    // - Soldier.glb - Three.js examples
    //   https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
    url: "/glTF/Soldier/Soldier.glb",
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
    animationCrossfadeDuration: 0.3,
  },
  position: { x: startPos.x, y: startPos.y, z: startPos.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});

// 初期カメラ位置
const cameraDistance = 8;
const cameraHeight = 1;
const cameraOffset = new Vector3(
  -Math.sin(initialYaw) * cameraDistance,
  -Math.cos(initialYaw) * cameraDistance,
  cameraHeight
);
view.lookAt(
  { lat: startLat, lng: startLng, height: startHeight + 1 },
  cameraOffset,
);
```

## キーボード入力でモデルを操作する

キーボードでのモデル操作を実装します。ENU（East-North-Up）座標系を使って直感的な移動を実現します。

```typescript
import { vector3ToGeodetic, radianToDegree } from "@navara/three";
import { Matrix4 } from "three";

// キー状態管理
const keys = new Set<string>();
let currentState: "Idle" | "Walk" | "Run" = "Idle";

// 移動パラメータ
const walkSpeed = 5;      // m/s
const rotationSpeed = 3;  // 度/フレーム
let dashMultiplier = 1;

// キー入力ハンドラ
document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": keys.add("forward"); break;
    case "KeyS": keys.add("backward"); break;
    case "KeyA": keys.add("left"); break;
    case "KeyD": keys.add("right"); break;
    case "Space": keys.add("up"); break;
    case "ControlLeft": keys.add("down"); break;
    case "ShiftLeft": dashMultiplier = 2; break;
  }
  updateAnimation();
});

document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": keys.delete("forward"); break;
    case "KeyS": keys.delete("backward"); break;
    case "KeyA": keys.delete("left"); break;
    case "KeyD": keys.delete("right"); break;
    case "Space": keys.delete("up"); break;
    case "ControlLeft": keys.delete("down"); break;
    case "ShiftLeft": dashMultiplier = 1; break;
  }
  updateAnimation();
});

// アニメーション状態の切り替え
function updateAnimation() {
  const hasMovement = keys.size > 0;
  let targetState: "Idle" | "Walk" | "Run";

  if (!hasMovement) {
    targetState = "Idle";
  } else if (dashMultiplier > 1) {
    targetState = "Run";
  } else {
    targetState = "Walk";
  }

  if (targetState !== currentState) {
    modelLayer.ref.crossFadeAnimation(currentState, targetState, 0.3);
    currentState = targetState;
  }
}
```

**キー割り当て**
| キー         | 動作             |
| ------------ | ---------------- |
| W / S        | 前進 / 後退      |
| A / D        | 左旋回 / 右旋回  |
| Shift        | ダッシュ（加速） |
| Space / Ctrl | 上昇 / 下降      |

## モデルの移動処理を実装する

ENU 座標系を使ってモデルを移動させます。建物内を探索するため、地下移動と飛行を許可します。

```typescript
// 移動オプション
const allowFly = true;        // 上下移動を許可
const allowUnderground = true; // 地下移動を許可

let lastTime = performance.now();

function tick(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const modelObject = modelLayer.ref.raw;
  const curPos = modelLayer.ref.getWorldPosition();
  if (!modelObject || !curPos) {
    requestAnimationFrame(tick);
    return;
  }

  // 移動方向を計算
  let dirX = 0, dirY = 0, dirZ = 0;
  if (keys.has("forward")) dirY += 1;
  if (keys.has("backward")) dirY -= 1;
  if (keys.has("left")) dirX -= 1;
  if (keys.has("right")) dirX += 1;
  if (keys.has("up")) dirZ += 1;
  if (keys.has("down")) dirZ -= 1;

  // ENU 座標系を取得
  const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
  const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
  const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

  // 現在の地理座標と地表法線を取得
  const currentLLE = vector3ToGeodetic(curPos);
  const surfaceNormal = geodeticSurfaceNormal({
    lat: currentLLE.lat,
    lng: currentLLE.lng,
    height: currentLLE.height,
  });

  // 現在のヨー角を抽出
  const modelForward = new Vector3(0, 0, -1).applyQuaternion(modelObject.quaternion);
  const forwardProjected = modelForward
    .clone()
    .sub(surfaceNormal.clone().multiplyScalar(modelForward.dot(surfaceNormal)))
    .normalize();
  let currentYaw = Math.atan2(forwardProjected.dot(east), forwardProjected.dot(north));

  // 旋回
  if (dirX !== 0) {
    currentYaw += degreeToRadian(rotationSpeed * dirX);
  }

  // 新しい前方ベクトルを計算
  const worldForward = east
    .clone()
    .multiplyScalar(Math.sin(currentYaw))
    .add(north.clone().multiplyScalar(Math.cos(currentYaw)));

  // 回転を計算
  const worldRight = worldForward.clone().cross(surfaceNormal).normalize();
  const finalQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(worldRight, surfaceNormal, worldForward.clone().negate())
  );
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  // 前後移動
  if (dirY !== 0) {
    curPos.addScaledVector(worldForward, walkSpeed * dashMultiplier * deltaTime * dirY);
  }

  // 高度の計算
  let height = currentLLE.height + dirZ * walkSpeed * deltaTime;
  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight({ lat: curLLE.lat, lng: curLLE.lng, height: 0 }) ?? 0;

  // 飛行・地下移動の制御
  if (allowFly) {
    if (!allowUnderground) {
      height = Math.max(height, terrainHeight);
    }
  } else {
    height = terrainHeight;
  }

  // 最終位置を計算して更新
  const finalPos = geodeticToVector3({ lat: curLLE.lat, lng: curLLE.lng, height });

  modelLayer.update({
    position: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  // カメラ追従
  view.cameraFollow(
    true,
    { lat: radianToDegree(curLLE.lat), lng: radianToDegree(curLLE.lng), height: height + 1 }
  );

  requestAnimationFrame(tick);
}

// モデル読み込み完了後に開始
modelLayer.ref.on("load", () => {
  requestAnimationFrame(tick);
});
```

:::note[ENU 座標系とは]
ENU（East-North-Up）座標系は、地球上のある地点を基準とした局所座標系です。

- **East**: 東方向（X軸）
- **North**: 北方向（Y軸）
- **Up**: 天頂方向（Z軸）

この座標系を使うことで、地球の曲面上でも直感的な「前進」「左右」の移動が実現できます。
:::

:::tip[建物内探索のコツ]
- `allowUnderground: true` を設定すると、地面より下（建物の地下フロア等）にも移動できます
- `allowFly: true` を設定すると、Space/Ctrl キーで上下に自由に移動できます
- カメラを自由に動かしたい場合は `view.cameraFollow(false)` で追従を解除できます
:::

## 完全な例

以下は建物内をモデル操作で探索する完全な例です。

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
  vector3ToGeodetic,
  radianToDegree,
  eastNorthUpToFixedFrame,
  JAPAN_GSI_ELEVATION_DECODER,
  type GLTFModelLayer,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
view.addPlugin(plugin);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

// フォトリアルなシーンを一括セットアップ
const layers = plugin.addDefaultPhotorealLayers();
layers.sun.update({ sun: { castShadow: true } });

// 地形レイヤー
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false, // 地下のモデルを探索する場合はスカートをオフにする
  },
});

// 衛星写真タイル
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});

// 3D Tiles 建物モデル
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35,
  },
});

// 開始位置
const startLat = 35.6341630282;
const startLng = 139.7420527162;
const startHeight = 23.0;

// キャラクターモデル
const startPos = geodeticToVector3({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});
const normal = geodeticSurfaceNormal({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// ENU座標系から東・北方向を取得
const enuMatrix = eastNorthUpToFixedFrame(startPos);
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// 初期の向きを設定
const initialYaw = Math.PI * 1.6;
const worldForward = east.clone().multiplyScalar(Math.sin(initialYaw))
                    .add(north.clone().multiplyScalar(Math.cos(initialYaw)));
const worldRight = worldForward.clone().cross(normal).normalize();

// 回転行列からクォータニオンを生成
const quaternion = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(worldRight, normal, worldForward.clone().negate())
);
const euler = new Euler().setFromQuaternion(quaternion);

const modelLayer = view.addLayer<GLTFModelLayer>({
  type: "mesh",
  gltfModel: {
    // Credit:
    // - Soldier.glb - Three.js examples
    //   https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
    url: "/glTF/Soldier/Soldier.glb",
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
    animationCrossfadeDuration: 0.3,
  },
  position: { x: startPos.x, y: startPos.y, z: startPos.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});

const cameraDistance = 8;
const cameraHeight = 1;
const cameraOffset = new Vector3(
  -Math.sin(initialYaw) * cameraDistance,
  -Math.cos(initialYaw) * cameraDistance,
  cameraHeight
);
view.lookAt(
  { lat: startLat, lng: startLng, height: startHeight + 1 },
  cameraOffset,
);

// 移動パラメータ
const keys = new Set<string>();
let currentState: "Idle" | "Walk" | "Run" = "Idle";
const walkSpeed = 5;
const rotationSpeed = 3;
let dashMultiplier = 1;
const allowFly = true;
const allowUnderground = true;

// キー入力
document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": keys.add("forward"); break;
    case "KeyS": keys.add("backward"); break;
    case "KeyA": keys.add("left"); break;
    case "KeyD": keys.add("right"); break;
    case "Space": keys.add("up"); break;
    case "ControlLeft": keys.add("down"); break;
    case "ShiftLeft": dashMultiplier = 2; break;
  }
  updateAnimation();
});

document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": keys.delete("forward"); break;
    case "KeyS": keys.delete("backward"); break;
    case "KeyA": keys.delete("left"); break;
    case "KeyD": keys.delete("right"); break;
    case "Space": keys.delete("up"); break;
    case "ControlLeft": keys.delete("down"); break;
    case "ShiftLeft": dashMultiplier = 1; break;
  }
  updateAnimation();
});

function updateAnimation() {
  const hasMovement = keys.size > 0;
  let targetState: "Idle" | "Walk" | "Run";

  if (!hasMovement) {
    targetState = "Idle";
  } else if (dashMultiplier > 1) {
    targetState = "Run";
  } else {
    targetState = "Walk";
  }

  if (targetState !== currentState) {
    modelLayer.ref.crossFadeAnimation(currentState, targetState, 0.3);
    currentState = targetState;
  }
}

let lastTime = performance.now();

function tick(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const modelObject = modelLayer.ref.raw;
  const curPos = modelLayer.ref.getWorldPosition();
  if (!modelObject || !curPos) {
    requestAnimationFrame(tick);
    return;
  }

  let dirX = 0, dirY = 0, dirZ = 0;
  if (keys.has("forward")) dirY += 1;
  if (keys.has("backward")) dirY -= 1;
  if (keys.has("left")) dirX -= 1;
  if (keys.has("right")) dirX += 1;
  if (keys.has("up")) dirZ += 1;
  if (keys.has("down")) dirZ -= 1;

  const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
  const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
  const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

  const currentLLE = vector3ToGeodetic(curPos);
  const surfaceNormal = geodeticSurfaceNormal({
    lat: currentLLE.lat,
    lng: currentLLE.lng,
    height: currentLLE.height,
  });

  const modelForward = new Vector3(0, 0, -1).applyQuaternion(modelObject.quaternion);
  const forwardProjected = modelForward
    .clone()
    .sub(surfaceNormal.clone().multiplyScalar(modelForward.dot(surfaceNormal)))
    .normalize();
  let currentYaw = Math.atan2(forwardProjected.dot(east), forwardProjected.dot(north));

  if (dirX !== 0) {
    currentYaw += degreeToRadian(rotationSpeed * dirX);
  }

  const worldForward = east
    .clone()
    .multiplyScalar(Math.sin(currentYaw))
    .add(north.clone().multiplyScalar(Math.cos(currentYaw)));

  const worldRight = worldForward.clone().cross(surfaceNormal).normalize();
  const finalQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(worldRight, surfaceNormal, worldForward.clone().negate())
  );
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  if (dirY !== 0) {
    curPos.addScaledVector(worldForward, walkSpeed * dashMultiplier * deltaTime * dirY);
  }

  let height = currentLLE.height + dirZ * walkSpeed * deltaTime;
  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight({ lat: curLLE.lat, lng: curLLE.lng, height: 0 }) ?? 0;

  if (allowFly) {
    if (!allowUnderground) {
      height = Math.max(height, terrainHeight);
    }
  } else {
    height = terrainHeight;
  }

  const finalPos = geodeticToVector3({ lat: curLLE.lat, lng: curLLE.lng, height });

  modelLayer.update({
    position: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  view.cameraFollow(
    true,
    { lat: radianToDegree(curLLE.lat), lng: radianToDegree(curLLE.lng), height: height + 1 }
  );

  requestAnimationFrame(tick);
}

modelLayer.ref.on("load", () => {
  requestAnimationFrame(tick);
});
```

:::tip[カスタマイズのヒント]
- **別の建物を探索する**: `cesium3dtiles` レイヤーの URL を変更して別の PLATEAU モデルを読み込めます
- **移動速度の調整**: `walkSpeed` や `rotationSpeed` の値を変更して操作感を調整できます
- **カメラ位置の調整**: `view.lookAt()` の第二引数でカメラのオフセットを調整できます
- **一人称視点**: `view.cameraFollow()` の代わりにモデルの頭の位置にカメラを直接設定すると一人称視点になります
:::
