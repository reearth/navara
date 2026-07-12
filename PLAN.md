# メモリ管理改善プロポーザル: LODタイルのバジェット制退避とピーク削減

## 背景と問題

LOD処理を伴うレイヤー（3D Tiles / vector tiles / raster tiles / terrain）は、親子のシームレスな切り替えのために「親タイルを全てレンダリング・キャッシュしてから子へ進む」戦略をとっている。この戦略自体は必要だが、以下の問題を引き起こしている:

- メモリ使用量の単調増加
- リクエスト制限（fetch背圧、MAX_PENDINGS）をしてもなお、大量リクエストによるピークメモリの増大
- FPS低下
- モバイル等の低容量端末でのクラッシュ

本ドキュメントは根本原因の分析と、優先順位付きの解決策を提案する。

---

## 1. 根本原因分析（影響の大きい順）

### RC1: メモリバジェットがどこにも存在しない
- Rust `BufferStore`（`crates/navara_buffer_store/src/store.rs`）は `FxHashMap<Handle, Buffer>` で、**サイズ会計ゼロ・上限なし**。「今800MB使っているから止める/捨てる」という判断が構造的に不可能。
- JS側も同様: TileTextureCache（composite atlas ~3MB GPU/tile desktop）、`loadedTexs`（rasterテクスチャ 256KB–1MB）、vector RT（最大5MB/tile）— 全て refcount/イベント駆動で、総量の天井がない。
- `max_num_rendered_tiles`（`crates/navara_cesium3dtiles/src/cesium3dtiles/component.rs:70`、デフォルト100）はフィールドが存在するだけで**未執行のデッドコード**。
- 帰結: **全コストが生存タイル数に線形**。広角ビュー・深いズーム・複数レイヤーで際限なく増える。他の全根本原因はバジェット不在によって増幅される。

### RC2: descent時に中間LODを全段ロードする
- SSE不合格（=もっと細かいタイルが必要）のタイルも、子に降りる前に `prepare_tile` される（`crates/navara_vector_tile/src/tile/traverse.rs:181-192`。terrain/raster/3D Tilesも同型。3D Tiles REPLACE refinement は `traversal.rs:375-381` で全子ロード完了まで親保持）。
- z4→z16 のズームで**約12段の中間ピラミッドを全てフェッチ・デコード・メッシュ化・GPUアップロード**する。寿命数秒のデータのために。
- これが**ピークメモリとリクエストバーストの支配要因**。定常状態のワーキングセットとは独立に発生する。

### RC3: WASMリニアメモリのラチェット効果
- WASMヒープは一度成長すると縮まないため、**RC2の一時的バーストがプロセスの恒久的なRSSフロアになる**。
- メインスレッドのWASMインスタンスは永続（workerプールは128タスク/5秒アイドルでリサイクル済みだが、メイン側は不可能）。
- 帰結: Rust側では**定常削減よりピーク削減の方が重要**（ピーク=恒久）。

### RC4: 即時despawnによる再フェッチスラッシング
- `clear_caches`（`crates/navara_vector_tile/src/tile/system.rs:296-402`、raster: `crates/navara_tile/src/raster/system.rs:185-216`）は「フレームで訪問されなかったタイル」を+1フレーム猶予で破棄する。
- パン往復・ズームアウト→インのたびに**全て再フェッチ・再デコード・再アップロード**。WASM再アロケーション（ラチェットの底上げ）、GPU再アップロード、デコードCPUを毎回燃やす — メモリピークとFPS両方の問題。
- 皮肉なことに現状は「**2秒後に必要なものは即捨てる**（積極的すぎ）」かつ「**可視セットが巨大でも上限なし**（緩すぎ）」の両面で誤っている。

### RC5: 3D Tilesのtouched保持が無制限
- `crates/navara_cesium3dtiles/src/cleanup_system.rs:57-84` は `touched` タイルを despawn せず visibility トグルで**無期限保持**する（:59-60 のTODOコメントが認識済み）。深いtilesetのREPLACE refinement中はancestorチェーン全体がジオメトリ・マテリアル込みで残り続ける。

### RC6: タイルあたり固定GPUコスト + バースト並列（P0でほぼ対処済み）
- lazy vector RT、fetch背圧、`texture.image=null` 等で軽減済み（atlas はデスクトップ・モバイルとも 512²、3 MRT で約3MB/タイル）。
- 残り: MAX_PENDINGS=50 がタイル種別ごと（terrain/raster/vector/3D Tiles）に独立しているため、デコード済みペイロードが最大100件超 BufferStore に同時滞留しうる。

---

## 2. 提案A: メモリバジェットLRU保持キャッシュ【P1・最優先】

ライフサイクルを「**非訪問 → destroy**」から「**非訪問 → 非アクティブ化して保持、予算超過時のみLRU退避**」へ転換する。RC1（ハードキャップ）・RC4（パン/ズームアウト戻りが再フェッチゼロで即時）・RC5（touched保持に上限）を同時に解決する。

### 2.1 台帳（ledger）はRust側に一本化

- 新リソース `MemoryLedger { budget_bytes, cpu_bytes, gpu_bytes_est, sse_multiplier }`（新クレート `navara_memory` または `navara_component` 内モジュール）。
- **CPUバイト（正確）**: `Buffer` に `byte_len()` を追加し、store.rs の全 `set_*`/`remove` で `total_bytes` を増減。実装は自明で、生ペイロード+デコード済み配列を正確にカバー。
- **GPUコスト（見積り）**: スポーン時に決定論的に計算できる — composite atlas: 3MB desktop / 0.75MB mobile（atlas寸法はオプション由来）、rasterテクスチャ: `w*h*4*1.33`、terrainメッシュ: `頂点数×stride + インデックス数×4`、vector RT: drapeパス確保時に5MBフラグ。`TileCost { cpu, gpu_est }` を各タイルキャッシュエントリ（`TileCacheManager.rendered_tile_caches` 等）にレンダリング時に付与。
- **Rustが決定しJSが実行する理由**: 退避判断に必要な情報（現在のrender set、祖先fallback関係、`visited_at`、SSE/距離順）はtraversalしか持たない。JS側の破棄は既に「Rustのremoveイベントに純粋に反応する」契約（TileTextureCache.release、`TextureFragmentRemoved`→loadedTexs削除）なので、**バジェットは「Rustがいつ決定するか」を変えるだけ**で既存契約を維持できる。v1ではJS→Rustのコスト報告APIは不要（後の精度改善で `report_tile_cost(handle, bytes)` を追加可能）。

### 2.2 保持の仕方（レイヤー別）

| レイヤー | 保持方法 |
|---|---|
| vector | `clear_caches` の despawn（system.rs:344-362）を `RenderableFeature.active = false`（**3D Tiles cleanupが既に使っている機構** cleanup_system.rs:75-82 の流用）+ `(tile_handle, visited_at, cost)` を保持LRUプールへ push に変更。エンティティ・quadtreeノード・TileTextureCache参照・BufferStoreエントリは全て生存 |
| terrain | 同型: メッシュエンティティを非表示にして保持。**保持価値が最も高い** — upsample源・高さクエリ源も兼ねる |
| raster | quadtreeノード+texture fragmentを保持。JS `loadedTexs` の破棄は `TextureFragmentRemoved` イベント駆動なので、Rust側のremoveを遅延させれば**JS側の破棄遅延は自動で付いてくる** |
| 3D Tiles | (a) untouchedタイル（cleanup_system.rs:86-106）も保持プールへ。(b) touched保持（:57-84）に**ようやく上限**: 保持中+touched非可視タイルを予算にカウントし、`max_num_rendered_tiles` も副次的な個数キャップとして執行 |

**「親を全準備してから子へ」との関係**: 変更なし — あのロジックは traversal 中の*アクティブ*セットに対して動く。保持は対称的な利点を追加する: **ズームアウト時（re-ascent）も親が常駐しているので子→親の切り替えが再フェッチゼロでシームレス**になる。保持された祖先は `ready_parent_tile_handle` の drape 源（traverse.rs:141-151）としても有効（traversalに保持プール参照を教えるのはオプションのフォローアップ）。

### 2.3 予算のソース

- JS `Options.cacheBytes?: number`（`web/navara_three/src/index.ts`、Cesiumの `Cesium3DTileset.cacheBytes` / 旧 `maximumMemoryUsage` の命名踏襲）→ WASM init 経由で `MemoryLedger` へ。
- デフォルト（`web/navara_three/src/device.ts`）: `navigator.deviceMemory`（Chrome、仕様上 [0.5, 8]GB クランプ）→ desktop `min(deviceMemory×1024/4, 512)MB`、mobileフラグ → **128–192MB**。Safari/Firefoxは deviceMemory 非対応 → mobileフラグヒューリスティックにフォールバック。
- v1はCPU+GPU見積りの合算1本（Cesiumと同じ、推論が単純）。CPU/GPU別サブ予算は後の改善。

### 2.4 退避順序と保護

新システム `enforce_memory_budget` を各レイヤーの `clear_caches` 後にスケジュール:

- **保護（絶対に退避しない）**: `visited_at == 現在フレーム` のタイル。traversalはtop-downなので、現在のリーフへのパス上の祖先も同フレームで訪問済み — **この単一チェックでrender setとfallback祖先の両方を守れる**。in-flight の DataManager リクエスト保持タイルも保護。
- **順序**: `visited_at` の古い順（LRU）、タイブレークは `OrderByDistance` 降順（遠い順）— `clear_caches` は既にこのコンポーネントでソートしており、3D Tiles には `TileOrderByDistance` がある。両方再利用。オプションで現在ズームからの段数ペナルティ。
- **ヒステリシス/スラッシング防止**: 超過時は予算ラインちょうどではなく **0.85×budget まで**退避。保持後 ~10フレーム未満のタイルは退避しない。予算境界での退避↔再フェッチ振動を防ぐ。

### 2.5 デグレードパス（可視セット単体で予算超過する場合）

Cesiumの `memoryAdjustedScreenSpaceError` パターン: `enforce_memory_budget` が保持プールを空にしてもまだ超過なら、`MemoryLedger.sse_multiplier` を上げる（超過フレームごとに×1.25、収まったら減衰）。traversalは `max_sse` 計算箇所（traverse.rs:157-161 と terrain/raster/3D Tiles の同型箇所）で読む。**LODがグローバルに粗くなり可視セットが予算に収まる — 低メモリモバイルのクラッシュ防止の最後の砦**。（提案C1と同一物。台帳を共有するのでAのフェーズ2として実装する。）

### 2.6 主要リスク

- **DataManagerハング**: 退避は必ず既存の despawn/`Deleted` コードパス経由で行い、`BufferStore::remove` を直接呼ばない。DataManagerエントリ（同一URL+range の refcount>0）が残ったままバッファを消すと、後続コンシューマが `reset_fetch_enqueued` なしで永久待ちになる既知の罠。**ルール: 退避 == 現行destroyパスそのもの（トリガーが予算になるだけ）**。
- **refcount整合**: 保持タイルはTileTextureCacheのacquireを保持し続ける。保持=エンティティ生存、退避=フルdestroyパスなので release は正確に1回。dev buildでrefcount整合assertを追加。
- **WASMラチェット**: CPUバイトの退避はOSにメモリを返さない — 成長の上限として効く（ピーク生存バイトを縛る=恒久フロアを縛る）。デフォルト予算のCPU側はこれを念頭に設定。
- **iOS SafariのGPU**: GPUメモリはWebKitプロセスに計上される。GPU見積りが甘いとモバイル予算が嘘になる。モバイルは保守的に開始。

---

## 3. 提案B: skip-LOD descent（中間LOD全段ロードの回避）【P2/P3】

**正直な評価: フルCesium式 `skipLevelOfDetail` はアーキテクチャ侵襲が大きい。** 「descent には親が renderable であること」「activation には兄弟全準備」「drape源チェーンは連続した祖先を仮定」という核心的不変条件と衝突し、4つのtraversal全ての `were_children_rendered`/activation 状態機械の改修 + 視覚アーティファクト対策（レベル混在の継ぎ目。Cesiumは3D Tilesでstencilトリックを使用）が必要 = 数週間級。

### 最小変種を先に: 高速ズーム時の中間 `prepare_tile` ゲート

負荷の中心は vector traverse.rs:181-192（と terrain/raster の同型箇所）の「SSE不合格でも `prepare_tile` する」1点。変更案:

- `zoom_delta = 目標ズーム − 最良利用可能祖先のズーム > N`（N≈3）**または**カメラズーム速度が大きいとき、中間タイルの `prepare_tile` をスキップして直接descend。
- 表示は**既存の** upscale/drape 機構で最良祖先を引き伸ばし: vector は `should_upscale`/`ready_parent_tile_handle`、raster は親テクスチャのfragment合成（overscaleが既にこの動き）、terrain は `upsample_terrain_mesh`（`crates/navara_worker/src/tasks/upsample_terrain_mesh/`）。
- カメラ静止後、最終レベルから delta≤N の中間は通常ロードされ視覚品質が回復。

### レイヤー別の実現性

| レイヤー | 難易度 | 備考 |
|---|---|---|
| raster | 低〜中 | 親テクスチャストレッチはoverscaleの既存動作。traversalゲートの追加が主。**リクエスト数の支配層なので効果大 — 最初にやる** |
| terrain | 中 | upsampleインフラ既存。遠い祖先から目標レベルのプレースホルダを作る形。幾何誤差・衝突判定の正しさに注意 |
| vector | 中 | drape系はfallbackでカバー。スタンドアロンvectorジオメトリにはupscaleパスがないので、当初はdrape/texturized源に限定 |
| 3D Tiles | 高 | REPLACE refinement（traversal.rs:375）に「最寄りロード済み祖先を表示したままk段下をフェッチ」するskipパスが必要。stencilマスクの代わりに一時的な親子オーバードローを許容すれば現実的だが、それでも最大の変更。**最後に** |

### 効果見積り

z4→z16 のfly-toは現在~12段に触れる。N=3のスキップで**遷移時のフェッチ/デコード/メッシュ量を約60–75%削減** — 単体で最大のピークメモリ・バースト削減策。ただし **A→Bの順が正しい**: Aの保持祖先はBが必要とする「最良利用可能祖先」そのものであり、Aの安全網なしにBを入れるのはリスクが高い。

---

## 4. 提案C: その他の施策

| # | 施策 | 効果 | 工数 |
|---|---|---|---|
| C1 | **メモリ圧力下の動的SSE** — §2.5のデグレードパス + `memoryProbe.ts`（`measureUserAgentSpecificMemory`/`performance.memory`）を外部圧力信号として併用 | 高（低スペックモバイルのクラッシュ防止） | 中（台帳があれば小） |
| C2 | **`max_num_rendered_tiles` の執行**（3D Tiles、component.rs:70 のデッドフィールド）— バイト台帳の前に出せる安価な代理予算 | 中 | 低 |
| C3 | **フレームあたり spawn/GPUアップロードスロットル** — 新規RenderedTile spawn / テクスチャアップロードを 4–8/frame に制限。優先度順（`OrderByDistance`）は既存 | 中（FPSスパイク+アロケバースト平滑化） | 低〜中 |
| C4 | **in-flight積極キャンセル** — 領域の目標ズームが1段超変化したら stale リクエストを即 `Deleted`（JSは `data_requester_removed` で既にabort） | 中 | 中（DataManager罠に注意） |
| C5 | **モバイルプリセット** — 予算デフォルト低め、MAX_PENDINGS 50→16、保持プール最小値低め（atlas はモバイルも 512²/約3MB のままなので予算側で吸収） | 中 | 低 |
| C6 | **消費後の生ペイロード解放の監査** — メッシュ/テクスチャ構築後に元のU8ペイロードがBufferStoreに残っていないか（Rust版 `texture.image=null`）。消費時に解放、稀な再デコードは再フェッチ | 中（CPUバイト） | 低〜中 |
| C7 | **台帳の計測統合** — BufferStoreバイト+保持数+memoryProbe読み値をstatsオーバーレイに。**Aのチューニングの前提**であり、将来のリグレッションを可視化 | 前提条件 | 低 |

---

## 5. 優先順位付きロードマップ

**P0（完了済み）**: fetch背圧（decode並列×4、`Options.maxConcurrentFetches`）、リーク修正（objectURL/ImageBitmap/three.js Cache/watermask）、lazy vector RT、texture fragment fetchゲート、`texture.image=null`、workerヒープリサイクル（atlas はデスクトップ・モバイルとも 512²/約3MB）。→ リークと一部ピークには効いたが、**RC1/RC2/RC4 には未対処**。

1. **P1a — 計測（C7 + BufferStoreバイト会計）**: 数日規模。見えない予算は調整できない。根本原因の順位を実数で確認する意味もある。
2. **P1b — 提案Aコア**: `MemoryLedger` + vector/terrain/raster の保持LRU + 3D Tiles 保持プール&`max_num_rendered_tiles`執行（C2込み） + ヒステリシス + `Options.cacheBytes` とデバイス別デフォルト（C5のデフォルト込み）。**最高レバレッジ**: 定常をキャップ（RC1/RC5）、再フェッチスラッシング解消（RC4）、Bの下地。
3. **P2 — C1動的SSEデグレードパス**（台帳への小さな差分、モバイルクラッシュの砦）+ **C3スロットル** + **最小B**（高速ズーム時の `prepare_tile` ゲート、rasterから→terrain）。RC2/RC3 のピークを攻める。
4. **P3 — フルskip-LOD**（vector/3D Tiles、B完成）+ **C4キャンセル** + **C6ペイロード解放**。最高複雑度。Aの安全網と計測で効果を証明しながら。

**A→Bの根拠**: Aは低リスク（既存destroyパスとJS破棄イベントを完全再利用）でクラッシュ防止の安全網を先に提供し、Bの「最良利用可能祖先を表示」要件はAの保持キャッシュがそのまま満たす。

---

## 主要ファイル参照

| ファイル | 役割 |
|---|---|
| `crates/navara_buffer_store/src/store.rs` | バイト会計の追加箇所 |
| `crates/navara_vector_tile/src/tile/system.rs` (`clear_caches` :296-402) | 「保持へ転換」のパターン元（terrain/rasterへ横展開） |
| `crates/navara_vector_tile/src/tile/traverse.rs` | SSE乗数フック（:157-161）、中間 `prepare_tile` ゲート（:181-192）、drape源フォールバック（:141-151） |
| `crates/navara_tile/src/tile/system.rs` / `raster/system.rs` | terrain/raster の退避箇所 |
| `crates/navara_cesium3dtiles/src/cleanup_system.rs` | touched上限 + 保持プール（3D Tiles） |
| `crates/navara_data_requester/src/data_manager.rs` | refcount/`reset_fetch_enqueued` 罠 |
| `web/navara_three/src/index.ts` / `device.ts` | `Options.cacheBytes` + デバイス別デフォルト |
| `web/navara_three/src/tileTexture/TileTextureCache.ts` | refcount整合assert |
| `web/navara_three/example/helpers/memoryProbe.ts` | 計測（C7）の土台 |
