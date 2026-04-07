---
title: About
description: three_default_plugin の概要と特徴について説明します。
sidebar:
  order: 1
---

## What is three_default_plugin?

`three_default_plugin` は、`navara_three` の `Plugin` システムを利用して、`three_default_layers` が提供するすべてのレイヤーを `ThreeView` に一括登録するプラグインです。`DefaultPlugin` クラスを `view.addPlugin()` で追加するだけで、メッシュ・エフェクト・ライトの全レイヤーが利用可能になります。

## navara_three / three_default_layers との関係

```
navara_three（コア: ThreeView, Plugin, addPlugin, registerMesh/Effect/Light）
  ├── three_default_layers（レイヤーの実装: 17 メッシュ, 12 エフェクト, 4 ライト）
  └── three_default_plugin（DefaultPlugin: レイヤーの一括登録 + ユーティリティ）
```

`navara_three` はレイヤーの登録・管理の仕組み（`registerMesh`, `registerEffect`, `registerLight`）を提供します。`three_default_layers` は個々のレイヤークラスの実装を提供します。`three_default_plugin` はこれらを橋渡しし、すべてのデフォルトレイヤーを `ThreeView` に登録します。

## 使い方

### 基本的なセットアップ

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView();

// init() の前にプラグインを追加
view.addPlugin(plugin);
await view.init({ canvas: document.getElementById("canvas") });
```

プラグインの `init()` で以下のレイヤーが自動的に登録されます：

**メッシュレイヤー（17 種）:** `rain`, `snow`, `sky`, `skyBox`, `stars`, `box`, `boxes`, `sphere`, `glowGlobe`, `cylinder`, `tube`, `plane`, `gltfModel`, `axesHelper`, `arrowHelper`, `arcLines`, `smoothLines`

**エフェクトレイヤー（12 種）:** `aerialPerspective`, `rainDrop`, `clouds`, `fogLight`, `lensFlare`, `ssao`, `ssr`, `depthOfField`, `colorGradingLUT`, `toneMapping`, `smaa`, `fxaa`

**ライトレイヤー（4 種）:** `sun`, `ambient`, `skyLightProbe`, `lightProbe`

### addDefaultPhotorealLayers()

`DefaultPlugin` は、フォトリアルな 3D 地図シーンを簡単に構築するための `addDefaultPhotorealLayers()` メソッドを提供します。`view.init()` の後に呼び出すことで、空、星、太陽光、大気エフェクトなどが自動的に追加されます。

```typescript
const plugin = new DefaultPlugin();
const view = new ThreeView();
view.addPlugin(plugin);
await view.init({ canvas: document.getElementById("canvas") });

// フォトリアルなシーンを一括セットアップ
const layers = plugin.addDefaultPhotorealLayers();
// layers.sky, layers.sun, layers.aerialPerspective, ... が返される
```

追加されるレイヤー：

| レイヤー | 種別 | 説明 |
|---------|------|------|
| `sky` | mesh | 空の描画 |
| `skyEnv` | mesh | 環境マップ用の空 |
| `stars` | mesh | 星の描画 |
| `skyLightProbe` | light | 空に基づく環境光 |
| `sun` | light | 太陽光 |
| `aerialPerspective` | effect | 大気遠近法エフェクト |
| `lensFlare` | effect | レンズフレア（デスクトップのみ） |
| `toneMapping` | effect | トーンマッピング |
| `antialiasing` | effect | SMAA（デスクトップ）/ FXAA（モバイル） |

モバイル環境では、パフォーマンスのためにレンズフレアがスキップされ、アンチエイリアスに軽量な FXAA が使用されます。
