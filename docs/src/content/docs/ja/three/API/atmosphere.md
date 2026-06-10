---
title: Atmosphere Class
description: 大気システムと太陽・月の位置計算を管理する Atmosphere クラスの API リファレンス
sidebar:
  order: 20
---

`Atmosphere` クラスは、大気レンダリングのコンテキストを管理します。太陽と月の位置を設定された日時から自動計算し、大気散乱シミュレーション用のテクスチャを管理します。

`ThreeView` インスタンスは `atmosphere` プロパティを通じてこのクラスのインスタンスを保持しており、`SunLightDesc`、`SkyMeshDesc`、`AerialPerspectiveEffectDesc` など大気に関連する Descriptor はこのインスタンスを参照して動作します。

## 基本的な使用例

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView({
  atmosphere: {
    date: new Date("2024-06-21T12:00:00"),
  },
});

await view.init();

// 日時を変更して太陽位置を更新
view.atmosphere.date = new Date("2024-12-21T18:00:00");

// 太陽の方向ベクトルを取得
const sunDirection = view.atmosphere.getSunDirection();

// 月の方向ベクトルを取得
const moonDirection = view.atmosphere.getMoonDirection();
```

## Properties

### date

**Type:** `Date`

**Description:** 太陽・月の位置計算に使用する日時。値を変更すると自動的に天体位置が再計算されます。

**Default:** `new Date()`（現在日時）

**Example:**

```typescript
view.atmosphere.date = new Date("2024-06-21T12:00:00");
```

### sunDirection

**Type:** `Vector3`（読み取り専用）

**Description:** 現在の太陽方向ベクトル（ECEF 座標系）。直接変更せず、`getSunDirection()` メソッドでクローンを取得することを推奨します。

### moonDirection

**Type:** `Vector3`（読み取り専用）

**Description:** 現在の月方向ベクトル（ECEF 座標系）。直接変更せず、`getMoonDirection()` メソッドでクローンを取得することを推奨します。

## Methods

### getSunDirection()

太陽方向ベクトルのクローンを取得します。

**Syntax:**

```typescript
getSunDirection(): Vector3
```

**Returns:**

ECEF 座標系での太陽方向を表す新しい `Vector3` インスタンス。

**Example:**

```typescript
const sunDir = view.atmosphere.getSunDirection();
console.log("太陽方向:", sunDir.x, sunDir.y, sunDir.z);
```

### getMoonDirection()

月方向ベクトルのクローンを取得します。

**Syntax:**

```typescript
getMoonDirection(): Vector3
```

**Returns:**

ECEF 座標系での月方向を表す新しい `Vector3` インスタンス。

**Example:**

```typescript
const moonDir = view.atmosphere.getMoonDirection();
console.log("月方向:", moonDir.x, moonDir.y, moonDir.z);
```

### isAtNight()

指定した位置が地球の夜側にあるかどうかを判定します。

**Syntax:**

```typescript
isAtNight(position: XYZ): boolean
```

**Parameters:**

- `position`: 判定対象の位置（ECEF 座標系）

**Returns:**

夜側にある場合は `true`、昼側にある場合は `false`。

**Example:**

```typescript
const cameraPosition = view.camera.position;
const isNight = view.atmosphere.isAtNight({
  x: cameraPosition.x,
  y: cameraPosition.y,
  z: cameraPosition.z,
});

if (isNight) {
  console.log("現在地は夜です");
}
```

### setDateAt()

`from` のローカル太陽時と一致するよう、`to` の `atmosphere.date` を調整します。

計算は太陽の**時角**（ローカル子午線から太陽までの角距離）に基づきます。時角は1太陽日で単調に増加するため、1日に解が1つしかなく朝・午後の分岐が不要です。均時差（経度/15 の単純計算から最大±16分のずれ）は自動的に補正されます。

**Syntax:**

```typescript
setDateAt(from: { lng: number; lat?: number }, to: { lng: number; lat?: number }): void
```

**Parameters:**

- `from.lng`: 基準経度（度）。計算に影響するのはこの値のみです。
- `to.lng`: 目標経度（度）。計算に影響するのはこの値のみです。

**Example:**

```typescript
// atmosphere.date が東京（lng=139.69°）のローカル太陽時 08:00 を表している場合
view.atmosphere.setDateAt({ lng: 139.69 }, { lng: 0 });
// → atmosphere.date がロンドン（lng = 0°）のローカル太陽時 08:00 になる
```

### setElevationAt()

`from` での太陽仰角と一致するよう、`to` の `atmosphere.date` を調整します。

`setDateAt()` と異なり、結果は**緯度に依存します**。太陽が到達できる最大仰角は緯度によって異なるためです。朝・午後のコンテキスト（太陽が上昇中か下降中か）は `from` の太陽時に基づいて自動的に保持されます。目標仰角が `to` の場所で達成できない場合（極夜など）は、太陽正午にクランプされます。

**Syntax:**

```typescript
setElevationAt(from: { lat: number; lng: number }, to: { lat: number; lng: number }): void
```

**Parameters:**

- `from`: 基準位置。`lat` と `lng` の両方が必要です。
- `to`: 目標位置。`lat` と `lng` の両方が必要です。

**Example:**

```typescript
// atmosphere.date が東京上空で太陽仰角 30° を表している場合
view.atmosphere.setElevationAt({ lat: 35.68, lng: 139.69 }, { lat: 51.5, lng: -0.12 });
// → ロンドン上空でも太陽仰角が 30° になるよう atmosphere.date を調整
```

### setDateFromCameraAt()

現在のカメラ位置を `from` として使用する `setDateAt()` の利便性ラッパーです。

**Syntax:**

```typescript
setDateFromCameraAt(to: { lng: number; lat?: number }): void
```

**Parameters:**

- `to.lng`: 目標経度（度）。

**Example:**

```typescript
// カメラが東京上空にあり、atmosphere.date がローカル太陽時 08:00 を表している場合
view.atmosphere.setDateFromCameraAt({ lng: 0 }); // ロンドンに合わせて調整
// → atmosphere.date がロンドン（lng = 0°）のローカル太陽時 08:00 になる
```

```typescript
// カメラを都市に移動して太陽時を同期する
view.setCamera({ lng: -0.12, lat: 51.5, height: 500, distance: 12000 });
view.atmosphere.setDateFromCameraAt({ lng: -0.12 });
```

### setElevationFromCameraAt()

現在のカメラ位置を `from` として使用する `setElevationAt()` の利便性ラッパーです。

**Syntax:**

```typescript
setElevationFromCameraAt(to: { lat: number; lng: number }): void
```

**Parameters:**

- `to.lng`: 目標経度（度）。
- `to.lat`: 目標緯度（度）。

**Example:**

```typescript
// カメラが東京上空にあり、太陽仰角が 30°（朝）の場合
view.atmosphere.setElevationFromCameraAt({ lat: 51.5, lng: -0.12 }); // ロンドン
// → ロンドン上空でも太陽仰角が 30° になるよう atmosphere.date を調整
```

```typescript
// カメラを都市に移動して太陽仰角を合わせる
view.setCamera({ lng: -74.01, lat: 40.71, height: 500, distance: 12000 });
view.atmosphere.setElevationFromCameraAt({ lng: -74.01, lat: 40.71 });
```

## setDateAt と setElevationAt の比較

| | `setDateAt` / `setDateFromCameraAt` | `setElevationAt` / `setElevationFromCameraAt` |
|---|---|---|
| 揃える対象 | 時角（太陽の東西方向位置） | 仰角（地平線からの高さ） |
| 緯度の影響 | なし（経度のみ依存） | あり（最大仰角が緯度で変わる） |
| 1日の解の数 | 1つのみ | 2つ（朝・午後）— コンテキストは自動保持 |
| 極夜の扱い | 該当なし | 太陽正午にクランプ |
| 主な用途 | 「同じ時間帯」の光を再現 | 「影の長さ・明るさ」を揃える |

## Events

### sunChanged

太陽の方向が変更されたときに発火します。

**Handler Type:**

```typescript
(sunDirection: Vector3) => void
```

**Parameters:**

- `sunDirection`: 新しい太陽方向ベクトル（クローン）

**Example:**

```typescript
view.atmosphere.on("sunChanged", (sunDirection) => {
  console.log("太陽方向が変更されました:", sunDirection);
});
```

## 大気システムと他の Descriptor の連携

`Atmosphere` クラスは以下の Descriptor と自動的に連携します：

| Descriptor | 連携内容 |
|----------|----------|
| `SunLightDesc` | 太陽方向に基づいてライトの向きを更新 |
| `SkyMeshDesc` | 太陽・月の描画位置を更新 |
| `StarsDesc` | 太陽方向に基づいて星の位置を更新 |
| `SkyLightProbeDesc` | 太陽方向に基づいて環境光を計算 |
| `AerialPerspectiveEffectDesc` | 大気テクスチャを使用した空気遠近法 |
| `CloudsEffectDesc` | 大気テクスチャを使用した雲の描画 |

## AtmosphereOptions

`ThreeView` コンストラクタで指定可能な大気オプション：

```typescript
type AtmosphereOptions = {
  /** 大気アセットファイルの URL */
  atmosphereAssetsUrl?: string;
  /** STBN（時空間ブルーノイズ）テクスチャの URL */
  stbnUrl?: string;
  /** 太陽・月の位置計算に使用する日時 */
  date?: Date;
};
```

**Example:**

```typescript
const view = new ThreeView({
  atmosphere: {
    atmosphereAssetsUrl: "/assets/atmosphere",
    stbnUrl: "/assets/stbn",
    date: new Date("2024-06-21T12:00:00"),
  },
});
```
