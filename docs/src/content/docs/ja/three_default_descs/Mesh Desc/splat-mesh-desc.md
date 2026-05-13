---
title: SplatMeshDesc
description: navara_three 向けの 3D Gaussian Splat Mesh Descriptor（SparkJS 利用）
sidebar:
  order: 116
---

`SplatMeshDesc` クラスは、3D Gaussian Splat アセット（`.spz`、`.ply`、`.splat`、`.ksplat`、`.pcsogs`）を [SparkJS](https://sparkjs.dev/) 経由で描画する Mesh Descriptor です。`DefaultPlugin` により `"splat"` mesh キーで登録されているため、`view.addMesh({ splat: { ... } })` 呼び出しはこの Descriptor にルーティングされます。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Properties

### url

**Type:** `string`

**Description:** 読み込む splat ファイルの URL。必須パラメータです。

**Example:**

```typescript
{
  splat: {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
  }
}
```

### lod

**Type:** `boolean`

**Default:** `false`

**Description:** [SparkJS の Level-of-Detail](https://sparkjs.dev/docs/lod-getting-started/) を有効化します。`true` のとき in-memory LoD ツリーが構築され、フレームごとに splat が選択されます。

**Example:**

```typescript
{
  splat: {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    lod: true,
  }
}
```

> `url` と `lod` は構築時に固定されます。`handle.update()` で異なる値を渡すと警告が出るので、Descriptor を作り直してください。

## Notes

### 座標系の慣習

一般に配布されている splat アセットの多くは **Y-down（画像空間）** で訓練されています。Y-up のワールドに配置すると逆さまになるため、X 軸まわりに 180° 回転（SparkJS のドキュメントでは `quaternion.set(1, 0, 0, 0)`）して補正します。flip と地表法線への整列をまとめたヘルパーは [`splat` example](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) を参照してください。

### Renderer の共有

`SplatMeshDesc` は transparent シーンごとに 1 つの `SparkRenderer` を遅延生成し、全ての splat Descriptor 間で参照カウントによって共有します。Renderer は transparent シーンに置かれているため、splat は atmosphere / aerial-perspective ポストエフェクトの **後** に描画され、ベイクされた色とエッジのシャープさが維持されます。`SparkRenderer.sparkOverride`（新規 `SplatMesh` が renderer を見つけるために参照するプロセス全域の static）は最後の release 時に `undefined` にクリアされ、次に active になった view の `SplatMeshDesc` 構築時に再アサートされます。

Renderer の `enableLod` は、**最初に** acquire した `SplatMeshDesc` の値で固定されます。それ以降に異なる `lod` 値で構築される Descriptor では警告が出力され、共有 renderer が再利用されます（`new SplatMesh()` に渡す per-mesh `lod` 自体は適用されますが、renderer 全体の LoD 駆動能力は共有されます）。

### ConcurrencyManager

`SplatMeshDesc` インスタンスは `createMesh()` 時に `ViewContext.concurrencyManager` のスロットを 1 つ予約し（`canIncrement()` でガード）、`onDestroy()` 時に解放します。これにより splat / tile / model のロードが SparkJS のワーカープールをオーバーサブスクライブしないよう制御されます。

> 多数の splat を追加すると pool 容量を使い切り、他のワークロードが直列化される可能性があります。大きな tile ロードと splat を併用する場合はロード順序を考慮してください。

### 制約

- **シーンライティング非対応**: Gaussian Splat は照明をデータ内にエンコードしており、`SunLight`、`AmbientLight` などの影響を受けません。
- **shadow / selective effect 非対応**: splat は transparent パスで描画され、`SelectiveBloomEffect` や `SelectiveOutlineEffect` が使用する MRT effect-ids / 法線バッファに書き込みません。
- **picking 非対応**: SparkJS 側に `SplatMesh.raycastable` はありますが、Navara の picking パイプラインには統合されていません。
- **同時に 1 view のみ**: SparkJS は `sparkOverride` をプロセス全域の static として公開しているため、同一ページ上で複数の `ThreeView` を同時にレンダリングすることはサポートされません。

## 関連リソース

- [SparkJS ドキュメント](https://sparkjs.dev/) — アップストリームのレンダラー
- [SparkJS LoD ガイド](https://sparkjs.dev/docs/lod-getting-started/) — Level-of-Detail の概念
- [MeshDesc](./mesh-desc-base) — 基底クラスのプロパティ
