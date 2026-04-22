---
title: Mesh Descriptor
description: Mesh descriptor types for navara_three
sidebar:
  order: 100
---

`MeshDesc`は、3Dメッシュオブジェクトをシーンに追加するためのDescriptorタイプです。様々な3Dオブジェクトを表示できます。

すべてのメッシュは [`MeshDesc`](./mesh-layer-base) を継承しており、`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable` などの共通プロパティを提供します。トランスフォーム合成、ピッキング、座標変換の詳細については [MeshDesc](./mesh-layer-base) ページを参照してください。

## 利用可能なMeshDescタイプ

navara_threeでは、以下のMeshDescタイプが利用可能です:

| Descriptorタイプ                                     | 説明                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [ArclineMeshDesc](./arcline-mesh-layer)            | 2点間を結ぶアーク状のラインを描画するDescriptor                                           |
| [BoxMeshDesc](./box-mesh-layer)                    | 立方体(Box)ジオメトリを描画するDescriptor                                                 |
| [InstancedBoxMeshDesc](./instanced-box-mesh-layer) | GPU インスタンシングを使用して複数のボックスを1回の描画コールでレンダリングするDescriptor |
| [CylinderMeshDesc](./cylinder-mesh-layer)          | 円柱(Cylinder)ジオメトリを描画するDescriptor                                              |
| [GLTFModelDesc](./gltf-model-layer)                | GLTF/GLB形式の3Dモデルを読み込み・表示するDescriptor                                      |
| [GlowGlobeMeshDesc](./glow-globe-mesh-layer)       | 地球の周りにフレネル効果による光彩(グロー)を表示するDescriptor                            |
| [PlaneMeshDesc](./plane-mesh-layer)                | 平面(Plane)ジオメトリを描画するDescriptor                                                 |
| [RainMeshDesc](./rain-mesh-layer)                  | 雨のパーティクルエフェクトを表示するDescriptor                                            |
| [SkyBoxMeshDesc](./sky-box-mesh-layer)             | シンプルなスカイボックスを描画するDescriptor                                              |
| [SkyMeshDesc](./sky-mesh-layer)                    | 大気散乱による空と太陽・月を描画するDescriptor                                            |
| [SmoothLineMeshDesc](./smooth-line-mesh-layer)     | カトマル・ロム曲線による滑らかなラインを描画するDescriptor                                |
| [SnowMeshDesc](./snow-mesh-layer)                  | 雪のパーティクルエフェクトを表示するDescriptor                                            |
| [SphereMeshDesc](./sphere-mesh-layer)              | 球体(Sphere)ジオメトリを描画するDescriptor                                                |
| [StarsDesc](./stars-layer)                         | 星空を描画するDescriptor                                                                  |
| [TubeMeshDesc](./tube-mesh-layer)                  | チューブ(Tube)ジオメトリを描画するDescriptor                                              |
| [AxesHelperDesc](./axes-helper-layer)              | 3軸を可視化するデバッグ用ヘルパーDescriptor                                               |
| [ArrowHelperDesc](./arrow-helper-layer)            | ベクトル方向を可視化するデバッグ用ヘルパーDescriptor                                      |

## 基本的な使い方

MeshDescは、Descriptorクラスを登録した後、`view.addMesh()`メソッドで追加します:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshDesc } from "@navara/three_default_layers";

const view = new ThreeView();

// Descriptorクラスを登録
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

詳細な使用方法は、各Descriptorタイプのドキュメントを参照してください。
