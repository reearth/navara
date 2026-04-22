---
title: Mesh Descriptor
description: Mesh descriptor types for navara_three
sidebar:
  order: 100
---

`MeshDesc`は、3Dメッシュオブジェクトをシーンに追加するためのレイヤータイプです。様々な3Dオブジェクトを表示できます。

すべてのメッシュレイヤーは [`MeshDesc`](./mesh-layer-base) を継承しており、`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable` などの共通プロパティを提供します。トランスフォーム合成、ピッキング、座標変換の詳細については [MeshDesc](./mesh-layer-base) ページを参照してください。

## 利用可能なMeshDescタイプ

navara_threeでは、以下のMeshDescタイプが利用可能です:

| レイヤータイプ | 説明 |
|------------|------|
| [ArclineMeshDesc](./arcline-mesh-layer) | 2点間を結ぶアーク状のラインを描画するレイヤー |
| [BoxMeshDesc](./box-mesh-layer) | 立方体(Box)ジオメトリを描画するレイヤー |
| [InstancedBoxMeshDesc](./instanced-box-mesh-layer) | GPU インスタンシングを使用して複数のボックスを1回の描画コールでレンダリングするレイヤー |
| [CylinderMeshDesc](./cylinder-mesh-layer) | 円柱(Cylinder)ジオメトリを描画するレイヤー |
| [GLTFModelDesc](./gltf-model-layer) | GLTF/GLB形式の3Dモデルを読み込み・表示するレイヤー |
| [GlowGlobeMeshDesc](./glow-globe-mesh-layer) | 地球の周りにフレネル効果による光彩(グロー)を表示するレイヤー |
| [PlaneMeshDesc](./plane-mesh-layer) | 平面(Plane)ジオメトリを描画するレイヤー |
| [RainMeshDesc](./rain-mesh-layer) | 雨のパーティクルエフェクトを表示するレイヤー |
| [SkyBoxMeshDesc](./sky-box-mesh-layer) | シンプルなスカイボックスを描画するレイヤー |
| [SkyMeshDesc](./sky-mesh-layer) | 大気散乱による空と太陽・月を描画するレイヤー |
| [SmoothLineMeshDesc](./smooth-line-mesh-layer) | カトマル・ロム曲線による滑らかなラインを描画するレイヤー |
| [SnowMeshDesc](./snow-mesh-layer) | 雪のパーティクルエフェクトを表示するレイヤー |
| [SphereMeshDesc](./sphere-mesh-layer) | 球体(Sphere)ジオメトリを描画するレイヤー |
| [StarsDesc](./stars-layer) | 星空を描画するレイヤー |
| [TubeMeshDesc](./tube-mesh-layer) | チューブ(Tube)ジオメトリを描画するレイヤー |
| [AxesHelperDesc](./axes-helper-layer) | 3軸を可視化するデバッグ用ヘルパーレイヤー |
| [ArrowHelperDesc](./arrow-helper-layer) | ベクトル方向を可視化するデバッグ用ヘルパーレイヤー |

## 基本的な使い方

MeshDescは、レイヤークラスを登録した後、`view.addMesh()`メソッドで追加します:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_layers";

const view = new ThreeView();

// レイヤークラスを登録
view.registerMesh("box", BoxMeshDesc);

await view.init();

// BoxMeshDescを追加
const boxLayer = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

詳細な使用方法は、各レイヤータイプのドキュメントを参照してください。
