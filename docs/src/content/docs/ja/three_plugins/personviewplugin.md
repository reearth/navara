---
title: PersonViewPlugin
description: navara_three 向けのキーボード操作 一人称 / 三人称ビュー コントローラー。
sidebar:
  order: 2
---

## 概要

`PersonViewPlugin` はキーボード入力で動かす一人称 / 三人称ビューのコントローラーです。地球上の仮想位置を駆動し、それを追いかける追従カメラ（TPV）または一人称カメラ（FPV）を提供します。任意で GLTF キャラクターを取り付けられます。アタッチした場合、プラグインがモデルのロード・位置・方位の更新と、アイドルとダッシュの 2 クリップ間のクロスフェードまで担当します。

キャラクターは省略可能です。省略した場合もプラグインは仮想位置を駆動してカメラを追従させるため、独自のアバターを持つシーンや無人の空中遊覧用の純粋な視点コントローラーとして使えます。

毎フレーム、位置・方位・速度・現在の視点モードを通知するので、HUD などの UI を構築するのも容易です。

## 使い方

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three-default-plugin";
import { PersonViewPlugin } from "@navaramap/three-plugins";

const view = new ThreeView({ container, animation: true });
const defaultPlugin = new DefaultPlugin();
const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/bird/scene.gltf",
    animation: {
      idleClip: "Gliding",
      dashClip: "Flapping",
      speed: 1.0,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: -Math.PI / 2, y: 0, z: Math.PI },
  },
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
});

view.addPlugin(defaultPlugin);
view.addPlugin(personView);
await view.init();

// 初期化後にループを開始
personView.start();

// 状態の購読
const unsub = personView.onStateChange((state) => {
  console.log(state.lat, state.lng, state.alt, state.heading, state.mode);
});

// 新しい位置にテレポート
personView.teleport({ lng: 139.77, lat: 35.68, alt: 300 });

// 三人称 / 一人称を切り替え
personView.toggleViewMode();

// クリーンアップ
unsub();
personView.dispose();
```

## キーボード操作

| キー              | アクション                                                            |
| ----------------- | --------------------------------------------------------------------- |
| W / S             | 前進 / 後退                                                           |
| A / D             | 左旋回 / 右旋回                                                       |
| Arrow Up / Space  | 上昇                                                                  |
| Arrow Down / Ctrl | 下降                                                                  |
| Shift             | ダッシュ（`dashSpeedMultiplier` 倍・既定 2.5、`dashClip` に切り替え） |
| Alt（押下中）     | フリーカメラ操作（TPV: オービット / FPV: フリールック）               |
| V                 | TPV / FPV の切り替え                                                  |

すべてのキー割り当ては `keys` オプションで再設定できます（[KeyBindings](#keybindings) を参照）。地形コリジョンを `"ground"` モードで動かしている間は高度を地形が決めるため、上昇・下降は効きません（[地形コリジョン](#地形コリジョン) を参照）。

`<input>`、`<textarea>`、`contenteditable` 要素にフォーカスがある場合、キーボード入力は自動的に抑制されます。`personView.movementSuppressed = true` を設定すると、すべての移動キーを一時的に無効にすることもできます（モーダルダイアログの表示中など）。

## カメラの挙動

カメラは次の 2 モードのいずれかで動作します。

- **TPV（三人称視点）**: キャラクターの背後やや上に位置する追従カメラ。カメラの方位はキャラクターの方位に向けて滑らかに補間されます。
- **FPV（一人称視点）**: キャラクターの目線位置にカメラを置き、進行方向を向きます。FPV ではキャラクターのモデルはデフォルトで非表示になります（`character.hideModelInFpv` で変更可）。

**V** キー（または `toggleViewMode()`）で切り替えます。**Alt** 押下中はカメラを手動操作できます。TPV ではキャラクター中心にオービット、FPV では目線位置を固定したまま視点だけ自由に回せます（フリールック）。`allowCameraControl: true` を設定すると、Alt を押さなくても常時フリーカメラになります。

Alt を離してもカメラの向きは **そのまま保持** されます。好きな角度で眺め続けたいときに便利です。前進・後退・旋回・上昇・下降のいずれかの移動キーを押した時点でフリーカメラ状態が解除され、TPV のチェイス位置や FPV の標準姿勢にスナップして戻ります。Dash と `V` は解除のトリガーになりません。

## 地形コリジョン

デフォルトではキャラクターは飛行状態で、高度は上昇・下降キーだけで決まり、地形の表面は無視されます。`collision` オプションを指定すると、毎フレーム足元の地形の高さをサンプリングして地面に沿わせられます。

```typescript
const personView = new PersonViewPlugin({
  character: {
    /* ... */
  },
  collision: { mode: "ground" },
});

// 実行時に自由飛行へ戻す
personView.setCollision({ mode: "off" });
```

ほとんどの場面で指定が必要なのは `mode` だけです。残りのデフォルトは実際の地形を歩く用途に合わせてあり、後述のタイル読み込みによる揺れはプラグイン側で吸収します。`startHeight` には `startLat` / `startLng` 地点の地形に近い値を与えてください。確実に固定したい場合は、`start()` の前に [`resolveStartHeight()`](#resolvestartheightsource) を呼びます。

モードは 3 種類あります。

- **`"off"`**（デフォルト）: 地形を無視し、キャラクターは自由に飛行します。
- **`"clamp"`**: 飛行はそのままに、地形を床として扱います。表面より下に沈み込む位置になると押し上げられます。地面をすり抜けさせたくない飛行キャラクターに向いています。
- **`"ground"`**: キャラクターを地表に貼り付け、斜面を上り下りしながら徒歩で山を登れるようにします。このモードでは上昇・下降キーは効かず、高度は地形が決めるため `minAlt` / `maxAlt` も適用されません。

`groundOffset` はサンプリングした地表からキャラクターを浮かせる量で、モデルの原点が足元にない場合に使います。`alignToSlope`（デフォルトで有効）は立っている斜面に合わせてキャラクターを傾け、`"clamp"` で地形から離れて飛ぶと直立へ戻ります。

### 歩いている最中に読み込まれる地形

タイル未取得の地点では高さが得られないため、その間コリジョンは高度を変更せず、データが届いてから地表に落ち着きます。待っている間にキャラクターが海面へ落ちることはありません。読み込まれたタイルはその後もより細かいものへ置き換わり続けるので、キャラクターが動いていなくても足元の地表は動きます。読み込み直後はその差が数百 m に達することもあります。プラグインはこの追従に上限を設けています。地表を追いかけるのではなく地表へ「落ちる」ため、1 秒程度のタイル入れ替わりでは数 m 動くだけで済み、実際には数百 m ずれていた場合でも数秒で到達します。例の開始地点での実測では、上限なしの場合に 300m・545m のジャンプが発生するのに対し、上限ありでは数 m のドリフトに収まります。斜面の傾きも同じ理由で上限を設けています（無い場合は 1 フレームで 13° 振れます）。

ここに設定項目はありません。キャラクターが自分で「歩いて」乗った地形の変化は抑制されず、斜面は常に正確に追従し、テレポートはその場で着地します。

### 傾きを安定させる

地形の高さは三角形メッシュ上で連続ですが勾配は連続ではないため、`alignToSlope` の傾きは三角形の辺で段付きになることがあります。`slopeSampleDistance` は斜面を平均する範囲で、デフォルトは地形メッシュの三角形間隔に合わせてあり、辺ひとつで全身が振られることはありません。大きなキャラクターや粗い地形ソースでは値を上げてください。`maxSlopeTilt` は傾きの上限で、ほぼ垂直な面に忠実に合わせて壁に寝そべった姿勢になるのを防ぎます。

### 視線を山肌から出す

`cameraPitch` を固定すると視線は水平面に沿ったままですが、急斜面ではそこから地形が離れていきます。登坂ではカメラが山肌を正面から見る位置になり、画面が地面で埋まって進行方向が見えません。`cameraSlopeFollow` は代わりに視線を斜面に合わせて傾け、登りでは坂を見上げ、下りでは見下ろします。三人称カメラと一人称の視線の両方に効きます。`1`（デフォルト）で斜面と平行、`0` で従来どおりの固定ピッチです。歩けないほどの急斜面では 45° で振れ幅が止まります。

## コンストラクタ

```typescript
new PersonViewPlugin(config?: PersonViewConfig)
```

### PersonViewConfig

| プロパティ            | 型                | デフォルト      | 説明                                                                                                                     |
| --------------------- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `character`           | `CharacterConfig` | _(なし)_        | 任意のキャラクター。省略時は純粋なカメラコントローラーとして動作。                                                       |
| `collision`           | `CollisionConfig` | _(無効)_        | 地形コリジョン。[CollisionConfig](#collisionconfig) を参照。                                                             |
| `allowCameraControl`  | `boolean`         | `false`         | `true` にすると常時フリーカメラ（Alt 押下不要）。                                                                        |
| `initialView`         | `"tpv" \| "fpv"`  | `"tpv"`         | 初期視点モード。                                                                                                         |
| `moveSpeed`           | `number`          | `50`            | 前後移動速度（m/s）。                                                                                                    |
| `rotationSpeed`       | `number`          | `3`             | 旋回速度（deg/frame）。                                                                                                  |
| `altSpeed`            | `number`          | `30`            | 高度変更速度（m/s）。                                                                                                    |
| `dashSpeedMultiplier` | `number`          | `2.5`           | ダッシュキー押下中に `moveSpeed` へ掛かる倍率。                                                                          |
| `minAlt`              | `number`          | `50`            | 最低高度（メートル）。                                                                                                   |
| `maxAlt`              | `number`          | `5000`          | 最高高度（メートル）。                                                                                                   |
| `cameraDistance`      | `number`          | `50`            | 追従カメラ（TPV）の距離（メートル）。                                                                                    |
| `cameraPitch`         | `number`          | `0`             | TPV カメラの下向きピッチ（ラジアン。モデルの上方へ回り込む）。                                                           |
| `cameraLerpSpeed`     | `number`          | `3`             | カメラ方位の補間速度。                                                                                                   |
| `fpvForwardOffset`    | `number`          | `0`             | FPV 目線位置の前方オフセット（メートル）。                                                                               |
| `fpvHeightOffset`     | `number`          | `1`             | アイレベルの高さオフセット（メートル）。FPV では目線の高さ、TPV ではカメラが回り込む共有アイレベル高さとして使われます。 |
| `fpvPitch`            | `number`          | `0`             | FPV カメラの下向きピッチ（ラジアン。その場で視線を下に傾ける）。                                                         |
| `startLat`            | `number`          | `35.6812`       | 開始緯度（度）。                                                                                                         |
| `startLng`            | `number`          | `139.7671`      | 開始経度（度）。                                                                                                         |
| `startHeight`         | `number`          | `500`           | 開始高度（メートル）。                                                                                                   |
| `startHeading`        | `number`          | `Math.PI * 1.3` | 開始方位（ラジアン、0 = 北）。                                                                                           |
| `keys`                | `KeyBindings`     | _デフォルト_    | キー割り当て。[KeyBindings](#keybindings) を参照。                                                                      |

### CharacterConfig

| プロパティ            | 型                    | デフォルト             | 説明                                             |
| --------------------- | --------------------- | ---------------------- | ------------------------------------------------ |
| `modelUrl`            | `string`              | **（必須）**           | ロードする GLTF モデルの URL。                   |
| `animation`           | `AnimationConfig`     | **（必須）**           | アニメーションクリップの設定。                   |
| `modelRotationOffset` | `ModelRotationOffset` | `{ x: 0, y: 0, z: 0 }` | モデルのデフォルト向きを補正する回転オフセット。 |
| `modelScale`          | `number`              | `3`                    | モデルの均等スケール倍率。                       |
| `hideModelInFpv`      | `boolean`             | `true`                 | FPV のときにモデルを非表示にするかどうか。       |
| `castShadow`          | `boolean`             | `false`                | キャラクターが影を落とすかどうか。               |
| `receiveShadow`       | `boolean`             | `false`                | キャラクターが影を受けるかどうか。               |

### CollisionConfig

各モードの挙動は [地形コリジョン](#地形コリジョン) を参照してください。

| プロパティ            | 型                             | デフォルト | 説明                                                                                                     |
| --------------------- | ------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| `mode`                | `"off" \| "clamp" \| "ground"` | `"off"`    | 高度が地形にどう反応するか。無視する／床として扱う／貼り付く。                                            |
| `groundOffset`        | `number`                       | `0`        | サンプリングした地表からの高さ（m）。`"ground"` では足元の位置、`"clamp"` では沈み込めない床の高さ。      |
| `alignToSlope`        | `boolean`                      | `true`     | 立っている斜面に合わせてキャラクターを傾ける。1 フレームあたり数回の地形サンプリングが追加で必要。       |
| `slopeSampleDistance` | `number`                       | `4`        | 斜面を平均する範囲（m）。地形メッシュの三角形間隔に合わせた値。                                          |
| `maxSlopeTilt`        | `number`                       | `π / 4`    | `alignToSlope` が適用する傾きの上限（ラジアン）。ほぼ垂直な地形で壁に寝そべった姿勢になるのを防ぐ。       |
| `cameraSlopeFollow`   | `number`                       | `1`        | 地形の勾配にカメラのピッチをどれだけ追従させるか。`0`（固定）〜`1`（斜面と平行）。TPV / FPV 共通。       |

### AnimationConfig

| プロパティ          | 型        | 説明                                                                                                               |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `idleClip`          | `string`  | 静止時（移動キー未押下）に再生されるクリップ名。                                                                   |
| `walkClip`          | `string?` | ダッシュなしで移動中に再生されるクリップ名。省略すると移動中も `idleClip` が継続（idle + dash のみのモデル向け）。 |
| `dashClip`          | `string`  | ダッシュ時（ダッシュキー押下中）に再生されるクリップ名。                                                           |
| `speed`     | `number?` | 下記のクリップ別上書きが無いクリップに使われる再生速度。未指定なら `1`。             |
| `idleSpeed` | `number?` | idle クリップの再生速度。未指定なら `speed`（未指定なら `1`）。                    |
| `walkSpeed` | `number?` | walk クリップの再生速度。未指定なら `speed`（未指定なら `1`）。                    |
| `dashSpeed` | `number?` | dash クリップの再生速度。未指定なら `speed`（未指定なら `1`）。                    |
| `crossfadeDuration` | `number`  | クリップ間のクロスフェード遷移時間（秒）。                                                                         |

### ModelRotationOffset

| プロパティ | 型       | 説明                                   |
| ---------- | -------- | -------------------------------------- |
| `x`        | `number` | X 軸周りの回転オフセット（ラジアン）。 |
| `y`        | `number` | Y 軸周りの回転オフセット（ラジアン）。 |
| `z`        | `number` | Z 軸周りの回転オフセット（ラジアン）。 |

### KeyBindings

各エントリには `KeyboardEvent.code` の値の配列（例：`["KeyW"]`、`["ArrowUp", "ControlLeft"]`）を指定します。配列で複数キーを同じアクションに割り当てられます。

| プロパティ    | 型         | デフォルト                                     | 説明                                                                                                            |
| ------------- | ---------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `forward`     | `string[]` | `["KeyW"]`                                     | 前進。                                                                                                          |
| `backward`    | `string[]` | `["KeyS"]`                                     | 後退。                                                                                                          |
| `turnLeft`    | `string[]` | `["KeyA"]`                                     | 左旋回。                                                                                                        |
| `turnRight`   | `string[]` | `["KeyD"]`                                     | 右旋回。                                                                                                        |
| `ascend`      | `string[]` | `["ArrowUp", "Space"]`                         | 上昇。                                                                                                          |
| `descend`     | `string[]` | `["ArrowDown", "ControlLeft", "ControlRight"]` | 下降。                                                                                                          |
| `dash`        | `string[]` | `["ShiftLeft", "ShiftRight"]`                  | ホールド中にダッシュ。                                                                                          |
| `orbitCamera` | `string[]` | `["AltLeft", "AltRight"]`                      | ホールド中にフリーカメラ（TPV: オービット / FPV: フリールック）。離した後も移動キーを押すまで向きが保持される。 |
| `toggleView`  | `string[]` | `["KeyV"]`                                     | TPV / FPV の切り替え。                                                                                          |

## メソッド

### resolveStartHeight(source)

```typescript
resolveStartHeight(source: string | Source): Promise<number | undefined>
```

開始位置の地表高をソースの最詳細データから `ThreeView.sampleTerrainMostDetailed` でサンプリングし、`startHeight` をその高さに固定します。これにより [`start()`](#start) は、動的に解決した `startHeight` でキャラクターを地面に配置できます。`start()` の前に呼び出してください。

```typescript
// terrain は登録済みの quantized-mesh または raster-dem ソース
await personView.resolveStartHeight(terrain);
personView.start();
```

解決した高さは**最初の移動入力まで保持されます**（[`teleport()`](#teleportoptions) でも解除されます）。読み込み直後のタイルは粗く、そのまま追従するとキャラクターが数十メートル引きずられてしまうためです。最初の移動キーで、高度は通常の[地形追従](#歩いている最中に読み込まれる地形)へ引き継がれます。

返り値は使用された高さで、collision optionの `groundOffset` を含みます。開始位置にソースのデータがない場合は `undefined` になり、設定済みの `startHeight` が維持されます。

### start()

```typescript
start(): void
```

GLTF モデルをロードし（設定されている場合）、カメラを引き継いで移動キーの読み取りを開始します。`view.init()` の完了**後**に呼び出してください。[`stop()`](#stop) のあとに再度呼ぶと、設定された開始位置ではなく、停止した地点から再開します。

### stop()

```typescript
stop(): void
```

`start()` と対になるメソッドです。カメラを ThreeView 本来の操作に戻し、移動キーの読み取りを停止します。キャラクターはその場に留まります。全体を見渡す俯瞰、カットシーン、UI モードなど、一時的にパーソンビューから抜けたいときに使い、`start()` で操作を取り戻します。

```typescript
overviewButton.addEventListener("click", () => {
  personView.stop();
  view.setCamera({ lng, lat, height: 20000, distance: 0, heading: 0, pitch: -Math.PI / 2, roll: 0 });
});
resumeButton.addEventListener("click", () => personView.start());
```

プラグインを完全に破棄する場合は [`dispose()`](#dispose) を使用してください。

### teleport(options)

```typescript
teleport(options: {
  lng: number;
  lat: number;
  alt: number;
  heading?: number;
}): void
```

新しい地理的位置に瞬時に移動させます。`heading` を省略した場合、現在のカメラ方位が維持されます。[地形コリジョン](#地形コリジョン) が有効な場合、移動先の地形にその場で着地します（追従の上限がテレポートを遅らせることはありません）。移動せずにその場で向きだけを変える場合は [`setHeading()`](#setheadingradians--getheading) を、カメラのピッチを変える場合は [`setCameraPitch()` / `setFpvPitch()`](#setcamerapitchradians--setfpvpitchradians) を使用してください。

| フィールド | 型                    | 説明                                               |
| ---------- | --------------------- | -------------------------------------------------- |
| `lng`      | `number`              | 経度（度）。                                       |
| `lat`      | `number`              | 緯度（度）。                                       |
| `alt`      | `number`              | 高度（メートル）。                                 |
| `heading`  | `number \| undefined` | 方位（ラジアン、0 = 北、時計回りに増加、省略可）。 |

### setHeading(radians) / getHeading()

```typescript
setHeading(radians: number): void
getHeading(): number
```

キャラクターを指定した方位（ラジアン、0 = 北、時計回りに増加）に**位置を変えずに**回転させます。チェイスカメラは追従してスナップし、フリーカメラモードではモデルのみが回転します。`getHeading()` は現在の方位を返します。

### setCameraPitch(radians) / setFpvPitch(radians)

```typescript
setCameraPitch(radians: number): void
getCameraPitch(): number
setFpvPitch(radians: number): void
getFpvPitch(): number
```

カメラの下向きピッチ（ラジアン）を設定し、チェイス／固定カメラに即座に反映します。`setCameraPitch` は **TPV** のピッチ（カメラをモデルの上方へ回り込ませる）を、`setFpvPitch` は **FPV** のピッチ（その場で視線を下に傾ける）を制御します。対応するゲッターは現在の値を返します。

### setFpvHeightOffset(meters) / getFpvHeightOffset()

```typescript
setFpvHeightOffset(meters: number): void
getFpvHeightOffset(): number
```

アイレベルの高さオフセット（メートル）を設定し、チェイス／固定カメラに即座に反映します。これは FPV での目線の高さであり、TPV ではカメラが回り込んで注視する共有アイレベル高さでもあります。`getFpvHeightOffset()` は現在の値を返します。

### setAnimationSpeed(speed) / getAnimationSpeed()

```typescript
setAnimationSpeed(speed: number): void
getAnimationSpeed(): number
```

アニメーションの**基準**再生速度を設定します。これは [`AnimationConfig`](#animationconfig) のクリップ別上書き（`idleSpeed` / `walkSpeed` / `dashSpeed`）が無いクリップに使われるフォールバック値です。即座に反映され、再生中のクリップにも再適用されます。`getAnimationSpeed()` は現在の基準速度を返します。

クリップ別速度を使うと、idle・walk・dash のアニメーションをそれぞれ独立した速度で再生できます（例: ゆったりした idle と軽快な run）。上書きの無いクリップは `speed` が使われます。

```typescript
const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/Fox/Fox.glb",
    animation: {
      idleClip: "Survey",
      walkClip: "Walk",
      dashClip: "Run",
      speed: 1,
      idleSpeed: 0.6, // ゆったりした idle
      dashSpeed: 1.8, // ダッシュ中は速い run サイクル
      crossfadeDuration: 0.3,
    },
  },
  // ...
});
```

### model（getter）

ロード済みキャラクターモデルのメッシュハンドルを返します。[`start()`](#start) がモデルをロードするまで（またはキャラクター未設定の場合）は `null` です。ハンドルの `ref` が `GLTFModelDesc` で、これを通じてモデル本体にアクセスします。例えば `model.ref.raw` で内部の three.js オブジェクト、`model.ref.getWorldPosition()` で現在位置を取得できます。

### setViewMode(mode) / toggleViewMode()

```typescript
setViewMode(mode: "tpv" | "fpv"): void
toggleViewMode(): void
```

カメラを三人称視点と一人称視点で切り替えます。

### setAllowCameraControl(value)

```typescript
setAllowCameraControl(value: boolean): void
```

常時フリーカメラを実行時に有効化／無効化します。Alt 押下中のオービット挙動はこれとは独立して常に有効です。

### setCollision(collision) / getCollision()

```typescript
setCollision(collision: CollisionConfig): void
getCollision(): Readonly<Required<CollisionConfig>>
```

地形コリジョンの設定を実行時に更新します。指定したフィールドだけが変更されるため、`setCollision({ mode: "ground" })` は追従速度や斜面の設定をそのままに保ちます。`getCollision()` は解決済みの設定を返します。

### getState()

```typescript
getState(): PersonViewState
```

現在の視点状態を返します。

### onStateChange(fn)

```typescript
onStateChange(fn: (state: PersonViewState) => void): () => void
```

毎アニメーションフレームで発行される状態更新を購読します。購読解除関数を返します。

### onAction(fn)

```typescript
onAction(fn: (action: PersonViewAction) => void): () => void
```

操作入力イベントを購読します。バインドされた操作（移動・ダッシュ・視点切替・オービット）のキーが押されるたびに 1 回発火します。例えば、ユーザーがキャラクターを操作し始めた瞬間に操作説明の表示を隠す、といった用途に便利です。購読解除関数を返します。

`PersonViewAction` は `"forward" | "backward" | "turnLeft" | "turnRight" | "ascend" | "descend" | "dash" | "orbitCamera" | "toggleView"` のいずれかです。

### dispose()

```typescript
dispose(): void
```

アニメーションループを停止し、キーボードリスナーを削除し、キャラクターが設定されている場合は削除します。

## PersonViewState

`onStateChange()` で発行される状態オブジェクト：

| プロパティ       | 型               | 説明                                                                                      |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `lng`            | `number`         | 現在の経度（度）。                                                                        |
| `lat`            | `number`         | 現在の緯度（度）。                                                                        |
| `alt`            | `number`         | 現在の高度（メートル）。                                                                  |
| `heading`        | `number`         | 現在の方位（ラジアン、0 = 北、時計回りに増加）。                                          |
| `speed`          | `number`         | 設定された移動速度（m/s。`moveSpeed`。ダッシュ中は `dashSpeedMultiplier` 倍・既定 2.5）。 |
| `animationState` | `string \| null` | 現在再生中のクリップ名。キャラクター未設定の場合は `null`。                               |
| `mode`           | `"tpv" \| "fpv"` | 現在の視点モード。                                                                        |

## 関連リソース

- [Interior Explore チュートリアル](../../three/tutorial/interior-explore/): 3D Tiles 建物内で `PersonViewPlugin` を使う手順
- [OverlayPlugin](../overlayplugin/): `PersonViewPlugin` と組み合わせてワールド空間の HTML オーバーレイを実現
- [About three_plugins](../about/): パッケージ概要
