---
title: InstancedPlaneMeshDesc
description: navara_three 向け GPU インスタンス平面メッシュ
sidebar:
  order: 106
---

`InstancedPlaneMeshDesc` クラスは、GPU インスタンシングを使用して複数の平面インスタンスをレンダリングするメッシュです。すべての平面が 1 つのジオメトリとマテリアルを共有し、1 回の描画コールで高パフォーマンスにレンダリングされます。`InstancedMeshDesc` を継承しています。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## 共有マテリアルプロパティ

すべてのインスタンスに適用される共有プロパティです。`planes` 設定オブジェクト内で指定します。セグメント数は共有ジオメトリに焼き込まれ、インスタンスごとに変えることはできません。

### widthSegments

**Type:** `number`

**Description:** 共有平面ジオメトリの横方向セグメント数を指定します。

**Default:** `1`

### heightSegments

**Type:** `number`

**Description:** 共有平面ジオメトリの縦方向セグメント数を指定します。

**Default:** `1`

### color

**Type:** `Color`

**Description:** すべてのインスタンスの基本色を `Color` インスタンスで指定します。

**Default:** `new Color().setStyle("#ffffff")`

### emissiveColor

**Type:** `Color`

**Description:** エミッシブ（自己発光）色を指定します。

**Default:** `new Color().setHex(0x000000)`

### emissiveIntensity

**Type:** `number`

**Description:** エミッシブの強度を指定します。

**Default:** `0`

### opacity

**Type:** `number`

**Description:** 不透明度を指定します。0.0（完全透明）から 1.0（完全不透明）の範囲です。

**Default:** `1`

### transparent

**Type:** `boolean`

**Description:** 透明度を有効にするかどうかを指定します。

**Default:** `false`

### castShadow

**Type:** `boolean`

**Description:** インスタンスが影を落とすかどうかを指定します。

**Default:** `false`

### receiveShadow

**Type:** `boolean`

**Description:** インスタンスが影を受けるかどうかを指定します。

**Default:** `false`

## インスタンスごとのプロパティ (PlaneChildConfig)

各平面インスタンスのプロパティを `children` 配列内で指定します。

### width

**Type:** `number`

**Description:** 平面の幅（X 軸方向）を指定します。インスタンス行列のスケールとしてエンコードされます。`scale.x` が指定された場合は乗算されます。

**Default:** `1`

### height

**Type:** `number`

**Description:** 平面の高さ（Y 軸方向）を指定します。インスタンス行列のスケールとしてエンコードされます。`scale.y` が指定された場合は乗算されます。

**Default:** `1`

### color

**Type:** `Color | undefined`

**Description:** このインスタンス固有の色を指定します。共有マテリアルの `color` を上書きします。

**Default:** `undefined`

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** 親グループに対するローカル位置を指定します。

**Default:** `{ x: 0, y: 0, z: 0 }`

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカル回転（オイラー角、ラジアン）を指定します。

**Default:** `undefined`

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカルスケールを指定します。`width` および `height` と乗算されます。

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** 事前計算された変換行列を指定します。設定時は `position`、`rotation`、`scale` は無視されます。

**Default:** `undefined`

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** このメッシュに適用する selective effect descriptor の ID 配列を指定します。

### pickable

**Type:** `boolean` (optional)

**Description:** 個々のインスタンスのピッキングを有効にします。

**Default:** `false`

## インスタンス管理

[InstancedMeshDesc](../../../three/core/custom-desc/#custom-instanced-mesh-desc) から継承される、動的なインスタンス管理メソッド:

### handle.ref.add(config)

新しいインスタンスを追加し、そのインデックスを返します。

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  width: 20,
  height: 20,
  color: new Color().setHex(0xffff00),
});
```

### handle.ref.removeAt(index)

指定インデックスのインスタンスを削除します。

### handle.ref.updateAt(index, config)

指定インデックスのインスタンスを部分更新します。

### handle.ref.clear()

すべてのインスタンスを削除します。

### handle.ref.replaceAll(configs)

全インスタンスをバッチ置換します。

### handle.ref.count

アクティブなインスタンス数を取得します。

## 使用例

### 基本的な使い方

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedPlaneMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("planes", InstancedPlaneMeshDesc);
await view.init();

const handle = view.addMesh<InstancedPlaneMeshDesc>({
  planes: {
    color: new Color().setHex(0xffffff),
    receiveShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, width: 10, height: 20, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, width: 15, height: 10, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, width: 5, height: 40, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```
