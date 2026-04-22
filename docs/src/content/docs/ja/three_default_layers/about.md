---
title: About
description: three_default_layers の概要と特徴について説明します。
sidebar:
  order: 1
---

## What is three_default_layers?

`three_default_layers` は、`navara_three` が提供するレイヤーシステム向けのデフォルトDescriptor実装パッケージです。3D メッシュ、ポストプロセッシングエフェクト、照明など、よく使われるDescriptorをすぐに利用できる形で提供します。

## navara_three との関係

`navara_three` はオブジェクトの追加・管理を行うコアライブラリですが、個々のDescriptorの実装は含まれていません。`three_default_layers` がメッシュ、エフェクト、ライトの具体的な実装を提供します。

```
navara_three（コア）
  └── three_default_layers（デフォルトDescriptor実装）
        ├── Mesh Desc（3D メッシュ）
        ├── Effect Desc（ポストプロセッシング）
        └── Light Desc（照明）
```

## 使い方

`three_default_layers` のDescriptorを使用するには、`view.addMesh()` / `view.addEffect()` / `view.addLight()` を呼び出す前に `view.registerMesh()` / `view.registerEffect()` / `view.registerLight()` でDescriptorクラスを登録する必要があります。

```typescript
import ThreeView from "@navara/three";
import { BoxMeshDesc, FXAAEffectDesc, SunLightDesc } from "@navara/three_default_layers";

const view = new ThreeView();

// Descriptorクラスを登録
view.registerMesh("box", BoxMeshDesc);
view.registerEffect("fxaa", FXAAEffectDesc);
view.registerLight("sun", SunLightDesc);

await view.init({ canvas: document.getElementById("canvas") });

// 登録後に addMesh / addEffect / addLight で使用可能
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addEffect({ fxaa: {} });
view.addLight({ sun: { intensity: 1.0 } });
```

:::tip
すべてのデフォルトDescriptorを一括で登録したい場合は、[three_default_plugin](../../../three_default_plugin/about/) の `DefaultPlugin` を使用すると便利です。
:::

## 提供されるDescriptorの種類

### メッシュ

3D メッシュオブジェクトをシーンに追加するDescriptorです。ボックス、球体、円柱などの基本形状や、glTF モデルの読み込みに対応しています。

```typescript
import { BoxMeshDesc, GLTFModelDesc } from "@navara/three_default_layers";

view.registerMesh("box", BoxMeshDesc);
view.registerMesh("gltfModel", GLTFModelDesc);

// 登録後に使用
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addMesh({ gltfModel: { url: "model.glb" } });
```

詳細は [Mesh Desc Reference](../../../three_default_layers/mesh-desc/about/) を参照してください。

### エフェクト

ポストプロセッシングエフェクトを適用するDescriptorです。アンチエイリアス、SSAO、SSR など、豊富なエフェクトを提供します。

```typescript
import { FXAAEffectDesc, SSAOEffectDesc } from "@navara/three_default_layers";

view.registerEffect("fxaa", FXAAEffectDesc);
view.registerEffect("ssao", SSAOEffectDesc);

// 登録後に使用
view.addEffect({ fxaa: {} });
view.addEffect({ ssao: {} });
```

詳細は [Effect Desc Reference](../../../three_default_layers/effect-desc/about/) を参照してください。

### ライト

シーンの照明を管理するDescriptorです。太陽光、環境光、ライトプローブなどを提供します。

```typescript
import { SunLightDesc, AmbientLightDesc } from "@navara/three_default_layers";

view.registerLight("sun", SunLightDesc);
view.registerLight("ambient", AmbientLightDesc);

// 登録後に使用
view.addLight({ sun: { intensity: 1.0, castShadow: true } });
view.addLight({ ambient: { intensity: 0.3 } });
```

詳細は [Light Desc Reference](../../../three_default_layers/light-desc/about/) を参照してください。
