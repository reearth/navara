---
title: GLTFModelDesc
description: GLTF model layer for navara_three
sidebar:
  order: 113
---

`GLTFModelDesc`クラスは、GLTF/GLB形式の3Dモデルを読み込み・表示するメッシュです。アニメーション再生、影の設定、動的な更新などの機能を提供します。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-layer-base) を参照してください。

## Properties

### url

**Type:** `string`

**Description:** 読み込むGLTF/GLBファイルのURLを指定します。必須パラメータです。

**Example:**

```typescript
{
  gltfModel: {
    url: "https://example.com/models/character.glb",
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** モデルが影を投影するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** モデルが影を受けるかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    receiveShadow: true,
  }
}
```

### animationEnabled

**Type:** `boolean`

**Description:** アニメーションを有効にするかどうかを指定します。

**Example:**

```typescript
{
  gltfModel: {
    animationEnabled: true,
  }
}
```

### animationClips

**Type:** `string[]`

**Description:** 利用可能なアニメーションクリップ名のリストを指定します。読み取り専用の情報として使用されます。

**Example:**

```typescript
{
  gltfModel: {
    animationClips: ["Walk", "Run", "Jump"],
  }
}
```

### animationActiveClip

**Type:** `string`

**Description:** 現在アクティブなアニメーションクリップ名を指定します。

**Example:**

```typescript
{
  gltfModel: {
    animationActiveClip: "Walk",
  }
}
```

### animationSpeed

**Type:** `number`

**Description:** アニメーションの再生速度を指定します。1.0が通常速度です。

**Default:** `1.0`

**Example:**

```typescript
{
  gltfModel: {
    animationSpeed: 1.5, // 1.5倍速
  }
}
```

### animationLoop

**Type:** `boolean`

**Description:** アニメーションをループ再生するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  gltfModel: {
    animationLoop: true,
  }
}
```

### animationCrossfadeDuration

**Type:** `number`

**Description:** アニメーション切り替え時のクロスフェード時間を秒単位で指定します。

**Default:** `0.3`

**Example:**

```typescript
{
  gltfModel: {
    animationCrossfadeDuration: 0.5, // 0.5秒
  }
}
```

### animationAutoPlay

**Type:** `boolean`

**Description:** モデル読み込み後に自動的にアニメーションを再生するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  gltfModel: {
    animationAutoPlay: true,
  }
}
```

## メソッド

### getAnimationAvailable()

**Description:** 利用可能なアニメーションクリップ名の配列を取得します。

**Returns:**

利用可能なアニメーションクリップ名の配列

**Example:**

```typescript
const clips = modelLayer.getAnimationAvailable();
console.log(clips); // ["Walk", "Run", "Jump"]
```

### getAnimationDetails(name?: string)

**Description:** アニメーションの詳細情報を取得します。名前を指定した場合は特定のアニメーションの詳細を、指定しない場合はすべてのアニメーションの詳細を返します。

**Parameters:**

- `name`: 特定のアニメーション名

**Returns:**

アニメーションの詳細情報

**Example:**

```typescript
const details = modelLayer.getAnimationDetails("Walk");
console.log(details);
// { name: "Walk", duration: 2.5, tracks: 45, isLooping: true, timeScale: 1.0 }
```

### getAnimationCurrentState()

**Description:** 現在のアニメーション再生状態を取得します。

**Returns:**

現在のアニメーション再生状態

**Example:**

```typescript
const state = modelLayer.getAnimationCurrentState();
console.log(state);
// {
//   isPlaying: true,
//   currentAnimation: "Walk",
//   isBlendMode: false,
//   blendAnimations: [],
//   playbackTime: 1.23,
//   progress: 0.492
// }
```

### playAnimation(name: string)

**Description:** 指定したアニメーションを再生します。成功した場合はtrueを返します。

**Parameters:**

- `name`: 再生するアニメーションクリップ名

**Returns:**

成功した場合は true

**Example:**

```typescript
modelLayer.playAnimation("Run");
```

### crossFadeAnimation(from: string, to: string, duration: number)

**Description:** 2つのアニメーション間でクロスフェードを実行します。

**Parameters:**

- `from`: 元のアニメーションクリップ名
- `to`: 遷移先のアニメーションクリップ名
- `duration`: クロスフェード時間(秒)

**Returns:**

成功した場合は true

**Example:**

```typescript
modelLayer.crossFadeAnimation("Walk", "Run", 0.5);
```

### blendAnimations(animations: { name: string, weight: number }[])

**Description:** 複数のアニメーションを同時にブレンドして再生します。

**Parameters:**

- `animations`: アニメーション名とウェイトの配列

**Example:**

```typescript
modelLayer.blendAnimations([
  { name: "Walk", weight: 0.7 },
  { name: "Run", weight: 0.3 }
]);
```

### stopAnimation()

**Description:** 現在再生中のアニメーションを停止します。

**Example:**

```typescript
modelLayer.stopAnimation();
```

### pauseAnimation()

**Description:** 現在再生中のアニメーションを一時停止します。

**Example:**

```typescript
modelLayer.pauseAnimation();
```

### resumeAnimation()

**Description:** 一時停止中のアニメーションを再開します。

**Example:**

```typescript
modelLayer.resumeAnimation();
```

### setAnimationSpeed(speed: number)

**Description:** アニメーションの再生速度を設定します。

**Parameters:**

- `speed`: アニメーション速度(1.0が通常速度)

**Example:**

```typescript
modelLayer.setAnimationSpeed(2.0); // 2倍速
```

### setAnimationLoop(loop: boolean)

**Description:** アニメーションのループ設定を変更します。

**Parameters:**

- `loop`: ループ再生の有効/無効

**Example:**

```typescript
modelLayer.setAnimationLoop(false);
```

### setAnimationWeight(name: string, weight: number)

**Description:** 特定のアニメーションのウェイトを設定します。

**Parameters:**

- `name`: アニメーションクリップ名
- `weight`: ウェイト(0.0-1.0)

**Example:**

```typescript
modelLayer.setAnimationWeight("Walk", 0.5);
```

## イベント

### load

**Description:** モデルの読み込みが完了したときに発火します。

**Example:**

```typescript
modelLayer.on("load", () => {
  console.log("Model loaded!");
});
```

### animationReady

**Description:** アニメーションの初期化が完了したときに発火します。

**Example:**

```typescript
modelLayer.on("animationReady", () => {
  console.log("Animations ready!");
  const clips = modelLayer.getAnimationAvailable();
  console.log("Available clips:", clips);
});
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { GLTFModelDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// GLTFModelDescを追加
const modelLayer = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/character.glb",
    castShadow: true,
    receiveShadow: true,
  },
  position: { x: 0, y: 0, z: 0 },
});
```

### アニメーション付きモデル

```typescript
const animatedModel = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/animated.glb",
    castShadow: true,
    receiveShadow: true,
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
  },
});

// モデル読み込み後にアニメーションを切り替え
animatedModel.ref.on("animationReady", () => {
  setTimeout(() => {
    animatedModel.ref.crossFadeAnimation("Idle", "Walk", 0.5);
  }, 2000);
});
```

### 複数アニメーションのブレンド

```typescript
const blendedModel = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "https://example.com/models/character.glb",
    animationEnabled: true,
  },
});

blendedModel.ref.on("animationReady", () => {
  // 歩きと走りをブレンド
  blendedModel.ref.blendAnimations([
    { name: "Walk", weight: 0.6 },
    { name: "Run", weight: 0.4 },
  ]);
});
```

### 動的なモデル更新

```typescript
// URLを変更してモデルを再読み込み
modelLayer.update({
  gltfModel: {
    url: "https://example.com/models/new-model.glb",
  },
});

// アニメーション速度を変更
modelLayer.update({
  gltfModel: {
    animationSpeed: 2.0,
  },
});
```