//! Core Components and Data Structures for Cesium 3D Tiles
//!
//! This module defines the core components used throughout the 3D Tiles system.
//! These components represent the runtime state of tiles and are managed by
//! the traversal systems.
//!
//! # Component Hierarchy
//!
//! ```text
//! Cesium3dTilesLayer (layer definition)
//!     ↓
//! Cesium3dTilesTree (root tile tree, attached to entity)
//!     └── Cesium3dTileContent (recursive tile state, stored in tree)
//!         ├── data_requester_id → DataRequester entity
//!         └── rendered_tile_id → RenderedCesium3dTileContent entity
//!                                     └── feature_id → Model entity
//! ```
//!
//! # Key Concepts
//!
//! - **Tree vs Content**: `Cesium3dTilesTree` is an ECS component, while
//!   `Cesium3dTileContent` is a regular struct stored within the tree.
//!
//! - **Entity References**: Tiles store `Entity` IDs to reference related
//!   entities (data requesters, rendered tiles, features).
//!
//! - **State Management**: `Cesium3dTileContentState` tracks traversal state
//!   that changes every frame (visibility, SSE, loading status).

use bevy_ecs::{component::Component, entity::Entity, system::Query};
use navara_core::{Aabb, Extent, LngLat};
use navara_data_requester::DataRequesterExtension;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_layer::Cesium3dTilesLayer;
use navara_material::Appearance;
use navara_math::{FloatType, Mat4, Transform, Vec3};
use navara_parser::cesium3dtiles::{self, tileset::Refine};
use std::{cmp::Ordering, collections::HashMap};
use url::{ParseError, Url};

use crate::TileOrderByDistance;

/// Type alias for tile metadata from the tileset.json.
///
/// This is the static metadata that doesn't change at runtime.
pub type Cesium3dTileContentMetadata = navara_parser::cesium3dtiles::tileset::Tile;

/// Parsed tileset.json metadata.
///
/// Stores the complete parsed tileset.json file, including geometric error,
/// asset info, and the root tile definition.
#[derive(Debug, Component)]
pub struct Cesium3dTilesMetadata(pub navara_parser::cesium3dtiles::tileset::Tileset);

/// The root of a 3D Tiles tree structure.
///
/// This component is attached to entities that represent tile trees.
/// There can be multiple trees per layer (when using external tilesets).
#[derive(Debug, Component)]
pub struct Cesium3dTilesTree {
    /// Entity ID of the parent [`Cesium3dTilesLayer`]
    pub layer_id: Entity,
    /// Base URL for resolving relative content URLs
    pub base_url: Url,
    /// The root tile content (contains the full tree recursively)
    pub root: Cesium3dTileContent,
    /// Maximum screen-space error threshold for LOD selection
    pub max_sse: f32,
    /// Maximum number of tiles to render (soft limit)
    pub max_num_rendered_tiles: u32,
    /// Current count of rendered tiles
    pub num_rendered_tiles: u32,
    /// Whether this tileset is 3D Tiles version 1.1.
    pub is_v1_1: bool,
    /// Schema from tileset.json for resolving property types in EXT_structural_metadata.
    /// In 3D Tiles 1.1, the schema is typically defined at the tileset level,
    /// not embedded in each tile's glTF.
    pub schema: Option<serde_json::Value>,
}

impl Cesium3dTilesTree {
    pub fn new(
        url: &str,
        layer_id: Entity,
        layer: &Cesium3dTilesLayer,
        metadata: &navara_parser::cesium3dtiles::tileset::Tileset,
    ) -> Result<Self, ParseError> {
        let base_url = Url::parse(url)?;
        let root = Cesium3dTileContent::new(&metadata.root, None);

        let appearance = layer
            .appearances
            .iter()
            .find(|a| matches!(a, Appearance::Model(_)));
        let max_sse = match appearance {
            Some(Appearance::Model(m)) => m.max_sse,
            _ => 2.,
        };

        let is_v1_1 = metadata.asset.version == "1.1";

        let schema = metadata
            .schema
            .as_ref()
            .and_then(|s| serde_json::to_value(s).ok());

        Ok(Self {
            layer_id,
            base_url,
            root,
            max_sse,
            max_num_rendered_tiles: 100,
            num_rendered_tiles: 0,
            is_v1_1,
            schema,
        })
    }
}

/// Runtime state for a single tile in the hierarchy.
///
/// This struct is stored recursively within [`Cesium3dTilesTree`] and represents
/// the mutable runtime state of a tile. It's not an ECS component itself.
///
/// # Content Types
///
/// - **Renderable content** (`is_renderable_content = true`): B3DM, PNTS, GLB files
/// - **Non-renderable content** (`is_renderable_content = false`): Nested tileset.json
///
/// # Memory Management
///
/// The `children` vector is allocated lazily and cleared when the tile goes
/// out of view. This prevents memory accumulation for deep tile hierarchies.
#[derive(Debug)]
pub struct Cesium3dTileContent {
    /// Relative URL to tile content (may be a path, not full URL).
    pub uri: Option<String>,
    /// Entity with [`DataRequester`] for this tile's content.
    pub data_requester_id: Option<Entity>,
    /// For nested tilesets: parent tile's data requester ID.
    pub parent_data_requester_id: Option<Entity>,
    /// Entity with [`RenderedCesium3dTileContent`] when tile is rendered.
    pub rendered_tile_id: Option<Entity>,
    /// Child tiles (lazily allocated, cleared when out of view).
    pub children: Option<Vec<Cesium3dTileContent>>,
    /// Refinement strategy (REPLACE or ADD).
    pub refine: Refine,
    /// True for B3DM/PNTS/GLB, false for nested tileset.json.
    pub is_renderable_content: bool,
    /// Axis-aligned bounding box for frustum culling.
    pub bounding_volume: Option<Aabb>,
    /// Tile transform (inherited from parent if identity).
    pub transform: Option<Transform>,
    /// Per-frame traversal state.
    pub state: Cesium3dTileContentState,
}

impl Cesium3dTileContent {
    pub fn new(tile: &cesium3dtiles::tileset::Tile, parent: Option<&Self>) -> Self {
        let (uri, is_renderable_content) = match &tile.content {
            Some(content) => {
                let uri = content
                    .uri
                    .clone()
                    .unwrap_or_else(|| content.url.clone().unwrap());
                (
                    Some(uri.clone()),
                    (!uri.contains(".json")) && (!uri.is_empty()),
                )
            }
            None => (None, false),
        };

        let mut tile_transform = Transform::from_matrix(Mat4::from_cols_array(
            &tile.transform.map(|v| v as FloatType),
        ));
        if tile_transform == Transform::IDENTITY {
            tile_transform = parent
                .and_then(|p| p.transform)
                .unwrap_or(Transform::IDENTITY);
        }
        let bv = &tile.bounding_volume;
        let bounding_volume = match (bv.region, bv.sphere, bv.box_) {
            (Some([west, south, east, north, min_height, max_height]), _, _) => {
                Some(Aabb::from_extent_f64(
                    Extent::from_points(&[
                        LngLat::new(south as FloatType, west as FloatType),
                        LngLat::new(north as FloatType, east as FloatType),
                    ]),
                    min_height as FloatType,
                    max_height as FloatType,
                ))
            }
            // TODO: Support making bounding volume from the sphere
            (_, Some(_), _) => None,
            (
                _,
                _,
                Some(
                    [
                        cx,
                        cy,
                        cz,
                        xdir0,
                        xdir1,
                        xdir2,
                        ydir0,
                        ydir1,
                        ydir2,
                        zdir0,
                        zdir1,
                        zdir2,
                    ],
                ),
            ) => {
                // Transform the bounding volume
                let center = Vec3::new(cx as FloatType, cy as FloatType, cz as FloatType);
                let x_axis = Vec3::new(xdir0 as FloatType, xdir1 as FloatType, xdir2 as FloatType);
                let y_axis = Vec3::new(ydir0 as FloatType, ydir1 as FloatType, ydir2 as FloatType);
                let z_axis = Vec3::new(zdir0 as FloatType, zdir1 as FloatType, zdir2 as FloatType);

                let center_transformed = tile_transform.transform_point(center);

                let x_transformed = tile_transform.transform_vector(x_axis);
                let y_transformed = tile_transform.transform_vector(y_axis);
                let z_transformed = tile_transform.transform_vector(z_axis);

                let extents = Vec3::new(
                    x_transformed.x.abs() + y_transformed.x.abs() + z_transformed.x.abs(),
                    x_transformed.y.abs() + y_transformed.y.abs() + z_transformed.y.abs(),
                    x_transformed.z.abs() + y_transformed.z.abs() + z_transformed.z.abs(),
                );

                Some(Aabb {
                    center: center_transformed,
                    extents,
                })
            }
            _ => None,
        };
        let default_refine = Refine::Replace;
        Self {
            uri,
            data_requester_id: None,
            parent_data_requester_id: None,
            rendered_tile_id: None,
            children: None,
            is_renderable_content,
            bounding_volume,
            refine: match tile
                .refine
                .as_ref()
                .unwrap_or(parent.map_or(&default_refine, |p| &p.refine))
            {
                Refine::Replace => Refine::Replace,
                Refine::Add => Refine::Add,
            },
            transform: Some(tile_transform),
            state: Cesium3dTileContentState::default(),
        }
    }

    pub fn make_content_url(
        &self,
        base_url: &Url,
    ) -> Result<(String, DataRequesterExtension), ParseError> {
        let mut url = base_url.join(self.uri.as_ref().unwrap())?;
        let base_query = base_url.query_pairs().into_owned();
        let new_query: HashMap<String, String> = url.query_pairs().into_owned().collect();
        for (key, value) in base_query {
            if new_query.contains_key(&key) {
                continue;
            }
            url.query_pairs_mut()
                .append_pair(key.as_ref(), value.as_ref());
        }
        let extension = DataRequesterExtension::from_url(&url);
        Ok((url.to_string(), extension))
    }

    pub fn reset_state(&mut self) {
        self.state.reset();
    }

    pub fn is_rendered(
        &self,
        rendered_tiles: &mut Query<&mut RenderedCesium3dTileContent>,
        features: &Query<&FeatureId>,
        renderable_features: &Query<&RenderableFeature>,
    ) -> bool {
        let Some(renderable_feature) = self
            .rendered_tile_id
            .and_then(|e| rendered_tiles.get(e).ok().and_then(|t| t.feature_id))
            .and_then(|feature_id| features.get(feature_id).ok().and_then(|f| f.0))
            .and_then(|renderable_feature_id| renderable_features.get(renderable_feature_id).ok())
        else {
            return false;
        };

        matches!(renderable_feature, RenderableFeature::Model { render_info, .. } if render_info.is_rendered)
    }
}

/// Per-frame traversal state for a tile.
///
/// This state is reset at the beginning of each traversal and updated
/// during the [`mark_leaves`](super::traversal::mark_leaves) phase.
/// It's used by [`mark_rendered_tiles`](super::traversal::mark_rendered_tiles)
/// to determine what actions to take for each tile.
#[derive(Debug, Default)]
pub struct Cesium3dTileContentState {
    /// True if this tile is a leaf (should be rendered).
    pub leaf: bool,
    /// Whether the tile was touched in the previous frame.
    pub touched_last_frame: bool,
    /// Whether the tile is within camera frustum.
    pub is_visible: bool,
    /// Whether to preload this culled tile for smooth transitions.
    pub should_preload: bool,
    /// Marked for removal (nested tileset cleanup).
    pub removed: bool,
    /// Whether this content was touched while traversing.
    pub touched: bool,
    /// Whether tile data has been successfully loaded.
    pub is_data_loaded: bool,
    /// Whether this tile was rendered in the previous frame.
    pub is_rendered_last_frame: bool,
    /// For REPLACE refinement: true when all children are loaded.
    pub are_all_children_loaded: bool,
    /// Distance from camera to tile bounding volume.
    pub distance_from_camera: f32,
    /// Calculated screen-space error for this tile.
    pub sse: f32,
}

impl Cesium3dTileContentState {
    fn reset(&mut self) {
        self.leaf = false;
        self.removed = false;
        self.is_visible = false;
        self.should_preload = false;
        self.touched = false;
        self.is_data_loaded = false;
        self.are_all_children_loaded = false;
        self.distance_from_camera = 0.;
        self.sse = 0.;
    }
}

/// Represents a tile that is currently being rendered.
///
/// This component is spawned on an entity when a tile becomes visible.
/// It's paired with a format-specific marker component:
/// - [`RenderedCesium3dTileContentB3dmMarker`]
/// - [`RenderedCesium3dTileContentPntsMarker`]
/// - [`RenderedCesium3dTileContentGlbMarker`]
///
/// # Lifecycle
///
/// 1. Spawned by [`update_or_spawn_rendered_tile`](super::traversal)
/// 2. Triggers `construct_model_by_cesium3dtiles_layer` via `Added` query
/// 3. `feature_id` is set when model entity is created
/// 4. Visibility toggled based on traversal results
/// 5. Despawned by `remove_invisible_rendered_tiles` when no longer needed
#[derive(Component)]
pub struct RenderedCesium3dTileContent {
    /// Parent layer entity.
    pub layer_id: Entity,
    /// Entity with model components (set after construction).
    pub feature_id: Option<Entity>,
    /// Entity with DataRequester containing tile data.
    pub data_requester_id: Entity,
    /// Whether the tile should be visible in the scene.
    pub is_visible: bool,
    /// Whether the tile was touched during traversal (for REPLACE refinement).
    pub touched: bool,
}

/// Transform component for tile content.
///
/// Stores the tile's transformation matrix from tileset.json.
/// Used primarily for PNTS (point cloud) tiles.
#[derive(Component)]
pub struct TileTransform {
    pub transform: Transform,
}

/// Priority ordering for tile trees and requests.
///
/// Used to:
/// 1. Identify nested tilesets (index > 0)
/// 2. Sort trees during traversal (closer/higher SSE = higher priority)
/// 3. Prioritize data requests
#[derive(Component, PartialEq, Debug, Clone)]
pub struct Cesium3dTilesTreeOrder {
    /// Tree nesting level. 0 = root tileset, >0 = nested tileset.
    pub index: usize,
    /// Distance-based ordering for request prioritization.
    pub distance: TileOrderByDistance,
}

impl PartialOrd for Cesium3dTilesTreeOrder {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Cesium3dTilesTreeOrder {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.index < other.index {
            return Ordering::Less;
        }
        if self.index > other.index {
            return Ordering::Greater;
        }
        if self.distance < other.distance {
            return Ordering::Less;
        }
        if self.distance > other.distance {
            return Ordering::Greater;
        }
        Ordering::Equal
    }
}

impl Eq for Cesium3dTilesTreeOrder {}

#[cfg(test)]
mod tests_cesium3dtiles_tree_order {
    use super::Cesium3dTilesTreeOrder;
    use crate::TileOrderByDistance;

    #[test]
    fn sorts_by_index_first_then_distance() {
        // index has highest priority: lower index should come first regardless of distance
        let mut items = [
            Cesium3dTilesTreeOrder {
                index: 2,
                distance: TileOrderByDistance {
                    sse: 10.0,
                    distance_from_camera: 0.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 0.0,
                    distance_from_camera: 999.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 1,
                distance: TileOrderByDistance {
                    sse: 100.0,
                    distance_from_camera: 0.0,
                },
            },
        ];

        items.sort();

        assert_eq!(items[0].index, 0);
        assert_eq!(items[1].index, 1);
        assert_eq!(items[2].index, 2);
    }

    #[test]
    fn sorts_by_sse_desc_then_distance_asc_when_index_equal() {
        let mut items = [
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 3.0,
                    distance_from_camera: 5.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 2.0,
                    distance_from_camera: 1.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 3.0,
                    distance_from_camera: 2.0,
                },
            },
        ];

        items.sort();

        // Expect highest SSE first; for equal SSE, nearer (smaller distance) first
        let expects = [
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 3.0,
                    distance_from_camera: 2.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 3.0,
                    distance_from_camera: 5.0,
                },
            },
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: TileOrderByDistance {
                    sse: 2.0,
                    distance_from_camera: 1.0,
                },
            },
        ];

        for (i, result) in items.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }

    #[test]
    fn equality_when_index_and_distance_equal() {
        let a = Cesium3dTilesTreeOrder {
            index: 1,
            distance: TileOrderByDistance {
                sse: 1.5,
                distance_from_camera: 42.0,
            },
        };
        let b = a.clone();

        assert_eq!(a, b);
        assert_eq!(a.partial_cmp(&b), Some(std::cmp::Ordering::Equal));
        assert_eq!(a.cmp(&b), std::cmp::Ordering::Equal);
    }
}
