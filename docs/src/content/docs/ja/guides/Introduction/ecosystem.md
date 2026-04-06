---
title: Ecosystem
description: A guide in my new Starlight docs site.
sidebar:
  order: 2
---

## navara Ecosystem Overview

- Navara は GIS エンジン（地図のロジック）とレンダリングエンジン（描画）を分離することで、以下を可能にしています：

  - 多様な表現を実現できる
  - レンダリングエンジンに最適化した処理ができる
  - 複数の描画ライブラリと柔軟に統合できる
  - プラットフォームに依存しない再利用性の高い構成がとれる

## 構造

![architecture](@assets/architecture.png)

### GISエンジン

- navara_wasm

  - JS と Rust 間のやりとりを管理（データ変換・非同期通信など）

- navara_ecs（メインループ）

  - 世界の状態（エンティティ、カメラ、タイルなど）を更新
  - 毎フレームの更新、入力イベント処理、描画命令を発行

- GIS処理モジュール
  - 座標変換、地物のジオメトリ計算、スタイル適用などを実行

### レンダリングエンジン

- ライブラリ（navara_three等）

  - UI からの操作を WASM 層へ中継
  - 状態取得やレイヤー追加などを JavaScript から扱うための窓口

- API ライブラリ（navara_three_api等）

  - GIS処理モジュールを独立したAPIとして公開
  - 座標変換、楕円体幾何計算のようなGIS固有の複雑な処理を独立して実行

- レンダリングエンジン（Three.js など）
  - GPU と連携し、地図や 3D オブジェクトを描画
