---
title: ThreeView Events
description: API Reference for ThreeView Class Events
sidebar:
  order: 12
---

このページでは、ThreeView インスタンスで利用可能なすべてのイベントを説明します。

## Methods

### on()

様々なビューイベントのイベントリスナーを登録します。

```tsx
on<K extends keyof ViewEvents>(event: K, handler: ViewEvents[K]): void
```

### off()

イベントリスナーを削除します。

```tsx
off<K extends keyof ViewEvents>(event: K, handler: ViewEvents[K]): void
```

**Example:**

```tsx
const resizeHandler = (width, height) => {
  console.log(`Resized to ${width}x${height}`);
};

// Register event listener
view.on("resize", resizeHandler);

// Later, remove the listener
view.off("resize", resizeHandler);
```

### Advanced Example

```tsx
// Create named handlers for easy cleanup
const handlers = {
  handleClick: (event) => {
    console.log("Clicked:", event);
  },
  handleResize: (width, height) => {
    console.log(`Resized: ${width}x${height}`);
  },
  handlePick: (info) => {
    if (info) {
      console.log("Picked:", info.properties);
    }
  },
};

// Register multiple listeners
view.on("click", handlers.handleClick);
view.on("resize", handlers.handleResize);
view.on("pick", handlers.handlePick);

// Later, cleanup all listeners
view.off("click", handlers.handleClick);
view.off("resize", handlers.handleResize);
view.off("pick", handlers.handlePick);
```

## Event Types

### resize

**Description:**

ウィンドウがリサイズされたときに発火します。幅と高さをピクセル単位で受け取ります。

**Handler Type:**

```tsx
(width: number, height: number) => void
```

**Parameters:**

- `width`: リサイズ後の幅（ピクセル）
- `height`: リサイズ後の高さ（ピクセル）

**Example:**

```tsx
view.on("resize", (width, height) => {
  console.log(`ウィンドウがリサイズされました: ${width}x${height}`);
});
```

### pick

**Description:**

地物がピック（選択）されたときに発火します。ピックされた地物情報、または何も選択されていない場合は `null` を受け取ります。

:::note
このイベントを使用するには、ThreeView のコンストラクタで `picking: true` を設定する必要があります。
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: ピックされた地物情報、または `null`

```tsx
type PickedFeature = {
  properties: Record<string, unknown>; // 地物のプロパティ
  batchId: number | null; // バッチ ID
  layerId: string | null; // レイヤー ID
};
```

**Example:**

```tsx
view.on("pick", (info) => {
  if (info) {
    console.log("選択された地物:", info.properties);
    console.log("レイヤー ID:", info.layerId);
    console.log("バッチ ID:", info.batchId);
  } else {
    console.log("地物が選択されていません");
  }
});
```

### layer

**Description:**

レイヤー関連のイベントが発生したときに発火します。

**Handler Type:**

```tsx
<K extends keyof LayerEvent>(
  k: K,
  layerId: string,
  ...args: Parameters<LayerEvent[K]>
) => void
```

**Example:**

```tsx
view.on("layer", (eventType, layerId, ...args) => {
  console.log(`Layer ${layerId} event: ${eventType}`, args);
});
```

### preUpdate

**Description:**

更新処理の前に発火します。`DOMHighResTimeStamp` をタイムスタンプとして受け取ります。

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp`（ミリ秒単位の高精度タイムスタンプ）

**Example:**

```tsx
view.on("preUpdate", (time) => {
  // 更新前のカスタムロジック
  console.log(`更新前: ${time}ms`);
});
```

### postUpdate

**Description:**

状態変更が発生した更新処理の後に発火します。`DOMHighResTimeStamp` をタイムスタンプとして受け取ります。

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp`（ミリ秒単位の高精度タイムスタンプ）

**Example:**

```tsx
view.on("postUpdate", (time) => {
  // 更新後のカスタムロジック
  console.log(`更新後: ${time}ms`);
});
```

### preRender

**Description:**

レンダリング前に発火します。`animation: true` の場合、毎フレーム発火します。`DOMHighResTimeStamp` をタイムスタンプとして受け取ります。

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp`（ミリ秒単位の高精度タイムスタンプ）

**Example:**

```tsx
view.on("preRender", (time) => {
  // レンダリング前のカスタムロジック
  console.log(`レンダリング前: ${time}ms`);
});
```

### postRender

**Description:**

レンダリング後に発火します。`animation: true` の場合、毎フレーム発火します。`DOMHighResTimeStamp` をタイムスタンプとして受け取ります。

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp`（ミリ秒単位の高精度タイムスタンプ）

**Example:**

```tsx
view.on("postRender", (time) => {
  // レンダリング後のカスタムロジック
  console.log(`レンダリング後: ${time}ms`);
});
```

### mousedown

**Description:**

マップ上でマウスボタンが押されたときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("mousedown", (event) => {
  console.log(`マウスダウン位置: ${event.clientX}, ${event.clientY}`);
  console.log(
    `マップ座標（ECEF）: ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```

### mouseenter

**Description:**

マウスが canvas 領域に入ったときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("mouseenter", (event) => {
  console.log("マウスがマップに入りました");
  console.log(`マップ座標: ${event.map.x}, ${event.map.y}, ${event.map.z}`);
});
```

### mouseleave

**Description:**

マウスが canvas 領域から出たときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("mouseleave", (event) => {
  console.log("マウスがマップから出ました");
});
```

### mousemove

**Description:**

マップ上でマウスが移動したときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("mousemove", (event) => {
  console.log(`マウス位置: ${event.clientX}, ${event.clientY}`);
  console.log(
    `マップ座標（ECEF）: ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```

### mouseup

**Description:**

マップ上でマウスボタンが離されたときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("mouseup", (event) => {
  console.log(`マウスアップ位置: ${event.clientX}, ${event.clientY}`);
  console.log(`マップ座標: ${event.map.x}, ${event.map.y}, ${event.map.z}`);
});
```

### click

**Description:**

マップがクリックされたときに発火します。マップ座標を含む `MapMouseEvent` を受け取ります。

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: マウスイベント（マップ座標を含む）

**Example:**

```tsx
view.on("click", (event) => {
  console.log(`クリック位置: ${event.clientX}, ${event.clientY}`);
  console.log(
    `マップ座標（ECEF）: ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```
