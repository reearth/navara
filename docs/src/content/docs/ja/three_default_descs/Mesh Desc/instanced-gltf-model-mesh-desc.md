---
title: InstancedGltfModelMeshDesc
description: navara_three 向け GPU インスタンス GLTF モデルメッシュ
sidebar:
  order: 107
---

`InstancedGltfModelMeshDesc` クラスは、単一の GLTF/GLB モデルを読み込み、その複数の変換済みコピー（インスタンス）をレンダリングするメッシュです。GLTF を一度だけ読み込み、各 `Mesh` ノードを兄弟の `InstancedMesh` に展開して、モデルインスタンスごとに 1 つのインスタンス行列スロットを共有します。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

GLTF の内容に基づき、2 つの内部レンダリングパスのいずれかが自動的に選択されます:

- **非スキンドパス（インスタンス化）:** 各 `Mesh` ノードが `InstancedMesh` になります。すべてのインスタンスはソースシーン上で動作する 1 つの `AnimationMixer` を共有し、毎フレーム各ソースメッシュの `matrixWorld` を再サンプリングして、各インスタンスの行列を `T_i * sourceLocal_s` として書き換えます。Node-TRS およびモーフターゲットアニメーションはどちらも正しく再生されます。
- **スキンドパス（インスタンスごとのクローンフォールバック）:** three.js の `InstancedMesh` はスキニングを適用できないため、スキンド GLTF はインスタンスごとに `SkeletonUtils.clone` でフォールバックされ、それぞれが独自の `AnimationMixer` を持ちます。スキン部分のインスタンス化レンダリングは犠牲になりますが、同じ desc API を維持し、クローン間で共有クリップを同期して再生します。

メッシュは Relative-To-Eye (RTE) 精度を使用するため、浮動小数点精度の問題なく地球上のどこにでもアンカリングできます。

:::warning
ピッキングは非スキンドパスでのみサポートされます。スキンドパスでは `batchIds` は空になります。
:::

## 共有プロパティ (InstancedModelsDescription)

`models` 設定オブジェクト内で指定します。

### url

**Type:** `string`

**Description:** 読み込む GLTF/GLB モデルの URL。

**Example:**

```typescript
{
  models: {
    url: "/models/tree.glb",
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** インスタンスが影を落とすかどうかを指定します。

**Default:** `false`

### receiveShadow

**Type:** `boolean`

**Description:** インスタンスが影を受けるかどうかを指定します。

**Default:** `false`

### animationActiveClip

**Type:** `string` (optional)

**Description:** 再生するアニメーションクリップ名を指定します。クリップはすべてのインスタンス間で共有されます。利用可能なクリップ一覧はモデル読み込み後に `handle.ref.animationClips` から取得できます。

### animationSpeed

**Type:** `number`

**Description:** アニメーション再生速度の倍率。すべてのインスタンス間で共有されます。

**Default:** `1`

### animationLoop

**Type:** `boolean`

**Description:** アクティブなアニメーションクリップをループ再生するかどうかを指定します。

**Default:** `true`

### animationAutoPlay

**Type:** `boolean`

**Description:** 読み込み完了時に設定済みのクリップを自動再生するかどうかを指定します。

**Default:** `false`

## インスタンスごとのプロパティ (ModelChildConfig)

各モデルインスタンスのプロパティを `children` 配列内で指定します。変換はそのインスタンスのすべてのサブメッシュに適用されます。

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** 親グループに対するローカル位置を指定します。

**Default:** `{ x: 0, y: 0, z: 0 }`

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカル回転（オイラー角、ラジアン）を指定します。

**Default:** `undefined`

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカルスケールを指定します。

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** 事前計算された変換行列を指定します。設定時は `position`、`rotation`、`scale` は無視されます。

**Default:** `undefined`

## Config

### pickable

**Type:** `boolean` (optional)

**Description:** 個々のインスタンスのピッキングを有効にします。非スキンドパスでのみ有効です。

**Default:** `false`

## イベント

`handle.on(event, handler)` で購読します。

### load

**Description:** GLTF の読み込みが完了し、インスタンスが初期化されたときに発火します。

**Handler Type:**

```typescript
() => void
```

### needsUpdate

**Description:** descriptor のインスタンス状態が変化（追加・削除・更新・置換・クリア）したときに発火します。

**Handler Type:**

```typescript
() => void
```

## インスタンス管理

### handle.ref.add(config)

新しいインスタンスを追加し、そのインデックスを返します。非スキンドパスでは容量は自動的に拡張されます。

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  scale: { x: 2, y: 2, z: 2 },
});
```

### handle.ref.removeAt(index)

指定インデックスのインスタンスを削除します。swap-with-last による O(1) 削除のため、順序は保持されません。

### handle.ref.updateAt(index, config)

指定インデックスのインスタンスを部分更新します。未指定のフィールドは保持されます。

```typescript
handle.ref.updateAt(0, {
  position: { x: 50, y: 0, z: 0 },
});
```

### handle.ref.clear()

すべてのインスタンスを削除します。

### handle.ref.replaceAll(configs)

全インスタンスをバッチ置換します。`clear()` と複数回の `add()` よりも効率的です。

### handle.ref.count

アクティブなインスタンス数を取得します。

### handle.ref.animationClips

読み込まれた GLTF に含まれるアニメーションクリップ名の読み取り専用リスト。`load` イベント発火までは空です。

```typescript
handle.on("load", () => {
  console.log("Available clips:", handle.ref.animationClips);
});
```

### handle.ref.playAnimation(name)

指定名のアニメーションクリップをすべてのインスタンスで再生します。非スキンドパスでは全インスタンスが単一のミキサーから同期再生され、スキンドパスでは各クローンが同じクリップの独自コピーを再生します。

```typescript
handle.ref.playAnimation("Fly");
```

### handle.ref.stopAnimation()

すべてのインスタンスで現在再生中のアニメーションを停止します。

## 使用例

### 基本的な使い方

```typescript
import ThreeView from "@navara/three";
import { InstancedGltfModelMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("models", InstancedGltfModelMeshDesc);
await view.init();

const handle = view.addMesh<InstancedGltfModelMeshDesc>({
  models: {
    url: "/models/tree.glb",
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 50, y: 0, z: 0 }, scale: { x: 1.5, y: 1.5, z: 1.5 } },
      { position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 4, z: 0 } },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```

### アニメーション付きスキンドモデル

```typescript
const handle = view.addMesh<InstancedGltfModelMeshDesc>({
  models: {
    url: "/glTF/animated_bird_pigeon/scene.gltf",
    animationActiveClip: "Fly",
    animationSpeed: 1.5,
    animationLoop: true,
    animationAutoPlay: true,
    children: [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 20, y: 0, z: 0 } },
      { position: { x: 40, y: 0, z: 0 } },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});

handle.on("load", () => {
  console.log("Clips:", handle.ref.animationClips);
});
```

### アニメーションの動的制御

```typescript
// 実行時にクリップを切り替え
handle.ref.playAnimation("Walk");

// すべてのアニメーションを停止
handle.ref.stopAnimation();

// アニメーション再生中に新規インスタンスを追加
handle.ref.add({ position: { x: 60, y: 0, z: 0 } });
```
