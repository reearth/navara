---
title: Common Types
description: navara_three のマテリアルやディスクリプタ間で共有されるプリミティブ型の API リファレンス
sidebar:
  order: 23
---

このページでは、`navara_three` の複数のマテリアルやディスクリプタで共有されるプリミティブ型について説明します。

## Vec2

2D ベクトルを表すクラスです。

### Constructor

```typescript
new Vec2(x: number, y: number)
```

**Parameters:**

- `x`: X 座標値
- `y`: Y 座標値

### Properties

#### x

**Type:** `number`

**Description:** X 座標値。

#### y

**Type:** `number`

**Description:** Y 座標値。

## XYZ

3D のベクトルや座標を表すプレーンオブジェクト型です。

```typescript
type XYZ = { x: number; y: number; z: number };
```

### Properties

#### x

**Type:** `number`

**Description:** X 座標値。

#### y

**Type:** `number`

**Description:** Y 座標値。

#### z

**Type:** `number`

**Description:** Z 座標値。
