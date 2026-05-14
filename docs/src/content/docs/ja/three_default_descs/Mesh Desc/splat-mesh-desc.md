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

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { geodeticToVector3, degreeToRadian } from "@navara/three";
import type { SplatMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
await view.init();

const pos = geodeticToVector3({
  lat: degreeToRadian(35.7100),
  lng: degreeToRadian(139.8107),
  height: 10,
});

const splat = view.addMesh<SplatMeshDesc>({
  splat: {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    lod: true,
  },
  position: { x: pos.x, y: pos.y, z: pos.z },
  scale: { x: 30, y: 30, z: 30 },
});
```

### Y-down アセットの補正

一般に配布されている splat アセットの多くは **Y-down（画像空間）** で訓練されており、Y-up のワールドに配置すると逆さまになります。X 軸まわりに 180° 回転して補正します:

```typescript
import { Vector3, Quaternion, Euler } from "three";

const flip = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
const euler = new Euler().setFromQuaternion(flip);

view.addMesh<SplatMeshDesc>({
  splat: { url: "..." },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});
```

flip と地表法線への整列をまとめたヘルパーは [splat サンプル](https://github.com/eukarya-inc/navara/tree/main/web/navara_three/example/pages/splat) を参照してください。

## 技術的詳細

`SplatMeshDesc` は [SparkJS](https://sparkjs.dev/) のアダプタとして、以下の機能を提供します:

- **共有 `SparkRenderer`**: transparent シーンごとに 1 つだけ遅延生成され、参照カウントで管理されます。最後に解放した Descriptor が renderer を dispose します。Renderer は transparent シーンに置かれているため、splat は atmosphere / aerial-perspective ポストエフェクトの後に描画され、ベイクされた色とエッジのシャープさが維持されます。
- **`sparkOverride`**: SparkJS のプロセス全域の static（新規 `SplatMesh` が renderer を見つけるために参照）は、最後の解放時に `undefined` にクリアされ、次に active になった view の Descriptor 構築時に再アサートされます。これにより複数 view を LIFO 順に使う場合でも干渉しません。
- **`enableLod`**: 最初に acquire した Descriptor の値で固定されます。最初の Descriptor が `lod: false` で作られた場合、その後 `lod: true` を要求する Descriptor は silent に `lod: false` へ降格されます（LoD を駆動しない renderer の下で per-mesh LoD ツリーを構築してもメモリの無駄になるため）。逆方向（LoD 対応 renderer 上での `lod: false`）は降格されず動作します。
- **`ConcurrencyManager` スロット**: 各 Descriptor は splat の async ロード処理中だけ 1 スロットを予約します。`mesh.initialized` が settle した時点（成功/失敗いずれでも）で解放され、`onDestroy()` は settle 前に破棄された場合のフォールバックとしてのみ動作します。

## 制約

- **globe-scale での周期的な visual snap**: SparkJS の 2 つの非同期 worker（sort と LoD）は `autoUpdate: true`（インタラクティブ描画に必須の既定値）の間、状態更新を継続的に push し、固定 camera でも 0.5〜2 秒間隔で 10〜60% の pixel 差を伴う snap が発生します。SparkJS の [System Design](https://sparkjs.dev/docs/system-design/) は「sort order は描画より最低 1 フレーム、古いデバイスではそれ以上遅延する」が「通常は知覚されない」と認めていますが、globe-scale 描画ではこれが知覚可能になります。以下の `SparkRenderer` フラグを実測しましたが、snap 頻度の有意な改善は **観測されませんでした**: `minSortIntervalMs: 500/1000`、`enableLodFetching: false`、`lodSplatScale: 0.25/0.5`（[公式 LoD docs](https://sparkjs.dev/docs/lod-getting-started/) は描画品質と引き換えに後者を下げることを推奨）。アセット作成時に `spark-cli ... --quality` フラグで LoD ツリーをプリビルドすると改善する可能性があります。snap は SparkJS 2.0 の新しい LoD アーキテクチャに本質的な挙動と見られます。
- **シーンライティング非対応**: Gaussian Splat は照明をデータ内にエンコードしており、`SunLight`、`AmbientLight` などの影響を受けません。
- **shadow / selective effect 非対応**: splat は transparent パスで描画され、`SelectiveBloomEffect` や `SelectiveOutlineEffect` が使用する MRT effect-ids / 法線バッファに書き込みません。
- **picking 非対応**: SparkJS 側に `SplatMesh.raycastable` はありますが、Navara の picking パイプラインには統合されていません。
- **同時に 1 view のみ**: SparkJS は `sparkOverride` をプロセス全域の static として公開しているため、同一ページ上で複数の `ThreeView` を同時にレンダリングすることはサポートされません。
