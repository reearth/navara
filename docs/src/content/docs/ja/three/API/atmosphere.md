---
title: Atmosphere Class
description: 大気システムと太陽・月の位置計算を管理する Atmosphere クラスの API リファレンス
sidebar:
  order: 20
---

`Atmosphere` クラスは、大気レンダリングのコンテキストを管理します。太陽と月の位置を設定された日時から自動計算し、大気散乱シミュレーション用のテクスチャを管理します。

`ThreeView` インスタンスは `atmosphere` プロパティを通じてこのクラスのインスタンスを保持しており、`SunLightDesc`、`SkyMeshDesc`、`AerialPerspectiveEffectDesc` など大気に関連するレイヤーはこのインスタンスを参照して動作します。

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
view.atmosphere.setDate(new Date("2024-06-21T12:00:00"));
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

## 大気システムと他のレイヤーの連携

`Atmosphere` クラスは以下のレイヤーと自動的に連携します：

| レイヤー | 連携内容 |
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
