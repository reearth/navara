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

pub type Cesium3dTileContentMetadata = navara_parser::cesium3dtiles::tileset::Tile;

#[derive(Debug, Component)]
pub struct Cesium3dTilesMetadata(pub navara_parser::cesium3dtiles::tileset::Tileset);

#[derive(Debug, Component)]
pub struct Cesium3dTilesTree {
    pub layer_id: Entity,
    pub base_url: Url,
    pub root: Cesium3dTileContent,
    pub max_sse: f32,
    pub max_num_rendered_tiles: u32,
    pub num_rendered_tiles: u32,
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

        Ok(Self {
            layer_id,
            base_url,
            root,
            max_sse,
            max_num_rendered_tiles: 100,
            num_rendered_tiles: 0,
        })
    }
}

/// This is a state related to metadata.
#[derive(Debug)]
pub struct Cesium3dTileContent {
    // This URI might be just path, so keep using string.
    pub uri: Option<String>,
    pub data_requester_id: Option<Entity>,
    pub rendered_tile_id: Option<Entity>,
    pub children: Option<Vec<Cesium3dTileContent>>,
    pub refine: Refine,
    // If the content's URI isn't a model file, it's false.
    pub is_renderable_content: bool,
    pub bounding_volume: Option<Aabb>,
    pub transform: Option<Transform>,
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
                Some([cx, cy, cz, xdir0, xdir1, xdir2, ydir0, ydir1, ydir2, zdir0, zdir1, zdir2]),
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

#[derive(Debug, Default)]
pub struct Cesium3dTileContentState {
    pub leaf: bool,
    pub touched_last_frame: bool,
    pub is_visible: bool,
    /// Whether this content was touched while traversing.
    pub touched: bool,
    pub is_data_loaded: bool,
    pub is_rendered_last_frame: bool,
    pub are_all_children_loaded: bool,
    pub distance_from_camera: f32,
    pub sse: f32,
}

impl Cesium3dTileContentState {
    fn reset(&mut self) {
        self.leaf = false;
        self.is_visible = false;
        self.touched = false;
        self.is_data_loaded = false;
        self.are_all_children_loaded = false;
        self.distance_from_camera = 0.;
        self.sse = 0.;
    }
}

#[derive(Component)]
pub struct RenderedCesium3dTileContent {
    pub layer_id: Entity,
    pub feature_id: Option<Entity>,
    pub data_requester_id: Entity,
    pub is_visible: bool,
}

#[derive(Component)]
pub struct TileTransform {
    pub transform: Transform,
}

#[derive(Component, PartialEq, Debug, Clone)]
pub struct Cesium3dTilesTreeOrder {
    pub index: usize,
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
