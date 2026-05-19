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

地球上に配置する場合は、`northUpEastToFixedFrame(pos)` を `matrixWorld` として渡し、ローカル up 軸を地表法線に揃えると組み合わせやすくなります。動作する一式の例は [splat サンプル](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) を参照してください。

## 技術的詳細

`SplatMeshDesc` は [SparkJS](https://sparkjs.dev/) のアダプタとして、以下の機能を提供します:

- **共有 `SparkRenderer`**: transparent シーンごとに 1 つだけ遅延生成され、参照カウントで管理されます。最後に解放した Descriptor が renderer を dispose します。Renderer は transparent シーンに置かれているため、splat は atmosphere / aerial-perspective ポストエフェクトの後に描画され、ベイクされた色とエッジのシャープさが維持されます。
- **`sparkOverride`**: SparkJS のプロセス全域の static（新規 `SplatMesh` が renderer を見つけるために参照）は、最後の解放時に `undefined` にクリアされ、次に active になった view の Descriptor 構築時に再アサートされます。これにより複数 view を LIFO 順に使う場合でも干渉しません。
- **`enableLod`**: 最初に acquire した Descriptor の値で固定されます。最初の Descriptor が `lod: false` で作られた場合、その後 `lod: true` を要求する Descriptor は `lod: false` へ降格され（`console.warn` を出力します）、LoD を駆動しない renderer の下で per-mesh LoD ツリーを構築してメモリを無駄にすることを避けます。逆方向（LoD 対応 renderer 上での `lod: false`）は降格されず動作します。
- **`ConcurrencyManager` スロット**: 各 Descriptor は splat の async ロード処理中だけ 1 スロットを予約します。`mesh.initialized` が settle した時点（成功/失敗いずれでも）で解放され、`onDestroy()` は settle 前に破棄された場合のフォールバックとしてのみ動作します。予約は **best-effort** で、pool が飽和している場合は `canIncrement()` が false を返すため slot を取らずに load を進めます（`decrement` の対称性を維持するため）。load は block / queue されません。

## 制約

- **`lod: true` 時の周期的な visual snap**: SparkJS の非同期 sort/LoD worker が globe-scale で固定 camera でも snap を発生させます。SparkJS 2.0 の LoD アーキテクチャに本質的な挙動です。アセット作成時に LoD ツリーをプリビルドすると緩和されます。`SparkRenderer` のフラグ調整（`minSortIntervalMs`、`enableLodFetching`、`lodSplatScale`）では有意な改善は観測されませんでした。
- **シーンライティング非対応**: Gaussian Splat は照明をデータ内にエンコードしており、`SunLight`、`AmbientLight` などの影響を受けません。
- **shadow / selective effect 非対応**: splat は transparent パスで描画され、`SelectiveBloomEffect` や `SelectiveOutlineEffect` が使用する MRT effect-ids / 法線バッファに書き込みません。
- **picking 非対応**: SparkJS 側に `SplatMesh.raycastable` はありますが、Navara の picking パイプラインには統合されていません。
- **同時に 1 view のみ**: SparkJS は `sparkOverride` をプロセス全域の static として公開しているため、同一ページ上で複数の `ThreeView` を同時にレンダリングすることはサポートされません。
- **SparkJS の peer dependency**: `@sparkjsdev/spark@2.0.0` は `three: ^0.180.0` を peer dependency として宣言していますが、本ワークスペースは `three@0.184.0` を使用しています。pnpm は初回 install で unmet-peer 警告を出しますが、install 自体は成功し、ランタイム上の不整合は確認されていません。upstream で peer range が拡張されることが期待されます。
