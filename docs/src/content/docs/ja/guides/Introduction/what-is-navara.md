---
title: What is Navara?
description: Navara の概要 — 拡張性の高い汎用 3D 地図エンジン。
sidebar:
  order: 1
---

## Navara とは？

Web マップエンジンは長らく、二者択一を強いてきました。洗練された宣言的 API を持つエンジンは導入しやすい一方でビルトイン機能を超えた拡張が難しく、低レベルの制御を提供するエンジンは強力な反面、高度な専門知識を要求します。そして完全な 3D 地球儀アプリケーションでは、事実上後者しか選択肢がありませんでした。Navara は、このトレードオフをなくすために開発された、拡張性の高い汎用 3D 地図エンジンです。衛星画像、地形、3D 都市モデル、ベクターデータといった現実世界の地理空間データをインタラクティブな地球儀上にストリーミングし、アプリケーションの用途に合わせて表現できます。データ可視化のためのシンプルなベースマップ、属性に基づくフィーチャー単位のスタイリングから、大気・太陽光・影を備えたフォトリアルなシーンまで対応します。

Navara は、Three.js などのレンダリングエンジンをラップしたライブラリ（`@navaramap/three` 等）を通して利用します。すべての地理空間計算は Web Worker に分散された Rust/WASM GIS エンジンが担うため、大規模データセットでもマップはレスポンシブに動作します。仕組みの詳細に興味があれば [How Navara Works](../how-navara-works/) を参照してください。

## 数行のコードで地球儀を

衛星画像を地球儀に表示するにはこれだけのコードで済みます。この例では、オプションのフォトリアルな空・太陽・大気も有効にしています。

![Hero](@assets/hero.png)

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";

const view = new ThreeView({ useNormal: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

// Initialization

await view.init();

// Setup scene
defaultPlugin.addDefaultPhotorealScene();
view.atmosphere.date = new Date("2026-07-16T01:00:00Z");
view.toneMappingExposure = 10;

// Layer declaration

const raster = view.addSource({
  type: "raster-tile",
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  maxZoom: 8,
});

view.addLayer({
  type: "raster",
  source: raster,
  raster: {},
});

// Attribution

view.attribution?.add([{ attributionHtml: `Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble: Next Generation (public domain)` }]);
```

実際に試してみたい場合は、[Getting Started](../getting-started/) でプロジェクトのセットアップ手順を追えます。また、[Examples](https://navara-preview.netlify.app/) ギャラリーでは Navara で何ができるかをブラウザ上のライブデモで確認できます。

## Navara でできること

Navara の機能は 4 つの階層に整理されています。まずは宣言的 API から始め、必要になったときだけ下の階層に降りていくのが基本です。

### 宣言的 API

[Source](../../../three/source/about/) と[レイヤー](../../../three/layer/about/)をプレーンな設定オブジェクトで追加できます。ベースマップ、地形、ベクターデータ、Cesium 3D Tiles をカバーします。各 Source がフェッチ、キャッシュ、LOD（詳細度）制御を自動で処理し、1 つの Source を複数のレイヤーで共有できるため、再フェッチなしでスタイルを変更できます。メッシュ・エフェクト・ライトの Descriptor も同じ宣言的スタイルで扱えます。大気散乱、ボリュメトリッククラウド、ポストプロセッシングエフェクトはいずれも `addMesh` / `addEffect` / `addLight` に設定オブジェクトを渡すだけで追加できます。

### プラグイン

既製の[プラグイン](../../../three_plugins/about/)は、目的別の機能をまとめて提供します。フォトリアルシーン（[`addDefaultPhotorealScene()`](../../../three_default_plugin/about/)）、一人称視点ウォーク（`PersonViewPlugin`）、地理座標に固定する DOM オーバーレイ（`OverlayPlugin`）、Attribution UI などです。再利用可能な機能を[独自のプラグイン](../../../three/core/plugin/)としてパッケージ化することもできます。

### 低レベル API

設定オブジェクトや既製のプラグインでは足りないときは 1 つ下の階層へ。[`FeatureEvaluator`](../../../three/api/feature-evaluator/) で属性に基づいて個々のフィーチャーをスタイリングし（建物を高さで色分けする、属性値でフィルタリングするなど）、`pick` イベントや地形サンプリングでフィーチャーのピックや地形の照会を行い、測地系 / ECEF の数学ユーティリティで座標変換や測地線距離を計算できます。GIS 計算はマップエンジンなしで動作する[スタンドアロンパッケージ](../../../three/api/navara_three_api/)（`@navaramap/three-api`）としても利用できます。

### カスタム Descriptor

ビルトインで足りない場合は、独自のメッシュ・エフェクト・ライトの [Descriptor](../../../three/core/custom-desc/) を作成できます。レンダリングエンジンのシーングラフとレンダーパイプラインへのフルアクセス — 深度バッファや法線 / G バッファ（MRT）を含む — を持ちます。これは Navara のビルトイン Descriptor を支えるのと同じ基盤であり、制限された抜け道ではありません。

## 他のマップエンジンとの比較

各 Web マップエンジンにはそれぞれの設計思想と強みがあります。これらを理解することで、Navara の立ち位置とそのトレードオフが明確になります。

**CesiumJS** は最も成熟した 3D 地理空間エンジンであり、3D Tiles 仕様の策定者でもあります。大規模 3D データの可視化において豊富な実績を持ちます。幅広い低レベル API を提供しており、開発者は多様な機能を比較的自由に実装できます。一方で、その API 面の広さゆえに学習コストが高く、カスタム機能を効果的に構築するにはエンジンの深い知識が求められます。

**MapLibre GL JS** は洗練された高レベル API を提供し、宣言的にマップスタイルを簡単にカスタマイズできます。活発なオープンソースコミュニティと成熟したエコシステムにより、2D ベクタータイルアプリケーションには優れた選択肢です。ただし、ビルトイン API の範囲を超えた機能拡張については、カスタマイズの選択肢はより限定的です。

**deck.gl** は MapLibre GL JS（または MapboxGL）に豊富な可視化レイヤーと明快な合成レイヤーモデルを追加します。この組み合わせは強力ですが、両方のライブラリとその統合パターンを学ぶ必要があります。

**Navara** はこれらのアプローチの強みを、階層化された単一の API のもとに統合することを目指しています。一般ユーザー向けには、レイヤーの追加や [`FeatureEvaluator`](../../../three/api/feature-evaluator/) によるフィーチャーのスタイリングを行える高レベルな宣言的 API を提供しています。プラグインによりワークフローをさらに簡素化することもできます。例えば、JSON からレイヤー定義を読み込んだり、MapLibre Style Plugin（開発中）を使用して馴染みのある JSON 形式でフィーチャースタイルを定義したりできます。カスタム機能を構築したい上級ユーザー向けには、プラグインシステム、カスタムメッシュ Descriptor、カスタムエフェクト Descriptor を通じて低レベル API へのアクセスを提供しています。これらは Navara 自身のビルトイン Descriptor を支えるのと同じ基盤です。さらに、マップエンジン本体とは独立して使用できる、座標変換や測地線計算のためのスタンドアロン GIS API も提供しています。

## 次のステップ

[Getting Started](../getting-started/) に進んで最初の地球儀を作るか、[How Navara Works](../how-navara-works/) で Navara のアーキテクチャとパッケージ構成を理解しましょう。
