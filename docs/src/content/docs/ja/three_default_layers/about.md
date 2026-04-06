---
title: About
description: three_default_layers の概要と特徴について説明します。
sidebar:
  order: 1
---

## What is three_default_layers?

`three_default_layers` は、`navara_three` が提供するレイヤーシステム向けのデフォルトレイヤー実装パッケージです。3D メッシュ、ポストプロセッシングエフェクト、照明など、よく使われるレイヤーをすぐに利用できる形で提供します。

## navara_three との関係

`navara_three` はレイヤーの追加・管理を行うコアライブラリですが、個々のレイヤーの実装は含まれていません。`three_default_layers` がメッシュレイヤー、エフェクトレイヤー、ライトレイヤーの具体的な実装を提供します。

```
navara_three（コア）
  └── three_default_layers（デフォルトレイヤー実装）
        ├── Mesh Layer（3D メッシュ）
        ├── Effect Layer（ポストプロセッシング）
        └── Light Layer（照明）
```

## 使い方

`three_default_layers` のレイヤーを使用するには、`view.addLayer()` の前に `view.registerMesh()` / `view.registerEffect()` / `view.registerLight()` でレイヤークラスを登録する必要があります。

```typescript
import ThreeView from "@navara/three";
import { BoxMeshLayer, FXAAEffectLayer, SunLightLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// レイヤークラスを登録
view.registerMesh("box", BoxMeshLayer);
view.registerEffect("fxaa", FXAAEffectLayer);
view.registerLight("sun", SunLightLayer);

await view.init({ canvas: document.getElementById("canvas") });

// 登録後に addLayer で使用可能
view.addLayer({ type: "mesh", box: { width: 100, height: 100, depth: 100 } });
view.addLayer({ type: "effect", fxaa: {} });
view.addLayer({ type: "light", sun: { intensity: 1.0 } });
```

:::tip
すべてのデフォルトレイヤーを一括で登録したい場合は、[three_default_plugin](../../../three_default_plugin/about/) の `DefaultPlugin` を使用すると便利です。
:::

## 提供されるレイヤーの種類

### メッシュレイヤー

3D メッシュオブジェクトをシーンに追加するレイヤーです。ボックス、球体、円柱などの基本形状や、glTF モデルの読み込みに対応しています。

```typescript
import { BoxMeshLayer, GLTFModelLayer } from "@navara/three_default_layers";

view.registerMesh("box", BoxMeshLayer);
view.registerMesh("gltfModel", GLTFModelLayer);

// 登録後に使用
view.addLayer({ type: "mesh", box: { width: 100, height: 100, depth: 100 } });
view.addLayer({ type: "mesh", gltfModel: { url: "model.glb" } });
```

詳細は [Mesh Layer Reference](../../../three_default_layers/mesh-layer/about/) を参照してください。

### エフェクトレイヤー

ポストプロセッシングエフェクトを適用するレイヤーです。アンチエイリアス、SSAO、SSR など、豊富なエフェクトを提供します。

```typescript
import { FXAAEffectLayer, SSAOEffectLayer } from "@navara/three_default_layers";

view.registerEffect("fxaa", FXAAEffectLayer);
view.registerEffect("ssao", SSAOEffectLayer);

// 登録後に使用
view.addLayer({ type: "effect", fxaa: {} });
view.addLayer({ type: "effect", ssao: {} });
```

詳細は [Effect Layer Reference](../../../three_default_layers/effect-layer/about/) を参照してください。

### ライトレイヤー

シーンの照明を管理するレイヤーです。太陽光、環境光、ライトプローブなどを提供します。

```typescript
import { SunLightLayer, AmbientLightLayer } from "@navara/three_default_layers";

view.registerLight("sun", SunLightLayer);
view.registerLight("ambient", AmbientLightLayer);

// 登録後に使用
view.addLayer({ type: "light", sun: { intensity: 1.0, castShadow: true } });
view.addLayer({ type: "light", ambient: { intensity: 0.3 } });
```

詳細は [Light Layer Reference](../../../three_default_layers/light-layer/about/) を参照してください。
