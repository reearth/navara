---
title: InstancedSphereMeshDesc
description: navara_three 向け GPU インスタンス球メッシュ
sidebar:
  order: 104
---

`InstancedSphereMeshDesc` クラスは、GPU インスタンシングを使用して複数の球インスタンスをレンダリングするメッシュです。すべての球が 1 つのジオメトリとマテリアルを共有し、1 回の描画コールで高パフォーマンスにレンダリングされます。`InstancedMeshDesc` を継承しています。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## 共有マテリアルプロパティ

すべてのインスタンスに適用される共有プロパティです。`spheres` 設定オブジェクト内で指定します。セグメントや弧（arc）のパラメータは共有ジオメトリに焼き込まれ、インスタンスごとに変えることはできません。

### widthSegments

**Type:** `number`

**Description:** 共有球ジオメトリの横方向セグメント数を指定します。

**Default:** `32`

### heightSegments

**Type:** `number`

**Description:** 共有球ジオメトリの縦方向セグメント数を指定します。

**Default:** `16`

### phiStart

**Type:** `number`

**Description:** 水平方向の開始角（ラジアン）を指定します。

**Default:** `0`

### phiLength

**Type:** `number`

**Description:** 水平方向の角度範囲（ラジアン）を指定します。

**Default:** `Math.PI * 2`

### thetaStart

**Type:** `number`

**Description:** 垂直方向の開始角（ラジアン）を指定します。

**Default:** `0`

### thetaLength

**Type:** `number`

**Description:** 垂直方向の角度範囲（ラジアン）を指定します。

**Default:** `Math.PI`

### color

**Type:** `Color`

**Description:** すべてのインスタンスの基本色を `Color` インスタンスで指定します。

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  spheres: {
    color: new Color().setHex(0xff0000),
  }
}
```

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

## インスタンスごとのプロパティ (SphereChildConfig)

各球インスタンスのプロパティを `children` 配列内で指定します。

### radius

**Type:** `number`

**Description:** 球の半径を指定します。インスタンス行列の均等スケールとしてエンコードされます。`scale` が指定された場合は乗算されます。

**Default:** `1`

### color

**Type:** `Color | undefined`

**Description:** このインスタンス固有の色を指定します。共有マテリアルの `color` を上書きします。

**Default:** `undefined`（共有マテリアルの色を使用）

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

**Description:** ローカルスケールを指定します。`radius` と乗算されます。

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
  radius: 20,
  color: new Color().setHex(0xffff00),
});
```

### handle.ref.removeAt(index)

指定インデックスのインスタンスを削除します。swap-with-last による O(1) 削除のため、順序は保持されません。

### handle.ref.updateAt(index, config)

指定インデックスのインスタンスを部分更新します。

### handle.ref.clear()

すべてのインスタンスを削除します。

### handle.ref.replaceAll(configs)

全インスタンスをバッチ置換します。`clear()` と複数回の `add()` よりも効率的です。

### handle.ref.count

アクティブなインスタンス数を取得します。

## 使用例

### 基本的な使い方

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedSphereMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("spheres", InstancedSphereMeshDesc);
await view.init();

const handle = view.addMesh<InstancedSphereMeshDesc>({
  spheres: {
    color: new Color().setHex(0xffffff),
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, radius: 10, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, radius: 15, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, radius: 5, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```
