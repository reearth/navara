---
title: About Plugin
description: プラグインシステムの概念について説明します。
sidebar:
  order: 5
---

## なぜプラグインシステムが必要か

Navara は多様な GIS ビジュアライゼーションを実現するために設計されています。

従来の地図エンジンは表現が固定的で CG の自由度がとても低く、Three.js のような汎用レンダリングエンジンを使う方が効率の良い場面もありました。しかし、汎用レンダリングエンジンのみで GIS を扱うのは非常に高度な技術が要求され、拡張性を維持するのも困難です。

そこで navara_three では、**GIS データを効率的に処理しつつ、汎用レンダリングエンジンの自由度を活かす**ためにプラグインシステムを導入しています。プラグインシステムにより、開発者が自由にエフェクト表現やメッシュを追加し、より多様な表現を実現できます。

## プラグインの用途

プラグインシステムは、できる限り汎用的な用途で利用できるように設計されています。例えば以下のようなユースケースが考えられます：

- **セットアップの自動化** — 開発者が実装したカスタム Descriptor を一括登録するプラグイン
- **インタラクティブな地図操作** — 地図上に線や面を描画するプラグイン
- **新しいデータフォーマットのサポート** — 独自の GIS フォーマットを GeoJSON レイヤーとして読み込むプラグイン

## アーキテクチャ

navara_three は GIS に関連する高度な処理を API として抽象化することに責務を持ちます。GIS と関連の薄い機能は外部モジュールとして切り出し、navara_three が公開する API を利用して機能を実現します。

```
navara_three（コア）
  ├── GIS データ処理・座標変換・タイル管理などの高度な処理を抽象化
  ├── API（addLayer, addMesh, addEffect, addLight, registerMesh, registerEffect, registerLight）
  └── プラグイン API（addPlugin, Plugin クラス）

three_default_descs（外部モジュール）
  └── Three.js 固有のメッシュ・エフェクト・ライトを Descriptor として実装

three_default_plugin（外部モジュール）
  └── DefaultPlugin でデフォルト Descriptor の一括登録と高レベル API を提供
```

たとえば、[three_default_descs](../../../three_default_descs/about/) パッケージは Three.js 固有のメッシュやエフェクト、ライトを navara_three の API を使用して Descriptor として実装しています。さらに [three_default_plugin](../../../three_default_plugin/about/) がこれらを一括で登録し、フォトリアルなシーンを簡単にセットアップできる高レベル API を提供します。

navara_three はできるだけ汎用性の高いモジュールであることを目指しますが、その代償として API が高度になります。プラグインシステムがこれを高レベル API へと抽象化し、開発者がシンプルに利用できるようにします。

## プラグインのライフサイクル

プラグインは以下の順序で動作します：

1. **プラグインの作成** — プラグインインスタンスを生成
2. **登録** — `view.addPlugin()` でプラグインを登録（`view.init()` の**前**に行う必要あり）
3. **初期化** — `view.init()` が呼ばれると、登録済みのすべてのプラグインの `init()` が自動的に実行される
4. **利用** — 初期化後、プラグインが提供するメソッドや Descriptor を利用可能

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// 1. プラグインインスタンスを作成
const plugin = new DefaultPlugin();

// 2. view.init() の前にプラグインを登録
const view = new ThreeView({});
view.addPlugin(plugin);

// 3. init() 内でプラグインの init() が自動的に呼ばれる
await view.init();

// 4. 初期化後、プラグインのメソッドを利用可能
const layers = plugin.addDefaultPhotorealScene();
```

:::caution
`view.addPlugin()` は必ず `view.init()` の**前**に呼び出してください。初期化後に呼び出すとエラーになります。
:::

## DefaultPlugin

[three_default_plugin](../../../three_default_plugin/about/) パッケージが提供する `DefaultPlugin` は、[three_default_descs](../../../three_default_descs/about/) の全 32 Descriptor（メッシュ 16 種、エフェクト 12 種、ライト 4 種）を一括登録するプラグインです。ほとんどのプロジェクトではこれだけで十分です。

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// すべてのデフォルト Descriptor が利用可能
view.addMesh({ sky: {} });
view.addLight({ sun: { intensity: 1.0 } });
view.addEffect({ toneMapping: {} });
```

詳細は [three_default_plugin のドキュメント](../../../three_default_plugin/about/) を参照してください。

## 関連リソース

- [About Layer](../../../three/introduction/about-layer/) - レイヤーとオブジェクトの概念と種類
- [Plugin API](../../../three/core/plugin/) - プラグインの実装方法
- [Custom Descriptor](../../../three/core/custom-desc/) - カスタム Descriptor の実装方法
- [three_default_descs](../../../three_default_descs/about/) - デフォルト Descriptor の実装
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin の詳細
