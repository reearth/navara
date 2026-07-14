---
title: Common Types
description: API Reference for common primitive types shared across navara_three materials and descriptors
sidebar:
  order: 1030
---

This page documents primitive types that are shared across multiple materials and descriptors in `navara_three`.

## Vec2

A class representing a 2D vector.

### Constructor

```typescript
new Vec2(x: number, y: number)
```

**Parameters:**

- `x`: X coordinate value
- `y`: Y coordinate value

### Properties

#### x

**Type:** `number`

**Description:** X coordinate value.

#### y

**Type:** `number`

**Description:** Y coordinate value.

## XYZ

A plain object type representing a 3D vector or point.

```typescript
type XYZ = { x: number; y: number; z: number };
```

### Properties

#### x

**Type:** `number`

**Description:** X coordinate value.

#### y

**Type:** `number`

**Description:** Y coordinate value.

#### z

**Type:** `number`

**Description:** Z coordinate value.
