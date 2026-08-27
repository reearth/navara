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
| `matrix`      | `Matrix4`                             | -          | ローカル変換行列。設定時は `position`/`rotation`/`scale` がこのフレーム内のオフセットになる。`matrixWorld`/`geodetic` とは併用不可 |
| `matrixWorld` | `Matrix4`                             | -          | ワールド変換行列。設定時は `position`/`rotation`/`scale` がこのフレーム内のオフセットになる。`matrix`/`geodetic` とは併用不可 |
| `geodetic`    | `GeodeticPlacement`                   | -          | 度単位の地理的配置（[地理的配置](#地理的配置geodetic) を参照）。`matrix`/`matrixWorld` とは併用不可 |
| `lit`         | `boolean`                             | -          | メッシュのすべてのマテリアルに適用するライティングの上書き。未設定なら `view.lit` に従う（[Lighting](#lighting-lit) を参照） |
| `pickable`    | `boolean`                             | `false`    | GPU ベースのクリックピッキングを有効にする。ピッキング対応のメッシュ Descriptor が Descriptor ごとに定義するもので、基底の設定には存在しない |

## トランスフォーム合成

`MeshDesc` は3つのトランスフォームモードをサポートしています。`matrix`、`matrixWorld`、`geodetic` はいずれもオブジェクトの配置を定義するため、設定できるのは最大1つだけです。2つ以上を同時に設定すると `ConflictingTransformError` が発生します。

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
} from "@navaramap/three";
import { BoxMeshDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
view.registerMesh("box", BoxMeshDesc);
await view.init();

// 地理的な原点での ENU フレームを計算
const origin = geodeticToVector3({
  lat: 35.681236,
  lng: 139.767125,
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// 原点から東に200m、北に50mの位置にボックスを配置
const box1 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 100, depth: 50, color: new Color().setHex(0xff0000) },
  matrixWorld: enuFrame,
  position: { x: 200, y: 50, z: 0 },
});

// 原点から北に40m、上に100mの位置にもう1つのボックスを配置
const box2 = view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 80, depth: 50, color: new Color().setHex(0x00ff00) },
  matrixWorld: enuFrame,
  position: { x: 0, y: 40, z: 100 },
});
```

## 地理的配置（`geodetic`）

`geodetic` は、地球上にオブジェクトを配置するための高レベルな方法です。すべての値は度とメートルで指定し、`setCamera` と一致します。

```typescript
import ThreeView from "@navaramap/three";
import { GLTFModelDesc } from "@navaramap/three-default-descs";

const car = view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  geodetic: {
    lng: 138.036142,
    lat: 36.085621,
    height: 1,
    heading: 321,
    pitch: 0,
    roll: 0,
  },
});

// その場で回転させる — 部分的な更新でも lng/lat/height は維持される
car.update({ geodetic: { heading: 330 } });
```

| プロパティ | 単位 | 正方向 | デフォルト |
| --- | --- | --- | --- |
| `lng`、`lat` | 度 | - | 必須 |
| `height` | メートル | 上 | `0` |
| `heading` | 度 | 北から時計回り | `0` |
| `pitch` | 度 | ノーズアップ | `0` |
| `roll` | 度 | 右翼下げ | `0` |
| `scale` | 比率 | - | `1` |
| `heightReference` | `"ellipsoid"` \| `"terrain"` | - | `"ellipsoid"` |

`heading` はオブジェクトの前方が向くコンパス方位で、`setCamera` の heading と同じ規約です。

### 合成

`geodetic` は `matrixWorld` と同じスロットを占めるため、合成規則は上で説明したものと同じです:

```
effective = geodetic · T(position) · R(rotation) · S(scale)
```

そのため `position`、`rotation`、`scale` は、配置されたフレーム*内側*のオフセットのままです。`geodetic` を `matrix` や `matrixWorld` と同時に設定すると、両方が同じ配置を定義しようとするため `ConflictingTransformError` が発生します。`matrix` と `matrixWorld` を同時に設定した場合も同様です。

`geodetic.scale` とトップレベルの `scale` はどちらも設定できますが、同じものではありません。`geodetic.scale` はフレーム自体をスケールするため `position` オフセットにも影響しますが、`scale` はオブジェクトのみをスケールします。

### 地形相対高度

`heightReference: "terrain"` を指定すると、`height` は楕円体からの高さではなく、地形からの高さ（メートル）になります:

```typescript
view.addMesh<GLTFModelDesc>({
  gltfModel: { url: "/glTF/car/scene.gltf" },
  geodetic: {
    lng: 138.036142,
    lat: 36.085621,
    height: 0,
    heightReference: "terrain",
    heading: 321,
  },
});
```

知っておくべき挙動が3つあります:

- 地形が精細化されるにつれて、オブジェクトは**目に見えて位置が落ち着きます**。高さは、すでに読み込まれているタイルから初期値が与えられ、より詳細なタイルが到着するたびに更新されます。
- クランプは、名前を指定したソースではなく**アクティブな地形**に従います。
- **地形レイヤーが追加されていない**場合、配置は `"ellipsoid"` と同じように振る舞います。地形レイヤーはオブジェクトを追加した後から追加できます。

## 軸の向きの規約（glTF の Y-up とタイルの Z-up）

glTF は Y-up です。`GLTFLoader` はアセット自身の軸をそのまま保持し、glTF 2.0 仕様ではアセットの前方を `+Z`、上方を `+Y`、右方を `-X` としています。一方、3D Tiles の規約（そして最も自然に手に取りたくなるフレームである `eastNorthUpToFixedFrame`）は Z-up です。この2つを手作業でつなぐには `Rx(+90°)` の補正を挿入し、さらにその上で残り90°分の heading を正しく調整する必要があります。

**`geodetic` を使えば、補正すべきことは何もありません。** `geodetic` は **West-Up-North（WUN）** 接線フレームを構築します: `+x` が西、`+y` が上、`+z` が北です。WUN は `+Z` 軸が北を指す唯一の右手系 Y-up 接線フレームであり、前方・上方・右方の3軸すべてで glTF と一致します。`Rx(+90°)` は、オブジェクトごとに適用するのではなく、NUE からの `Ry(+90°)` 基底変換として、フレーム定義そのものに一度だけ吸収されています。

これは glTF に限らず、すべてのメッシュ Descriptor に当てはまります。Three.js のプリミティブも Y-up です（`CylinderGeometry` の軸は `+Y`）。そのため、同じフレームが `BoxMeshDesc`、`CylinderMeshDesc`、カスタム Descriptor にも正しく機能します。

自分でフレームを指定する場合は、軸について考える必要があります:

| フレーム | 軸 (x, y, z) | 上 | glTF への補正が必要か |
| --- | --- | --- | --- |
| `geodetic`（WUN） | 西、上、北 | Y | **不要** |
| `westUpNorthToFixedFrame` | 西、上、北 | Y | **不要** |
| `northUpEastToFixedFrame` | 北、上、東 | Y | Y-up なので問題ないが、回転ゼロの状態でアセットは**東**を向く |
| `eastNorthUpToFixedFrame` | 東、北、上 | Z | 必要: `Rx(+90°)` |
| `northWestUpToFixedFrame` | 北、西、上 | Z | 必要: `Rx(+90°)` |
| `northEastDownToFixedFrame` | 北、東、下 | −Z | 必要 |

### 他のエンジンからの移行

3D 地球エンジンごとに回転の規約は異なり、よくある相違点は glTF アセットのどの軸を前方として扱うかです。移植したモデルが 90° の倍数だけ回転してしまう場合は、まずここを確認してください。

Navara の規則には例外がありません。`heading` はアセットの前方が向くコンパス方位で、前方とは glTF 自身の `+Z` です。方位321°の道路上のモデルには `heading: 321` を指定します。緯度やメッシュ Descriptor の種類にかかわらず同じです。

```typescript
geodetic: { lng, lat, height, heading: 321 }
```

## Lighting (`lit`)

`lit` はメッシュ配下の**すべて**のマテリアル（読み込んだモデルの子要素を含む）に適用される、3 状態のライティング上書きです。

| 値 | 結果 |
| --- | --- |
| `true` | [`view.lit`](../../../three/api/threeview-properties/#lit) が `false` でも lit |
| `false` | アルベドのみ。カラー出力でライティング計算がスキップされる |
| 未設定（`undefined`） | `view.lit` に従う（既定は `true`） |

`lit: false` にしても lit パイプラインが止まるわけではありません。法線とシャドウ G-buffer は書き込まれ続けるため、後段のポストプロセスパスでアルベドを再ライティングできます。

```typescript
// view.lit に従う
const box = view.addMesh<BoxMeshDesc>({ box: { width: 100 }, position });

// view.lit の値に関わらず常に lit
const sphere = view.addMesh<SphereMeshDesc>({
  sphere: { radius: 100 },
  position,
  lit: true,
});

// 後から変更する
sphere.update({ lit: false });

// undefined を明示的に渡すと view.lit に従う状態へ戻る
sphere.update({ lit: undefined });
```

:::note
`lit` の変更はメッシュのシェーダーを一度再コンパイルします。毎フレーム制御するものではなく、構成の切り替えとして扱ってください。もともとライティングを行わないメッシュ（ポイント、スプライト、テキスト、素の `ShaderMaterial`）は影響を受けません。
:::

マテリアルを非同期に組み立てる Descriptor（glTF の読み込みなど）は、マテリアルが揃った時点で基底クラスの `applyLit()` を呼び出して上書きを再適用します。

## ピッキング

メッシュは、Descriptor設定で `pickable: true` を指定することで GPU ベースのクリックピッキングを有効にできます。ピッキングシステムは、ピッカブルメッシュを専用の 1 ピクセルのレンダーターゲットに各メッシュのバッチ ID を RGB カラーとしてエンコードして描画し、ピクセルを読み取って `"pick"` イベントを発行してクリックされたメッシュを特定します。

:::note
ピッキングを使用するには、ThreeView のコンストラクタで `picking: true` を設定する必要があります。
:::

### 基本的な使い方

```typescript
import ThreeView, { Color } from "@navaramap/three";
import { BoxMeshDesc } from "@navaramap/three-default-descs";

const view = new ThreeView({ picking: true });
view.registerMesh("box", BoxMeshDesc);
await view.init();

const boxDesc = view.addMesh<BoxMeshDesc>({
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
const batchId = boxDesc.ref.batchId;

// インスタンスメッシュ — インスタンスごとに1つのバッチ ID
const batchIds = instancedDesc.ref.batchIds;
```

### ピックへの応答

```typescript
view.on("pick", (info) => {
  if (info && info.batchId === boxDesc.ref.batchId) {
    // 選択されたボックスをハイライト
    boxDesc.update({ box: { color: new Color().setHex(0xffff00) } });
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

カスタム Descriptor でのピッキング実装については、[Custom Descriptor: ピッキングの実装](../../../three/core/custom-desc/#カスタム-descriptor-でのピッキング実装) を参照してください。

## 座標変換

`position` プロパティは ECEF（Earth-Centered, Earth-Fixed）座標系を使用します。緯度・経度・高度（測地座標系）から ECEF に変換するには、`geodeticToVector3()` 関数を使用します。

:::note
緯度・経度は**度**で指定します。
:::

### 基本的な座標変換

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
} from "@navaramap/three";
import { SphereMeshDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
view.registerMesh("sphere", SphereMeshDesc);
await view.init();

// 緯度・経度・高度からECEF座標に変換
const position = geodeticToVector3({
  lat: 35.681236,  // 緯度（度）
  lng: 139.767125, // 経度（度）
  height: 200,                      // 高度（メートル）
});

// 変換した座標でメッシュを追加
const sphereDesc = view.addMesh<SphereMeshDesc>({
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

### ローカル接線フレームの使用（ENU ほか）

`position` プロパティはデフォルトで直交座標系（ECEF）です。そのため、単に `position` を指定しただけでは、指定した経度・緯度でメッシュが正しく上向きに立ちません。地理的に配置するには、原点でのローカル接線フレームを計算して `matrixWorld` に渡します。すると `position`/`rotation`/`scale` はそのフレーム内のオフセットとして解釈されます。

メッシュが想定する軸の向きに合わせてフレーム関数を選びます。いずれも ECEF 原点（`Vector3`）を受け取り `Matrix4` を返し、すべて `@navaramap/three` からエクスポートされています:

| 関数 | ローカル軸 (x, y, z) |
| ------ | ------ |
| `eastNorthUpToFixedFrame()` | 東、北、上 |
| `northEastDownToFixedFrame()` | 北、東、下 |
| `northUpEastToFixedFrame()` | 北、上、東 |
| `northWestUpToFixedFrame()` | 北、西、上 |

最も一般的な選択は ENU（`eastNorthUpToFixedFrame()`）です:

```typescript
import {
  geodeticToVector3,
  eastNorthUpToFixedFrame,
} from "@navaramap/three";
import { GLTFModelDesc } from "@navaramap/three-default-descs";

// GLTFModelDesc が登録済みであること

const origin = geodeticToVector3({
  lat: 35.681236,
  lng: 139.767125,
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);

// モデルを地表面に沿って配置
const modelDesc = view.addMesh<GLTFModelDesc>({
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
| `eastNorthUpToFixedFrame()` | 原点での ENU（東-北-上）接線フレーム行列を取得         |
| `northEastDownToFixedFrame()` | 原点での NED（北-東-下）接線フレーム行列を取得       |
| `northUpEastToFixedFrame()` | 原点での NUE（北-上-東）接線フレーム行列を取得         |
| `northWestUpToFixedFrame()` | 原点での NWU（北-西-上）接線フレーム行列を取得         |

詳細は [navara_three_api](../../../three/api/navara_three_api) を参照してください。
