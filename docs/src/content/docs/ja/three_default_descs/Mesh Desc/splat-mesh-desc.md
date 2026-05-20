---
title: SplatMeshDesc
description: navara_three 向けの 3D Gaussian Splat Mesh Descriptor（SparkJS 利用）
sidebar:
  order: 116
---

`SplatMeshDesc` クラスは、3D Gaussian Splat アセット（`.spz`、`.ply`、`.splat`、`.ksplat`、`.pcsogs`）を [SparkJS](https://sparkjs.dev/) 経由で描画する Mesh Descriptor です。

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

**Description:** [SparkJS の Level-of-Detail](https://sparkjs.dev/docs/lod-getting-started/) を有効化します。LoD ツリーがプリビルドされたアセット（例: `spark-cli ... --quality`）が必要で、未対応の raw PLY だと描画が崩れることがあります。詳細は制約を参照。

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

一般に配布されている splat アセットの多くは **Y-down（画像空間）** で訓練されており、Y-up のワールドに配置すると逆さまになります。X 軸まわりに 180° 回転して補正します:

```typescript
view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: Math.PI, y: 0, z: 0 },
});
```

## 既知の制約

### 3DGS の仕様

- **シーンライティング非対応**: splat は照明をデータ内に焼き込んでおり、`SunLight` / `AmbientLight` などの影響を受けません。
- **shadow / selective effect / picking 非対応**: splat は transparent パスで描画され、shadow、`SelectiveBloomEffect` / `SelectiveOutlineEffect`、Navara の picking パイプラインのいずれの対象にもなりません。

### SparkJS 既知の仕様

- **`lod: true` 時のちらつき**: 地球規模に splat を配置すると、カメラ固定でも小さな描画ずれが見えることがあります。安定描画には `lod: false`（既定）を推奨。アセット側で LoD ツリーをプリビルドすると緩和されます。
- **同時に 1 view のみ**: SparkJS がプロセス全域の static を使うため、同一ページで複数の `ThreeView` で splat を同時描画することはサポートされません。
- **spz v4 (NGSP) は現状未対応**: spz v3 以下を使用してください。Niantic 公式 web converter が出力する v4 は読み込めません。[`nianticlabs/spz`](https://github.com/nianticlabs/spz) をローカルビルドし `PackOptions.version = 3` で出力すると互換になります。
- **`three` の peer-range ずれ**: SparkJS パッケージが要求する `three` のバージョン範囲が本ワークスペースより古いため、install 時に `unmet peer` 警告が出ます。実行時には影響しません。
