---
title: SplatMeshDesc
description: navara_three 向けの 3D Gaussian Splat Mesh Descriptor
sidebar:
  order: 116
---

`SplatMeshDesc` クラスは、3D Gaussian Splat アセット（`.spz`、`.ply`、`.sog`、`.rad`、`.splat`、`.ksplat`）を描画する Mesh Descriptor です。

`DefaultPlugin` により `"splat"` mesh キーで登録されているため、`view.addMesh({ splat: { ... } })` 呼び出しはこの Descriptor にルーティングされます。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Properties

### url

**Type:** `string`

**Description:** 読み込む splat ファイルの URL。必須パラメータです。ライセンスが確認された外部ホストの URL を指定するか、プロジェクトの `public/splat/` 配下にアセットを置いて `/splat/your-asset.ply` のように参照してください。

取得失敗時は `console.warn` が出力されます。例外やイベントは発生しないため、必要に応じてアプリ側でリトライや fallback を実装してください。

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
  }
}
```

### lod

**Type:** `boolean`

**Default:** `false`

**Description:** Level-of-Detail 描画を有効化し、現在のカメラ距離で必要な splat のみを描画します。任意の 3DGS アセットに対して runtime で動作しますが、アセット作成時に LoD ツリーをプリビルドしておくと初回ロードが速くなり、runtime でのツリー構築を回避できます。

**Example:**

```typescript
{
  splat: {
    url: "/splat/your-asset.ply",
    lod: true,
  }
}
```

> `url` と `lod` は構築時に固定されます。`handle.update()` で異なる値を渡すと警告が出るので、Descriptor を作り直してください。

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { geodeticToVector3, degreeToRadian } from "@navara/three";
import type { SplatMeshDesc } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";

const view = new ThreeView<DefaultDescriptions>();
view.addPlugin(new DefaultPlugin()); // "splat" → SplatMeshDesc を登録
await view.init();

const pos = geodeticToVector3({
  lat: degreeToRadian(35.7100),
  lng: degreeToRadian(139.8107),
  height: 10,
});

const splat = view.addMesh<SplatMeshDesc>({
  splat: {
    url: "/splat/your-asset.ply",
  },
  position: { x: pos.x, y: pos.y, z: pos.z },
  scale: { x: 30, y: 30, z: 30 },
});
```

### Y-down アセットの補正

splat アセットが **Y-down（画像空間）** で訓練されている場合、Y-up のワールドに配置すると逆さまになります。その場合は X 軸まわりに 180° 回転すると補正できます:

```typescript
view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: Math.PI, y: 0, z: 0 },
});
```

## 対応仕様

Navara は以下の Gaussian Splatting フォーマットに対応しています。

### ファイルフォーマット

| ファイルフォーマット | 説明 |
| ------------------ | ---- |
| `.spz` | Niantic SPZ 形式 |
| `.ply` | Gaussian Splatting データ |
| `.sog` | PlayCanvas Scene Optimized Gaussians |
| `.rad` | プリビルドされた LoD アセット（`build-lod` の出力） |
| `.splat` | antimatter15 splat 形式 |
| `.ksplat` | mkkellogg GaussianSplats3D 形式 |

:::note
- spz v4 (NGSP) は現状未対応です。Niantic 公式 web converter が出力する v4 は読み込めません。[`nianticlabs/spz`](https://github.com/nianticlabs/spz) をローカルビルドし `PackOptions.version = 3` で出力すると互換になります。
:::

## 既知の制約

- **シーンライティング非対応**: splat は照明をデータ内に焼き込んでおり、`SunLight` / `AmbientLight` などの影響を受けません。
- **shadow / selective effect / picking 非対応**: splat は transparent パスで描画され、shadow、`SelectiveBloomEffect` / `SelectiveOutlineEffect`、Navara の picking パイプラインのいずれの対象にもなりません。
