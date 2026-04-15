---
title: Getting Started
description: Navara で最初の 3D 地図アプリケーションを作成するクイックスタートガイド。
sidebar:
  order: 3
---

## クイックスタート

このページでは、Navara で 3D 地図を表示するために必要な最小限のコードを説明します。最後には、ラスタータイルとカメラ位置が設定された動作するマップが完成します。

## 前提条件

[Node.js](https://nodejs.org/)（v18 以降）と、npm や pnpm などのパッケージマネージャーがインストールされている必要があります。

## プロジェクトの作成

最も手軽に始める方法は、スターターテンプレートを使うことです。

```bash
npm create navara-three-starter my-navara-app
cd my-navara-app
npm install
npm run dev
```

これにより、Navara と依存関係が事前に設定された最小限のプロジェクトが生成されます。

## 最小限の例

3D 地図を作成し、ラスタータイルレイヤーを追加し、カメラを設定するコアコードは以下の通りです。

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// ビューを作成
const view = new ThreeView({
  animation: true,
  shadow: true,
});

// ビルトインレイヤーを持つデフォルトプラグインを登録
const plugin = new DefaultPlugin();
view.addPlugin(plugin);

// エンジンを初期化
await view.init();

// OpenStreetMap を使用したラスタータイルレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 18,
  },
});

// カメラを東京上空に配置
view.setCamera({
  lng: 139.77,
  lat: 35.68,
  height: 10000,
  heading: 0,
  pitch: -30,
  roll: 0,
});
```

## このコードの動作

`ThreeView` クラスは Navara のメインエントリーポイントです。インスタンスを作成すると、Three.js のレンダラー、シーングラフ、レンダリングパイプラインがセットアップされます。`animation: true` オプションは連続レンダリングを有効にし、`shadow: true` はシャドウマッピングを有効にします。

`init()` を呼び出す前に、プラグインを登録します。`DefaultPlugin` は 30 以上のレイヤータイプ — 空、大気、ライティング、地形、ポストプロセッシングエフェクト — を登録するので、初期化後にすぐ使用できます。カスタムレイヤータイプ用の独自プラグインを作成・登録することもできます。

`init()` 呼び出しは WASM GIS エンジンを初期化し、バックグラウンド処理用の Web Worker をセットアップし、レンダリングパイプラインを準備します。これはレイヤーを追加する前に完了する必要がある非同期操作です。

初期化後、`addLayer()` でグローブ上に新しいレイヤーを作成します。この例では、OpenStreetMap タイルを読み込むラスタータイルレイヤーを追加しています。Navara の GIS エンジンがタイル管理、LOD、空間インデキシングを自動的に処理します。

最後に、`setCamera()` でカメラを地理座標と高度、方位、ピッチで配置します。カメラは即座にこの位置に移動します。アニメーション付きの遷移には、代わりに `flyTo()` を使用できます。

## 次のステップ

この例はほんの入り口です。地形の標高を追加したり、GeoJSON データを表示したり、複数のレイヤーを組み合わせる方法を学ぶには、[Basic Visualization Tutorial](../../../three/Tutorial/basic-visualization/) に進んでください。
