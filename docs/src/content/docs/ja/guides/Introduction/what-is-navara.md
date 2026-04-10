---
title: What is navara?
description: A guide in my new Starlight docs site.
sidebar:
  order: 1
---

## What is navara?

- Navara は、次世代 WebGIS の基盤技術として、ヘッドレス設計と Rust/WASM を軸に、パフォーマンス・拡張性・多様な表現力を兼ね備えた地図エンジンです。

## Key Features

### 地図描画と可視化

- MVT、GeoJSON、3D Tiles、Raster などの形式に対応
- レイヤー合成、視野制御、LOD 表現が可能
- 高度なマテリアル・エフェクトのカスタマイズが可能

### 3D 空間表現とアニメーション

- 3D 表現と動的エフェクト
- 地形、建物、オブジェクトの描画
- 飛行・移動・アニメーション表示の対応

### GIS 空間処理

- 座標変換（地理座標系 → 直交座標系）
- 空間インデックス（四分木）、視野・水平方向カリング
- 高速なタイルデータ管理とレイヤー制御

## Architecture

- アーキテクチャの全体像。詳細は Ecosystem へ

- アプリケーション層

  - Three.js や Babylon.js などの描画ライブラリ（例：navara_three）と連携

- WASM バインディング層

  - WASM を介して Rust の GIS エンジンと通信（navara_wasm）

- Rust GISエンジン

  - Bevy ECSによる状態管理とGIS 処理（座標変換・LOD・タイル管理）

- レンダリングエンジン
  - Three.jsなどを通して、GPUへ描画命令

## Use Cases

- あれば（まだない）
