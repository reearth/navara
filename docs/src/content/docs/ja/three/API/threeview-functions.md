---
title: ThreeView Functions
description: API Reference for ThreeView Class Functions
sidebar:
  order: 13
---

このページでは、ThreeView インスタンスで利用可能なすべての関数（メソッド）を説明します。

## Methods

### addLayer()

navara_three に新しいリソースレイヤーを追加します。このメソッドは、リソースレイヤー（タイル、地形、geojson など）をサポートします。メッシュレイヤーには `addMesh()`、ライトレイヤーには `addLight()`、エフェクトレイヤーには `addEffect()` を使用してください。

**Syntax:**

```tsx
addLayer(l: LayerDescription): Layer
```

**Parameters:**

LayerDescription の詳細な型については、[Resource Layer Reference](../../../three/resource-layer-reference/resource-layer/) を参照してください。

**Returns:**

```tsx
Layer;
```

リソースレイヤーの `Layer` インスタンスを返します。

**Example:**

```tsx
const layer = view.addLayer({
  type: "tiles",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: {
    segments: 10,
    color: new Color().setStyle("#cccccc"),
    maxSse: 2,
    maxZoom: 23,
    wireframe: false,
  },
});
```

### updateLayerById()

navara_three 上の特定のレイヤーを更新します。

**Syntax:**

```tsx
updateLayerById(layerId: string, l: LayerDescription): void
```

**Parameters:**

- `layerId`: 更新するレイヤーの ID
- `l`: 更新したいプロパティを指定します

**Example:**

```tsx
const layerId = layer.id; // addLayer の戻り値からレイヤー ID を取得

view.updateLayerById(layerId, {
  type: "tiles",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: {
    segments: 10,
    color: new Color().setStyle("#ffffff"),
    maxSse: 2,
    maxZoom: 23,
    wireframe: false,
  },
});
```

### deleteLayerById()

navara_three 上の特定のレイヤーを削除します。

**Syntax:**

```tsx
deleteLayerById(layerId: string): void
```

**Parameters:**

- `layerId`: 削除するレイヤーの ID

**Example:**

```tsx
const layerId = layer.id;

view.deleteLayerById(layerId);
```

### init()

3D エンジン、WASM モジュールを初期化し、メインレンダリングループを開始します。ビューを使用する前に必ずこのメソッドを呼び出す必要があります。

**Syntax:**

```tsx
async init(): Promise<void>
```

**Returns:**

初期化が完了したときに解決される `Promise<void>`。

**Example:**

```tsx
const view = new ThreeView();
await view.init();

// init() 後にレイヤーを追加
view.addLayer({
  type: "tiles",
  data: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
  rasterTile: { maxZoom: 19 },
});
```

### dispose()

すべてのリソースを解放し、レンダリングループを停止します。ビューが不要になったときにこのメソッドを呼び出してください。

**Syntax:**

```tsx
dispose(): void
```

**Example:**

```tsx
// コンポーネントのアンマウント時にクリーンアップ
view.dispose();
```

### resize()

レンダラーのサイズを変更し、カメラのアスペクト比を更新します。`disableAutoResize` が `true` でない限り、ウィンドウリサイズ時に自動的に呼び出されます。

**Syntax:**

```tsx
resize(width?: number, height?: number, pixelRatio?: number): void
```

**Parameters:**

- `width`: 新しい幅（ピクセル）。省略時は canvas サイズを使用
- `height`: 新しい高さ（ピクセル）。省略時は canvas サイズを使用
- `pixelRatio`: デバイスピクセル比率

**Example:**

```tsx
// 明示的にサイズを指定してリサイズ
view.resize(1920, 1080, 2);

// 現在の canvas サイズでリサイズ（ピクセル比率のみ更新）
view.resize(undefined, undefined, window.devicePixelRatio);
```

### setCamera()

カメラの位置と向きを即座に設定します。アニメーションなしで直接カメラを移動します。

**Syntax:**

```tsx
setCamera(camPos: CameraPosition): void
```

**Parameters:**

- `camPos`: カメラ位置と向き

```tsx
type CameraPosition = {
  lng?: number;
  lat?: number;
  height?: number;
  pitch?: number;
  heading?: number;
  roll?: number;
};
```

**Example:**

```tsx
view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  pitch: -45,
  heading: 0,
  roll: 0,
});
```

### moveCamera()

指定された方向に、指定された量だけカメラを移動します。

**Syntax:**

```tsx
moveCamera(move: CameraDirection, amount: number): void
```

**Parameters:**

- `move`: カメラの移動方向
- `amount`: 動かす量（メートル）

`CameraDirection` は以下の値を持つ enum です：

```tsx
enum CameraDirection {
  Forward,
  Backward,
  Left,
  Right,
  Up,
  Down,
}
```

**Example:**

```tsx
import ThreeView, { CameraDirection } from "@navara/three";

view.moveCamera(CameraDirection.Forward, 100);
view.moveCamera(CameraDirection.Up, 50);
```

### moveCameraWithDirection()

カスタム方向ベクトルでカメラを移動します。

**Syntax:**

```tsx
moveCameraWithDirection(dir: number[], amount: number): void
```

**Parameters:**

- `dir`: [x, y, z] 方向ベクトル
- `amount`: 動かす量（メートル）

**Example:**

```tsx
view.moveCameraWithDirection([1, 0, 0], 100);
```

### flyTo()

カメラをターゲット位置にアニメーションで移動します。飛行アーク（弧）を描いて滑らかに移動します。

**Syntax:**

```tsx
flyTo(
  camPos: CameraPosition & Required<Pick<CameraPosition, "lng" | "lat" | "height">>,
  duration?: number,
  maxHeight?: number
): void
```

**Parameters:**

- `camPos`: ターゲット位置。`lng`、`lat`、`height` は必須
  - `lng`: 経度（度）
  - `lat`: 緯度（度）
  - `height`: 高度（メートル）
  - `pitch`: ピッチ角（度）
  - `heading`: ヘディング角（度）
  - `roll`: ロール角（度）
- `duration`: アニメーション時間（ミリ秒）
- `maxHeight`: 飛行アーク中の最大高度（メートル）

**Example:**

```tsx
// 東京へ 3 秒かけて飛行（最大高度 5000m）
view.flyTo(
  {
    lng: 139.7671,
    lat: 35.6812,
    height: 1000,
    pitch: -45,
    heading: 0,
  },
  3000,
  5000
);
```

### lookAt()

カメラをターゲット位置に向け、オフセット位置に配置します。オフセットは East-North-Up（ENU）座標系で指定します。

**Syntax:**

```tsx
lookAt(target: LatLngHeight, offset: Vector3): void
```

**Parameters:**

- `target`: ターゲットの測地位置
  - `lng`: 経度（度）
  - `lat`: 緯度（度）
  - `height`: 高度（メートル）
- `offset`: ターゲットからのオフセット（ENU 座標系、メートル）
  - `x`: 東方向
  - `y`: 北方向
  - `z`: 上方向

**Example:**

```tsx
import { Vector3 } from "three";

// 東京タワーを 1000m 上空から見下ろす
view.lookAt(
  { lng: 139.7454, lat: 35.6586, height: 0 },
  new Vector3(0, 0, 1000) // 真上 1000m
);

// 斜め後ろから見る
view.lookAt(
  { lng: 139.7454, lat: 35.6586, height: 0 },
  new Vector3(500, -500, 500) // 東に 500m、南に 500m、上に 500m
);
```

### cameraFollow()

カメラフォローモードを有効または無効にします。有効にすると、カメラは指定されたターゲット位置を中心に移動します。

**Syntax:**

```tsx
cameraFollow(enabled: boolean, target?: LatLngHeight, offset?: Vector3): void
```

**Parameters:**

- `enabled`: フォローモードを有効にするかどうか
- `target`: 中心とするターゲット位置
  - `lng`: 経度（度）
  - `lat`: 緯度（度）
  - `height`: 高度（メートル）
- `offset`: ターゲットからのオフセット（ENU 座標系、メートル）

**Example:**

```tsx
import { Vector3 } from "three";

view.cameraFollow(
  true,
  { lng: 139.7671, lat: 35.6812, height: 100 },
  new Vector3(0, -200, 100) // 南に 200m、上に 100m
);

// フォローモードを無効にする
view.cameraFollow(false);
```

### sampleTerrainHeight()

指定した測地位置での地形の高さを同期的に取得します。地形データがまだ読み込まれていない場合は `undefined` を返します。

**Syntax:**

```tsx
sampleTerrainHeight(pos: LatLngHeight): number | undefined
```

**Parameters:**

- `pos`: 測地位置
  - `lat`: 緯度（ラジアン）
  - `lng`: 経度（ラジアン）
  - `height`: 無視されます

**Returns:**

地形の高さ（メートル）、または地形データが利用できない場合は `undefined`

**Example:**

```tsx
// 緯度・経度をラジアンで指定
const lat = degreeToRadian(35.6812);
const lng = degreeToRadian(139.7671);

const height = view.sampleTerrainHeight({
  lat,
  lng,
  height: 0,
});

if (height !== undefined) {
  console.log(`地形の高さ: ${height}m`);
} else {
  console.log("地形データがまだ読み込まれていません");
}
```

### observeTerrainHeightAt()

特定の位置での地形高さの変更を監視します。地形データが更新されるたびにコールバックが呼び出されます。

**Syntax:**

```tsx
observeTerrainHeightAt(pos: LatLng, cb: (height: number) => void): () => void
```

**Parameters:**

- `pos`: 監視する位置
  - `lat`: 緯度（ラジアン）
  - `lng`: 経度（ラジアン）
- `cb`: 高さが更新されたときに呼び出されるコールバック

**Returns:**

監視を停止するためのクリーンアップ関数

**Example:**

```tsx
// 緯度・経度をラジアンで指定
const lat = degreeToRadian(35.6812);
const lng = degreeToRadian(139.7671);

const cleanup = view.observeTerrainHeightAt({ lat, lng }, (height) => {
  console.log(`地形の高さが更新されました: ${height}m`);
});

// 後で監視を停止
cleanup();
```

### rotateAroundAxis()

指定した軸を中心にカメラを回転させます。ゼロベクトルを指定するとデフォルトの軸が使用されます。

**Syntax:**

```tsx
rotateAroundAxis(axis: Vector3, angle: number): void
```

**Parameters:**

- `axis`: 回転軸
- `angle`: 回転角度（ラジアン）

**Example:**

```tsx
import { Vector3 } from "three";

// Y 軸を中心に 45 度回転
view.rotateAroundAxis(new Vector3(0, 1, 0), Math.PI / 4);
```

### rotateAround()

カメラを現在の注視点またはビューの中心を軸に回転させます。

**Syntax:**

```tsx
rotateAround(angle: number): void
```

**Parameters:**

- `angle`: 回転角度（ラジアン）

**Example:**

```tsx
// 45 度回転
view.rotateAround(Math.PI / 4);

// 自動回転アニメーション
const animate = () => {
  view.rotateAround(0.005);
  requestAnimationFrame(animate);
};
animate();
```

### forceUpdate()

次のフレームでシーンを強制的に再レンダリングします。`animation: false` の場合に手動で更新をトリガーするときに使用します。

**Syntax:**

```tsx
forceUpdate(): void
```

**Example:**

```tsx
view.forceUpdate();
```

### pickTerrainPosition()

スクリーン座標で地形位置をピックします。マウスイベントの `clientX`、`clientY` と同じ CSS ピクセル座標を使用します。

**Syntax:**

```tsx
pickTerrainPosition(x: number, y: number): Vector3 | null
```

**Parameters:**

- `x`: スクリーン X 座標（CSS ピクセル、`MouseEvent.clientX` と同じ）
- `y`: スクリーン Y 座標（CSS ピクセル、`MouseEvent.clientY` と同じ）

**Returns:**

ワールド位置（ECEF 座標）、または地形がヒットしない場合は `null`

**Example:**

```tsx
// クリック位置の地形座標を取得
view.on("click", (event) => {
  const position = view.pickTerrainPosition(event.clientX, event.clientY);
  if (position) {
    console.log(`ECEF 座標: ${position.x}, ${position.y}, ${position.z}`);
  } else {
    console.log("地形がヒットしませんでした");
  }
});
```

### registerMesh()

カスタムメッシュレイヤークラスを登録します。

**Syntax:**

```tsx
registerMesh(name: string, meshClass: MeshLayerConstructor): void
```

**Parameters:**

- `name`: 登録するメッシュレイヤーの名前
- `meshClass`: メッシュレイヤーのコンストラクタ

**Example:**

```tsx
class CustomMeshLayer extends MeshLayer {
  onCreate() {
    // カスタム実装
  }
}

view.registerMesh("customMesh", CustomMeshLayer);
```

### registerLight()

カスタムライトレイヤークラスを登録します。

**Syntax:**

```tsx
registerLight(name: string, lightClass: LightLayerConstructor): void
```

**Parameters:**

- `name`: 登録するライトレイヤーの名前
- `lightClass`: ライトレイヤーのコンストラクタ

**Example:**

```tsx
class CustomLightLayer extends LightLayer {
  onCreate() {
    // カスタム実装
  }
}

view.registerLight("customLight", CustomLightLayer);
```

### registerEffect()

カスタムエフェクトレイヤークラスを登録します。

**Syntax:**

```tsx
registerEffect(name: string, effectClass: EffectLayerConstructor): void
```

**Parameters:**

- `name`: 登録するエフェクトレイヤーの名前
- `effectClass`: エフェクトレイヤーのコンストラクタ

**Example:**

```tsx
class CustomEffectLayer extends EffectLayer {
  onCreate() {
    // カスタム実装
  }
}

view.registerEffect("customEffect", CustomEffectLayer);
```

### addPlugin()

プラグインを登録します。`view.init()` の前に呼び出す必要があります。

**Syntax:**

```tsx
addPlugin(plugin: Plugin): this
```

**Parameters:**

- `plugin`: `Plugin` インスタンス

**Example:**

```typescript
const view = new ThreeView({});
view.addPlugin(pluginA).addPlugin(pluginB);
await view.init();
```
