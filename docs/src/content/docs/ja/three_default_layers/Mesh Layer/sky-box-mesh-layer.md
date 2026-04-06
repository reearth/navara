---
title: SkyBoxMeshLayer
description: Sky box mesh layer for navara_three
sidebar:
  order: 112
---

`SkyBoxMeshLayer`は、シンプルなスカイボックスをシーンに追加するレイヤーです。昼夜の空の色と太陽の色を設定でき、大気散乱シミュレーション（`SkyMeshLayer`）を使用せずに軽量な空の表現が可能です。

## Properties

### skyBox

**Type:** `object | undefined`

**Description:** スカイボックスの設定オプション。

#### dayColor

**Type:** `Color | undefined`

**Description:** 昼間の空の色を指定します。

**Default:** `new Color().setHex(0x92c1ff)`（薄い青）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb), // スカイブルー
  }
}
```

#### nightColor

**Type:** `Color | undefined`

**Description:** 夜間の空の色を指定します。

**Default:** `new Color().setHex(0x000033)`（暗い青）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    nightColor: new Color().setHex(0x000022), // より暗い青
  }
}
```

#### sunColor

**Type:** `Color | undefined`

**Description:** 太陽周辺の色を指定します。

**Default:** `new Color().setHex(0xffddae)`（薄いオレンジ）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    sunColor: new Color().setHex(0xffd700), // ゴールド
  }
}
```

## 使用例

### 基本的な使用例

```typescript
import ThreeView, { SkyBoxMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// デフォルト設定でスカイボックスを追加
const skyBox = view.addLayer<SkyBoxMeshLayer>({
  type: "mesh",
  skyBox: {},
});
```

### カスタムカラーの設定

```typescript
import ThreeView, { SkyBoxMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// カスタムカラーでスカイボックスを追加
const skyBox = view.addLayer<SkyBoxMeshLayer>({
  type: "mesh",
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb),    // スカイブルー
    nightColor: new Color().setHex(0x0a0a2e),   // ダークブルー
    sunColor: new Color().setHex(0xffa500),     // オレンジ
  },
});
```

### 動的な色の更新

```typescript
// 時間帯に応じて色を変更
skyBox.update({
  skyBox: {
    dayColor: new Color().setHex(0xff6b6b),
    sunColor: new Color().setHex(0xff4500),
  },
});
```

## SkyMeshLayer との違い

| 特徴 | SkyBoxMeshLayer | SkyMeshLayer |
|------|-----------------|--------------|
| レンダリング方式 | シンプルなグラデーション | 物理ベースの大気散乱 |
| パフォーマンス | 軽量 | やや重い |
| リアリティ | 基本的 | 高い |
| 太陽・月の表示 | なし | あり |
| 大気テクスチャ | 不要 | 必要 |

### 使い分け

- **SkyBoxMeshLayer**: シンプルなビジュアライゼーション、パフォーマンス重視のシーン、スタイライズされた表現
- **SkyMeshLayer**: リアルな大気表現、時間帯による変化、太陽・月の表示が必要な場合

## 注意事項

- スカイボックスはカメラの視錐台カリングが無効化されており、常に描画されます。
- 色は大気の `sunDirection` に基づいて昼夜の色がブレンドされます。
- `SkyMeshLayer` と同時に使用する場合は、描画順序に注意してください。
