---
title: About
description: three_plugins の概要と特徴について説明します。
sidebar:
  order: 1
---

## three_plugins とは

`three_plugins` は、`navara_three` 向けのユースケース特化型プラグインのコレクションです。コアライブラリが `Plugin` 基底クラスを提供し、`three_default_plugin` が Descriptor の一括登録を担うのに対して、`three_plugins` は特定のユースケースをすぐに解決できる高レベルなプラグインを提供します。

## 他パッケージとの関係

```text
navara_three（コア: ThreeView, Plugin, addPlugin）
  ├── three_default_descs（Descriptor の実装）
  ├── three_default_plugin（DefaultPlugin: Descriptor の一括登録）
  └── three_plugins（ユースケース特化型プラグイン）
        ├── FlyingModelPlugin（キーボード操作による GLTF モデル飛行）
        └── OverlayPlugin（ワールド座標からスクリーン座標への HTML オーバーレイ投影）
```

`three_plugins` は `Plugin` 基底クラスとコア API のために `navara_three` に依存し、`DefaultDescriptions` 型のために `three_default_plugin` に依存しています。各プラグインは独立しており、片方だけを使うこともできます。

## インストール

```typescript
import { FlyingModelPlugin, OverlayPlugin, moveOverlayElement } from "@navara/three_plugins";
```

## 提供プラグイン

### FlyingModelPlugin

キーボード操作による GLTF モデル飛行シミュレーターです。アニメーション付きの GLTF モデルを地球上にロードし、WASD / 矢印キーで操作できます。追従カメラ付きで、毎フレーム位置状態をブロードキャストします。詳細は [FlyingModelPlugin](../flyingmodelplugin/) を参照してください。

### OverlayPlugin

毎フレーム、地理座標（緯度/経度/高度）をスクリーン座標に投影するプラグインです。ワールド座標に追従する HTML オーバーレイ（マーカー、ラベル、ツールチップなど）を実現します。詳細は [OverlayPlugin](../overlayplugin/) を参照してください。

## 使い方

どちらのプラグインも標準的なプラグインのライフサイクルに従います。インスタンスを作成し、`view.init()` の前に `view.addPlugin()` で登録し、初期化後にプラグイン固有のメソッドを使用します。

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { FlyingModelPlugin, OverlayPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container, animation: true });

const defaultPlugin = new DefaultPlugin();
const flyingModel = new FlyingModelPlugin({
  modelUrl: "/glTF/bird/scene.gltf",
  animation: {
    idleClip: "Gliding",
    dashClip: "Flapping",
    speed: 1.0,
    crossfadeDuration: 0.3,
  },
});
const overlay = new OverlayPlugin({ maxDistance: 100_000 });

view.addPlugin(defaultPlugin);
view.addPlugin(flyingModel);
view.addPlugin(overlay);

await view.init();

flyingModel.start();
```

## 関連リソース

- [About Plugin](../../three/introduction/about-plugin/) — プラグインシステムの概念
- [Plugin API](../../three/core/plugin/) — プラグインの実装方法
- [three_default_plugin](../../three_default_plugin/about/) — DefaultPlugin の詳細
