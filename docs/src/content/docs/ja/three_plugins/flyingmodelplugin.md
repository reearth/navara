---
title: FlyingModelPlugin
description: navara_three 向けのキーボード操作 GLTF モデル飛行プラグイン。
sidebar:
  order: 2
---

## 概要

`FlyingModelPlugin` は GLTF モデルを地球上にロードし、キーボード操作で飛行させるプラグインです。追従カメラがスムーズな補間でモデルを追いかけます。毎フレーム位置状態をブロードキャストするため、インタラクティブな UI を構築しやすくなっています。

モデルに依存しない設計で、アイドルとダッシュの 2 つ以上のアニメーションクリップを持つ任意のアニメーション付き GLTF を使用できます。

## 使い方

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { FlyingModelPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container, animation: true });
const defaultPlugin = new DefaultPlugin();
const flyingModel = new FlyingModelPlugin({
  modelUrl: "/glTF/bird/scene.gltf",
  animation: {
    idleClip: "Gliding",
    dashClip: "Flapping",
    speed: 1.0,
    crossfadeDuration: 0.3,
  },
  modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
});

view.addPlugin(defaultPlugin);
view.addPlugin(flyingModel);
await view.init();

// 初期化後にフライトループを開始
flyingModel.start();

// 位置更新を購読
const unsub = flyingModel.onStateChange((state) => {
  console.log(state.lat, state.lng, state.alt, state.heading);
});

// 新しい位置にテレポート
flyingModel.teleport(139.77, 35.68, 300);

// クリーンアップ
unsub();
flyingModel.dispose();
```

## キーボード操作

| キー | アクション |
|------|-----------|
| W / S | 前進 / 後退 |
| A / D | 左旋回 / 右旋回 |
| Arrow Up / Down | 上昇 / 下降 |
| Shift | ダッシュ（2.5 倍速） |
| Alt | オービットカメラモード |

`<input>`、`<textarea>`、`contenteditable` 要素にフォーカスがある場合、キーボード入力は自動的に抑制されます。`flyingModel.movementSuppressed = true` を設定すると、すべての移動キーを一時的に無効にすることもできます（モーダルダイアログの表示中など）。

## コンストラクタ

```typescript
new FlyingModelPlugin(config: FlyingModelConfig)
```

### FlyingModelConfig

| プロパティ | 型 | デフォルト | 説明 |
|-----------|------|---------|------|
| `modelUrl` | `string` | **（必須）** | ロードする GLTF モデルの URL |
| `animation` | `AnimationConfig` | **（必須）** | アニメーションクリップの設定 |
| `modelRotationOffset` | `ModelRotationOffset` | `{ x: 0, y: 0, z: 0 }` | モデルのデフォルト向きを補正する回転オフセット |
| `flightSpeed` | `number` | `50` | 飛行速度（m/s） |
| `rotationSpeed` | `number` | `3` | 旋回速度（deg/frame） |
| `altSpeed` | `number` | `30` | 高度変更速度（m/s） |
| `minAlt` | `number` | `50` | 最低高度（メートル） |
| `maxAlt` | `number` | `5000` | 最高高度（メートル） |
| `modelScale` | `number` | `3` | モデルのスケール倍率 |
| `cameraDistance` | `number` | `50` | 追従カメラの距離（メートル） |
| `cameraHeight` | `number` | `20` | 追従カメラの高さオフセット（メートル） |
| `cameraLerpSpeed` | `number` | `3` | カメラ回転の補間速度 |
| `startLat` | `number` | `35.6812` | 開始緯度（度） |
| `startLng` | `number` | `139.7671` | 開始経度（度） |
| `startHeight` | `number` | `500` | 開始高度（メートル） |
| `startYaw` | `number` | `Math.PI * 1.3` | 開始方位（ラジアン） |

### AnimationConfig

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `idleClip` | `string` | アイドル時または通常移動時に再生されるクリップ名 |
| `dashClip` | `string` | ダッシュ時（Shift 押下中）に再生されるクリップ名 |
| `speed` | `number` | 再生速度の倍率 |
| `crossfadeDuration` | `number` | クリップ間のクロスフェード遷移時間（秒） |

### ModelRotationOffset

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `x` | `number` | X 軸周りの回転オフセット（ラジアン） |
| `y` | `number` | Y 軸周りの回転オフセット（ラジアン） |
| `z` | `number` | Z 軸周りの回転オフセット（ラジアン） |

## メソッド

### start()

```typescript
start(): void
```

GLTF モデルをロードし、フライトアニメーションループを開始します。`view.init()` の完了**後**に呼び出す必要があります。

### teleport(lng, lat, alt, heading?)

```typescript
teleport(lng: number, lat: number, alt: number, heading?: number): void
```

モデルを新しい地理的位置に瞬時に移動させます。`heading` を省略した場合、現在のカメラヨーが維持されます。

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `lng` | `number` | 経度（度） |
| `lat` | `number` | 緯度（度） |
| `alt` | `number` | 高度（メートル） |
| `heading` | `number \| undefined` | 方位（度、省略可） |

### getState()

```typescript
getState(): FlyingModelState
```

現在のフライト状態を返します。

### onStateChange(fn)

```typescript
onStateChange(fn: (state: FlyingModelState) => void): () => void
```

毎アニメーションフレームで発行される位置更新を購読します。購読解除関数を返します。

### dispose()

```typescript
dispose(): void
```

アニメーションループを停止し、キーボードリスナーを削除し、シーンからモデルを削除します。

## FlyingModelState

`onStateChange()` で発行される状態オブジェクト：

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `lng` | `number` | 現在の経度（度） |
| `lat` | `number` | 現在の緯度（度） |
| `alt` | `number` | 現在の高度（メートル） |
| `heading` | `number` | 現在の方位（度、0 = 北、90 = 東） |
| `speed` | `number` | 現在の速度（m/s、静止時は 0） |
| `animationState` | `string` | 現在再生中のアニメーションクリップ名 |

## 関連リソース

- [OverlayPlugin](../overlayplugin/) — FlyingModelPlugin と組み合わせてワールド空間の HTML オーバーレイを実現
- [About three_plugins](../about/) — パッケージ概要
