---
title: What is navara_three_api?
description: navara_three_api の概要と特徴について説明します。
sidebar:
  order: 2
---

## What is navara_three_api?

`navara_three_api` は、GIS 特有の計算処理を個別の API として提供するユーティリティライブラリです。Three.js の型システムと統合されており、地理空間アプリケーション開発に必要な計算処理とレンダリングエンジンの連携を容易に実現できます。

:::tip[推奨]
`@navara/three` を使用する場合は、navara_three_api の関数は `@navara/three` から直接インポートできます。別途インストールする必要はありません。
:::

## 提供する機能

以下は navara_three_api が提供する代表的な機能です。すべての関数やクラスの詳細については [API Reference](../../../three/api-reference/navara_three_api/) を参照してください。

### 座標変換

緯度経度（測地座標）と Three.js のワールド座標（ECEF）を相互に変換できます。

```typescript
import { geodeticToVector3, degreeToRadian } from "@navara/three";

// 東京の座標を Three.js の Vector3 に変換
const position = geodeticToVector3({
  lat: degreeToRadian(35.6762),
  lng: degreeToRadian(139.6503),
  height: 100,
});
```

### スクリーン座標と世界座標の変換

マウスクリック位置から地図上の地理座標を取得したり、地理座標から画面上のピクセル位置を計算できます。これにより、インタラクティブな地図操作やラベル配置などを実装できます。

```typescript
import { convertScreenToWorld } from "@navara/three";
import { Vector2 } from "three";

// クリック位置から地図上の座標を取得
const screenPos = new Vector2(event.clientX, event.clientY);
const worldPos = convertScreenToWorld(windowObject, camera, screenPos);
```

### ローカル座標系の変換

地球上の特定地点を原点とするローカル座標系（East-North-Up など）を設定できます。3D モデルを地表に正しく配置する際に必要な変換行列を取得できます。

```typescript
import { eastNorthUpToFixedFrame, geodeticToVector3 } from "@navara/three";

// 東京を原点とした ENU 座標系の変換行列を取得
const origin = geodeticToVector3(tokyoLle);
const enuMatrix = eastNorthUpToFixedFrame(origin);

// メッシュに適用して地表に正しく配置
mesh.matrix.copy(enuMatrix);
```

### 測地線計算

2 点間の地球表面上での距離や方位角を計算できます。航路表示やエリア計算などに利用できます。

```typescript
import { EllipsoidGeodesic, degreeToRadian } from "@navara/three";

const geodesic = new EllipsoidGeodesic(tokyo, osaka);
console.log(`距離: ${geodesic.distance / 1000} km`);
console.log(`方位角: ${geodesic.startHeading} rad`);
```

## navara_three との関係

navara_three_api は navara_three とは独立して使用することもできますが、通常は navara_three と組み合わせて使用します。navara_three がレイヤーベースの宣言的な地図構築を担当し、navara_three_api が座標計算やインタラクション処理をサポートします。
