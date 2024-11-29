# Navara Quadtree

This is an implementation of a quadtree.  

## What is Quadtree

A quadtree is a tree data structure for two-dimensional space. This is used to manage a LOD(Leve Of Detail) to render a mesh efficiently.  
For example, rendering a lot of tile and terrain is heavy task, so you need to select which tile or terrain should be rendered in the current scene. To do it, you can traverse the tile from root to a selected tile efficiently by this data structure.

## How it work

You can initialize the quadtree as below.

```rust
use navara_quadtree::Quadtree;

#[derive(Debug)]
struct Tile { x: u32, y: u32, z: u32 }

let qt: Quadtree<u32, Tile> = Quadtree::new_with_linear_qt();
```

Then you can create children. In this case, they're children of the root coordinates.

```rust
use navara_quadtree::Quadtree;

#[derive(Debug)]
struct Tile { x: u32, y: u32, z: u32 }

let mut qt: Quadtree<u32, Tile> = Quadtree::new_with_linear_qt();
let root = (0, 0, 0);
let children =
    qt.qt.initialize_children(root, &|(x, y, z)| Tile { x, y, z });
```
