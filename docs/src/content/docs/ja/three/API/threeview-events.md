---
title: ThreeView Events
description: API Reference for ThreeView Class Events
sidebar:
  order: 920
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
view.on("featureClick", handlers.handlePick);

// Later, cleanup all listeners
view.off("click", handlers.handleClick);
view.off("resize", handlers.handleResize);
view.off("featureClick", handlers.handlePick);
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

### featureClick

**Description:**

地物がクリックされたときに発火します。クリックされた地物情報、または何もない場所をクリックした場合は `null` を受け取ります。クリックの生の座標が必要な場合は `click` イベントを使用してください。

クリックピックは遅延起動されます。`featureClick` のリスナーが 1 つ以上登録されている間だけ GPU ピックが実行されます。

:::note
このイベントを使用するには、ThreeView のコンストラクタで `picking: true` を設定する必要があります（デフォルトで有効）。
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: クリックされた地物情報、または `null`

```tsx
type PickedFeature = {
  batchId: number; // バッチ ID
  properties: Record<string, unknown> | undefined; // 地物のプロパティ
  layerId: string | undefined; // レイヤー ID
};
```

**Example:**

```tsx
view.on("featureClick", (info) => {
  if (info) {
    console.log("選択された地物:", info.properties);
    console.log("レイヤー ID:", info.layerId);
    console.log("バッチ ID:", info.batchId);
  } else {
    console.log("地物が選択されていません");
  }
});
```

### featureHover

**Description:**

ポインタの移動によってホバー中の地物が変わったときに発火します。新たにホバーされた地物、またはどのピッカブルな地物からもポインタが外れた場合は `null` を受け取ります。マウス移動のたびではなく、ホバー対象が変化したときのみ発火します。

ホバーピッキングはポインタ移動中に毎フレーム GPU ピックを実行するため、遅延起動されます。`featureHover`・`featureEnter`・`featureLeave` のいずれかのリスナーが登録されている間だけピックが実行され、マウスボタンが押されている間（カメラドラッグ中など）は抑制されます。

:::note
このイベントを使用するには、ThreeView のコンストラクタで `picking: true` を設定する必要があります（デフォルトで有効）。
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: ホバー中の地物情報、または `null`

**Example:**

```tsx
view.on("featureHover", (info) => {
  view.canvas.style.cursor = info ? "pointer" : "";
});
```

### featureEnter

**Description:**

ポインタがピッカブルな地物のホバーを開始したときに発火します。`featureLeave` とともに、`featureHover` と同じホバーピッキングから合成されるため、同じ起動条件が適用されます。

**Handler Type:**

```tsx
(info: PickedFeature) => void
```

**Parameters:**

- `info`: ホバーが開始された地物

**Example:**

```tsx
view.on("featureEnter", (info) => {
  console.log("地物にホバー開始:", info.properties);
});
```

### featureLeave

**Description:**

直前までホバーしていた地物からポインタが外れたときに発火します。離れた地物を受け取ります。ある地物から別の地物へ直接ポインタが移動した場合、前の地物の `featureLeave` が新しい地物の `featureEnter` より先に発火します。

**Handler Type:**

```tsx
(info: PickedFeature) => void
```

**Parameters:**

- `info`: ホバーが終了した地物

**Example:**

```tsx
view.on("featureLeave", (info) => {
  console.log("地物からホバー終了:", info.properties);
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

### idle

**Description:**

データやタイルの処理がアイドル状態になったとき、つまりタイルの読み込みやデータ処理などの更新が `idleThreshold` ミリ秒以上発生しなかったときに発火します。常時実行されるアニメーションやエフェクトはアクティビティとして扱われないため、それらが動作中でもこのイベントは発火します。アイドル期間中に最大 1 回だけ発火し、処理が再開されるとリセットされます。

**Handler Type:**

```tsx
() => void
```

**Example:**

```tsx
view.on("idle", () => {
  console.log("エンジンがアイドル状態になりました");
});
```

:::tip
`idleThreshold` コンストラクタオプションで、イベントが発火するまでのアイドル時間を設定できます。デフォルトは 100 ms です。
:::

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
