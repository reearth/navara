---
title: FeatureEvaluator
description: API Reference for FeatureEvaluator class
sidebar:
  order: 17
---

FeatureEvaluator は、地物データへのアクセスと、プロパティに基づいた地物の動的スタイリングを提供するクラスです。Layer の `featureCreated` および `featureUpdated` イベントを通じて取得できます。

このクラスを使用して以下のことができます：
- データソースから地物プロパティを読み取る
- プロパティに基づいて地物を動的にスタイリングする

:::note
イベントの詳細なパラメータ型については [Descriptor Types](./layer-types#events) を参照してください。
:::

## Properties

### id

**Type:** `FeatureId`

**Description:** この地物の一意な識別子を取得します。

**Example:**

```typescript
layer.on("featureCreated", ({ evaluator }) => {
  console.log("地物ID:", evaluator.id);
});
```

## Types

### FeatureInfo

```typescript
type FeatureInfo = {
  batchIndex: number;
  batchId: number;
  properties: Record<string, unknown> | undefined;
};
```

### FeatureEvaluatorCallback

```typescript
type FeatureEvaluatorCallback = (
  info: FeatureInfo,
) => Partial<EvaluatedValue>;
```

## Methods

### readFeatureProperties()

データソースからこの地物のプロパティを読み取ります。コールバックはこの地物内の各バッチに対して呼び出されます。

**Syntax:**

```typescript
readFeatureProperties(
  f: (info: FeatureInfo) => void
): void
```

**Parameters:**

- `f`: 各バッチの FeatureInfo オブジェクトを受け取るコールバック関数

**Example:**

```typescript
// すべてのプロパティをログ出力
evaluator.readFeatureProperties(({ batchId, properties }) => {
  console.log(`バッチ ${batchId}:`, properties);
});

evaluator.readFeatureProperties(({ properties }) => {
  const attributes = properties?.["attributes"] ?? {};
  const minHeight = attributes["minHeight"];
  const maxHeight = attributes["maxHeight"];
  console.log("高さ範囲:", minHeight, "-", maxHeight);
});
```

### readFilteredFeatureProperties()

データソースからこの地物の指定されたルートプロパティキーのみを読み取ります。少数のプロパティのみが必要な場合、`readFeatureProperties()` よりも効率的です。

**Syntax:**

```typescript
readFilteredFeatureProperties(
  keys: string[],
  f: (info: FeatureInfo) => void
): void
```

**Parameters:**

- `keys`: 読み取るルートプロパティキーの配列
- `f`: フィルタリングされたプロパティのみを含む FeatureInfo オブジェクトを受け取るコールバック関数

**Example:**

```typescript
evaluator.readFilteredFeatureProperties(["height", "name"], ({ batchId, properties }) => {
  console.log(`バッチ ${batchId}: height=${properties?.["height"]}, name=${properties?.["name"]}`);
});
```

### evaluate()

プロパティに基づいて地物に動的スタイルを評価・適用します。コールバックはこの地物内の各バッチ（サブ地物）に対して呼び出されます。

**Syntax:**

```typescript
evaluate(
  f: FeatureEvaluatorCallback,
  options?: {
    filters?: string[];
  }
): void
```

**Parameters:**

- `f`: FeatureInfo オブジェクトを受け取り、スタイル値を返すコールバック関数
- `options`: オプションの設定
  - `options.filters`: 読み取るルートプロパティキーの配列。指定した場合、一致するプロパティのみがコールバックに渡され、大規模なデータセットでのパフォーマンスが向上します。

**Returns:**

コールバック関数は以下のプロパティを含むオブジェクトを返すことができます：

| Property | Type | Description |
|----------|------|-------------|
| `color` | `Color` | 地物の色（`new Color()` を使用） |
| `show` | `boolean` | 地物の表示/非表示 |
| `height` | `number` | 地物の高さ（メートル） |
| `extrudedHeight` | `number` | ポリゴンの押し出し高さ（メートル） |
| `text` | `string` | ラベルテキストの内容（テキスト/ラベル地物用） |

:::note
評価されたスタイルはレイヤーのデフォルトスタイルを上書きします。
:::

**Example:**

```typescript
import { Color } from "@navara/three";

// 3D Tiles の建物を高さで色分け
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const measuredHeight = properties?.["height"] as number;

    const color = (() => {
      if (measuredHeight < 30) return new Color().setStyle("#00ff00");
      if (measuredHeight < 60) return new Color().setStyle("#ffff00");
      if (measuredHeight < 90) return new Color().setStyle("#ff00ff");
      return new Color().setStyle("#ff0000");
    })();

    return {
      color,
      show: measuredHeight >= 30, // 低い建物を非表示
    };
  });
});
```

```typescript
// GeoJSON ポリゴンにプロパティベースの押し出しを適用
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const height = (properties?.["height"] as number) ?? 0;
    const extrudedHeight = (properties?.["extrudedHeight"] as number) ?? 0;

    return {
      height,
      extrudedHeight,
    };
  });
});
```

```typescript
// MVT 地物をカテゴリプロパティで色分け
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const category = properties?.["category"] as string;

    const color = (() => {
      if (category === "A") return "#0000ff";
      if (category === "B") return "#00ff00";
      return "#ff0000";
    })();

    return {
      color: new Color().setStyle(color),
    };
  });
});
```

```typescript
// テキストラベルのフィルタリングとスタイリング
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const text = properties?.["name"] as string;

    return {
      text,
      show: !!text,
    };
  });
});
```

```typescript
// pick イベントで選択した地物をハイライト
let selectedId: string | undefined;

// クリックで地物を選択
view.on("pick", (info) => {
  selectedId = info?.properties?.["id"] as string;
  layer.forceUpdate(); // スタイルを再評価
});

// 選択状態に基づいて色を変更
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const id = properties?.["id"] as string;

    return {
      color: new Color().setHex(selectedId === id ? 0xff0000 : 0xffffff),
    };
  });
});
```

## EvaluatedValue Type

`evaluate()` コールバックから返すことができる型の定義：

```typescript
type EvaluatedValue = {
  /** 地物の色 */
  color?: Color;
  /** 地物の表示/非表示 */
  show?: boolean;
  /** ポリゴンの押し出し高さ（メートル） */
  extrudedHeight?: number;
  /** 地物の高さ（メートル） */
  height?: number;
  /** ラベルテキストの内容 */
  text?: string;
};
```

:::tip[推奨]
`evaluate()` は変更したいプロパティのみを返してください。すべてのプロパティはオプショナルです。
:::
