---
title: Mesh Layer
description: Mesh layer types for navara_three
sidebar:
  order: 100
---

`MeshLayer`は、3Dメッシュオブジェクトをシーンに追加するためのレイヤータイプです。様々な3Dオブジェクトを表示できます。

すべてのメッシュレイヤーは [`MeshLayerDeclaration`](./mesh-layer-base) を継承しており、`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable` などの共通プロパティを提供します。トランスフォーム合成、ピッキング、座標変換の詳細については [MeshLayerDeclaration](./mesh-layer-base) ページを参照してください。

## 利用可能なMeshLayerタイプ

navara_threeでは、以下のMeshLayerタイプが利用可能です:

| レイヤータイプ | 説明 |
|------------|------|
| [ArclineMeshLayer](./arcline-mesh-layer) | 2点間を結ぶアーク状のラインを描画するレイヤー |
| [BoxMeshLayer](./box-mesh-layer) | 立方体(Box)ジオメトリを描画するレイヤー |
| [InstancedBoxMeshLayer](./instanced-box-mesh-layer) | GPU インスタンシングを使用して複数のボックスを1回の描画コールでレンダリングするレイヤー |
| [CylinderMeshLayer](./cylinder-mesh-layer) | 円柱(Cylinder)ジオメトリを描画するレイヤー |
| [GLTFModelLayer](./gltf-model-layer) | GLTF/GLB形式の3Dモデルを読み込み・表示するレイヤー |
| [GlowGlobeMeshLayer](./glow-globe-mesh-layer) | 地球の周りにフレネル効果による光彩(グロー)を表示するレイヤー |
| [PlaneMeshLayer](./plane-mesh-layer) | 平面(Plane)ジオメトリを描画するレイヤー |
| [RainMeshLayer](./rain-mesh-layer) | 雨のパーティクルエフェクトを表示するレイヤー |
| [SkyBoxMeshLayer](./sky-box-mesh-layer) | シンプルなスカイボックスを描画するレイヤー |
| [SkyMeshLayer](./sky-mesh-layer) | 大気散乱による空と太陽・月を描画するレイヤー |
| [SmoothLineMeshLayer](./smooth-line-mesh-layer) | カトマル・ロム曲線による滑らかなラインを描画するレイヤー |
| [SnowMeshLayer](./snow-mesh-layer) | 雪のパーティクルエフェクトを表示するレイヤー |
| [SphereMeshLayer](./sphere-mesh-layer) | 球体(Sphere)ジオメトリを描画するレイヤー |
| [StarsLayer](./stars-layer) | 星空を描画するレイヤー |
| [TubeMeshLayer](./tube-mesh-layer) | チューブ(Tube)ジオメトリを描画するレイヤー |
| [AxesHelperLayer](./axes-helper-layer) | 3軸を可視化するデバッグ用ヘルパーレイヤー |
| [ArrowHelperLayer](./arrow-helper-layer) | ベクトル方向を可視化するデバッグ用ヘルパーレイヤー |

## 基本的な使い方

MeshLayerは、レイヤークラスを登録した後、`view.addMesh()`メソッドで追加します:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// レイヤークラスを登録
view.registerMesh("box", BoxMeshLayer);

await view.init();

// BoxMeshLayerを追加
const boxLayer = view.addMesh<BoxMeshLayer>({
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
