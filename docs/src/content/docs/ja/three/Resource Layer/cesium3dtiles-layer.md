---
title: Cesium 3D Tiles Layer
description: Cesium 3D Tiles レイヤーの使い方
sidebar:
  order: 22
---

Cesium 3D Tiles レイヤーは、3D Tiles フォーマットの大規模な 3D データセットを表示するためのレイヤーです。建物モデル、点群、写真測量データなどを効率的に表示できます。

## 対応仕様

Navara は以下の 3D Tiles 仕様に対応しています。

### 3D Tiles 1.0

| タイルフォーマット | 説明 |
| ------------------ | ---- |
| b3dm (Batched 3D Model) | 建物などのバッチ化された 3D モデル |
| pnts (Point Cloud) | 点群データ |
| Google Photorealistic 3D Tiles | Google Maps Platform が提供するフォトリアリスティックタイル |

### 3D Tiles 1.1

| 機能 | 説明 |
| ---- | ---- |
| GLB コンテンツ | GLB（バイナリ glTF）をコンテンツフォーマットとして使用するタイル |
| `EXT_mesh_features` | glTF メッシュ内の FeatureId セットによるフィーチャー識別 |
| `EXT_structural_metadata` | glTF アセットに埋め込まれたプロパティテーブルによるフィーチャーごとのメタデータへのアクセス |

:::note
- GLB（バイナリ glTF コンテナ）のみ対応しています。外部 `.bin` バッファを参照するプレーンな `.gltf` ファイルには未対応です。
- Implicit tiling は現在サポートされていません。タイルセットは `tileset.json` による明示的なタイル階層を使用する必要があります。
:::

## 基本設定

| プロパティ | 型                | 説明                   |
| ---------- | ----------------- | ---------------------- |
| `type`     | `"cesium3dtiles"` | レイヤータイプ（必須） |
| `data`     | `{ url: string }` | tileset.json の URL    |

## 対応マテリアル

| マテリアル                                                               | 設定キー | 説明                  |
| ------------------------------------------------------------------------ | -------- | --------------------- |
| [ModelMaterial](../../../three/resource-layer-reference/model-material/) | `model`  | 3D モデルの外観を制御 |

## 使用例

### 基本的な 3D Tiles レイヤー

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const tilesLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
    url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 0.1,
    roughness: 0.1,
  },
});
```

### Google Photorealistic 3D Tiles

[Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) も追加できます。利用するには Google Maps API キーが必要です。

```typescript
import ThreeView, { type Layer } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const layer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${YOUR_GOOGLE_MAPS_API_KEY}`,
  },
  model: {
    maxSse: 60,
  },
});
```

### クレジットの動的取得

Google Photorealistic 3D Tiles などのデータソースでは、表示中のタイルに応じたクレジットを動的に取得・表示する必要があります。`Layer` クラスのイベントを使用してクレジットを追跡できます。

**利用可能なイベント:**

| イベント名                 | 説明                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `featureCreated`           | フィーチャー（タイル）が作成されたときに発火。`credit` プロパティでクレジット情報を取得可能 |
| `featureRemoved`           | フィーチャーが削除されたときに発火                                                          |
| `featureVisibilityChanged` | フィーチャーの表示/非表示が切り替わったときに発火                                           |

**使用例:**

```typescript
import ThreeView, { type Layer } from "@navara/three";

const layer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${YOUR_GOOGLE_MAPS_API_KEY}`,
  },
  model: {
    maxSse: 60,
  },
});

// クレジット情報を保持するMap
const featureCredits = new Map<bigint, string>();
// 現在表示中のフィーチャーを追跡
const visibleFeatures = new Set<bigint>();

// クレジット表示を更新するヘルパー関数
const updateCreditsDisplay = () => {
  const creditCounts = new Map<string, number>();
  for (const id of visibleFeatures) {
    const credit = featureCredits.get(id);
    if (credit) {
      // セミコロンで区切られた複数のクレジットを分割
      credit.split(";").forEach((c) => {
        const trimmed = c.trim();
        creditCounts.set(trimmed, (creditCounts.get(trimmed) ?? 0) + 1);
      });
    }
  }
  // creditCounts にはクレジット文字列とその出現回数が格納される
  console.log("Visible credits:", Array.from(creditCounts.keys()));
};

// フィーチャー作成時：クレジット情報を保存
layer.on("featureCreated", ({ featureId, credit }) => {
  if (credit) {
    featureCredits.set(featureId, credit);
  }
  visibleFeatures.add(featureId);
  updateCreditsDisplay();
});

// フィーチャー削除時：クレジット情報を削除
layer.on("featureRemoved", ({ featureId }) => {
  featureCredits.delete(featureId);
  visibleFeatures.delete(featureId);
  updateCreditsDisplay();
});

// 表示/非表示切り替え時：visibleFeatures を更新
layer.on("featureVisibilityChanged", ({ featureId, visible }) => {
  if (visible) {
    visibleFeatures.add(featureId);
  } else {
    visibleFeatures.delete(featureId);
  }
  updateCreditsDisplay();
});
```

:::warning
Google Photorealistic 3D Tiles を使用する場合、[Google Maps Platform の利用規約](https://cloud.google.com/maps-platform/terms) に従い、適切なクレジット表示を行う必要があります。
:::

## 関連リソース

- [ModelMaterial](../../../three/resource-layer-reference/model-material/) - モデルマテリアルの詳細設定
