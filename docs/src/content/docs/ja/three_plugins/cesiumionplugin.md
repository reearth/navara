---
title: CesiumIonPlugin
description: navara_three 向けの Cesium Ion quantized-mesh 地形プラグイン。
sidebar:
  order: 5
---

## 概要

`CesiumIonPlugin` は、`init()` 時に [Cesium Ion](https://cesium.com/platform/cesium-ion/) のアセットエンドポイントを解決し、`addTerrain()` を通じてそのアセットを quantized-mesh 地形レイヤーとしてビューに登録します。

Cesium Ion の認証フロー（`https://api.cesium.com/v1/assets/<assetId>/endpoint` からエンドポイント URL とアクセストークンを取得する処理）はプラグインが受け持つため、アプリケーション側はアセット ID と Cesium Ion のアクセストークンを渡すだけで利用できます。

## 使い方

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { CesiumIonPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container, animation: true });
const cesiumIon = new CesiumIonPlugin({
  assetId: 12345, // Cesium ion asset id
  accessToken: "<your cesium ion token>",
});

view.addPlugin(new DefaultPlugin());
view.addPlugin(cesiumIon);
await view.init();

cesiumIon.addTerrain({
  maxZoom: 14,
  castShadow: true,
  receiveShadow: true,
  tms: true,
  geographic: true,
  requestVertexNormals: true,
  requestWaterMask: true,
});
```

## コンストラクタ

```typescript
new CesiumIonPlugin(config: CesiumIonConfig)
```

### CesiumIonConfig

| プロパティ    | 型                 | デフォルト                           | 説明                                                                                                             |
| ------------- | ------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `assetId`     | `number \| string` | —                                    | Cesium Ion のアセット ID。                                              |
| `accessToken` | `string`           | —                                    | アセットエンドポイントの解決に使用する Cesium Ion アクセストークン。                                             |
| `endpoint`    | `string`           | `"https://api.cesium.com/v1/assets"` | Cesium Ion アセットエンドポイントのベース URL を上書きします（プロキシやセルフホストエンドポイントを使う場合）。 |

## メソッド

### addTerrain(options)

```typescript
addTerrain(options?: CesiumIonTerrainOptions): Layer
```

解決済みの Cesium Ion アセットを quantized-mesh 地形レイヤーとして登録します。内部では `quantized-mesh` ソースを作成し（`view.addSource(...)`）、`view.addLayer({ type: "terrain", source })` で描画します。`view.init()` が完了してから呼び出してください。それ以前に呼ぶとエンドポイント未解決のため例外が投げられます。

戻り値は `view.addLayer()` が返す `Layer` ハンドルです。

## 型

### CesiumIonTerrainOptions

`CesiumIonTerrainOptions` は、`quantized-mesh` ソースの取得／デコードオプション（`type`、`url`、`token` を除いたもの。これらは解決済みの Cesium Ion エンドポイントからプラグインが補います）と、terrain レイヤーのメッシュ描画オプションをまとめたフラットなオブジェクトです。プラグインは各フィールドを内部で `view.addSource()` または `view.addLayer()` に振り分けます。

主なオプション:

| プロパティ             | 型        | 説明                                                                                                        |
| ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `maxZoom`              | `number`  | Cesium Ion エンドポイントから取得する最大ズームレベル。                                                     |
| `minZoom`              | `number`  | Cesium Ion エンドポイントから取得する最小ズームレベル。                                                     |
| `overscaledMaxZoom`    | `number`  | このズームレベルに達するまで地形をアップサンプリングします。                                                |
| `castShadow`           | `boolean` | 地形が影を落とすかどうか。                                                                                  |
| `receiveShadow`        | `boolean` | 地形が影を受けるかどうか。                                                                                  |
| `tms`                  | `boolean` | TMS タイル座標を使用するかどうか。Cesium Ion の quantized-mesh アセットは TMS です。                        |
| `geographic`           | `boolean` | 地理座標系（EPSG:4326）のタイルスキームかどうか。Cesium Ion の quantized-mesh はこれに該当します。          |
| `requestVertexNormals` | `boolean` | 頂点ごとの法線を Cesium Ion エンドポイントに要求します。quantized-mesh データから陰影付けするのに必要です。 |
| `requestWaterMask`     | `boolean` | ウォーターマスクを Cesium Ion エンドポイントに要求します。                                                  |
| `skirt`                | `boolean` | 地形タイルのスカートを描画するかどうか。                                                                    |
| `skirtExaggeration`    | `number`  | スカートの高さに適用される倍率。                                                                            |
| `show`                 | `boolean` | 地形を表示するかどうか。                                                                                    |
| `showBoundingBox`      | `boolean` | タイルごとのバウンディングボックスを描画します（デバッグ用）。                                              |

全フィールドは `quantized-mesh` ソースと terrain レイヤーの `terrain` 描画オプションを参照してください。

## 関連リソース

- [About three_plugins](../about/) — パッケージ概要
- [Terrain Layer](../../three/layer/terrain-layer/) — Terrain レイヤーのリファレンス
