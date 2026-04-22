---
title: What is navara_three?
description: navara_three の概要と特徴について説明します。
sidebar:
  order: 1
---

## What is navara_three?

`navara_three` は、Three.js と Navara のヘッドレス地図エンジンを接続する JavaScript ライブラリです。Web 上で高品質な 3D 地図アプリケーションを構築できます。

## navara_three の特徴

### 宣言的なレイヤー API

navara_three では、地図上に表示するすべての要素を「レイヤー」として宣言的に追加できます。

```typescript
// GeoJSON データをレイヤーとして追加
const layer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  polygon: { color: 0x3388ff, opacity: 0.6 },
});
```

従来の GIS 開発では複雑だった多くのデータ形式（GeoJSON、MVT、3D Tiles、地形データ、ラスタタイルなど）を、すべて統一されたレイヤー API で扱えます。

### Material によるスタイル設定

各レイヤーには Material を指定してスタイルを設定します。ポイント、ライン、ポリゴンなど地物の種類ごとに色、サイズ、透明度などを柔軟に指定できます。

```typescript
view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0xff0000, size: 10 },
  polyline: { color: 0x00ff00, width: 2 },
  polygon: { color: 0x0000ff, opacity: 0.5 },
});
```

### 3D オブジェクト・エフェクト・ライトもレイヤーとして管理

GIS データだけでなく、3D メッシュ、ポストプロセッシングエフェクト、照明もレイヤーとして追加できます。これにより、地図とビジュアルエフェクトを統一的な API で管理できます。

メッシュ・エフェクト・ライトレイヤーは、使用前にレイヤークラスの登録が必要です。

```typescript
import { BoxMeshDesc, FXAAEffectDesc, SunLightDesc } from "@navara/three_default_layers";

// レイヤークラスを登録
view.registerMesh("box", BoxMeshDesc);
view.registerEffect("fxaa", FXAAEffectDesc);
view.registerLight("sun", SunLightDesc);

// 3D ボックスを追加
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });

// アンチエイリアスを適用
view.addEffect({ fxaa: {} });

// 太陽光を追加
view.addLight({ sun: { intensity: 1.0 } });
```

### 地物への動的アクセス

レイヤーは宣言的な追加だけでなく、地物への動的なアクセスも可能です。イベントを通じて個々の地物にアクセスし、データに基づいたスタイル設定やインタラクションを実装できます。

```typescript
import { Color } from "@navara/three";

layer.on("featureUpdated", (evaluator) => {
  // 地物のプロパティに基づいてスタイルを動的に変更
  evaluator.evaluate((batchId, property) => {
    const population = property?.["population"] as number;
    return {
      color: new Color().setHex(population > 1000000 ? 0xff0000 : 0x00ff00),
    };
  });
});
```
