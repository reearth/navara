use bevy_ecs::{component::Component, entity::Entity, system::Query};
use navara_core::{Aabb, Extent, LngLat, Obb};
use navara_data_requester::DataRequesterExtension;
use navara_feature_component::{id::FeatureId, render::RenderableFeature};
use navara_layer::Cesium3dTilesLayer;
use navara_material::Appearance;
use navara_math::FloatType;
use navara_parser::cesium3dtiles::{self, tileset::Refine};
use url::{ParseError, Url};

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

    pub state: Cesium3dTileContentState,
}

impl Cesium3dTileContent {
    pub fn new(tile: &cesium3dtiles::tileset::Tile, parent: Option<&Self>) -> Self {
        let bv = &tile.bounding_volume;
        let bounding_volume = match (bv.region, bv.box_, bv.sphere) {
            (Some([west, south, east, north, min_height, max_height]), _, _) => {
                Some(Aabb::from_extent_f32(
                    Extent::from_points(&[
                        LngLat::new(south as FloatType, west as FloatType),
                        LngLat::new(north as FloatType, east as FloatType),
                    ]),
                    min_height as FloatType,
                    max_height as FloatType,
                ))
            }
            (_, Some(box_), _) => {
                let box_: [f32; 12] = [
                    box_[0] as f32,
                    box_[1] as f32,
                    box_[2] as f32,
                    box_[3] as f32,
                    box_[4] as f32,
                    box_[5] as f32,
                    box_[6] as f32,
                    box_[7] as f32,
                    box_[8] as f32,
                    box_[9] as f32,
                    box_[10] as f32,
                    box_[11] as f32,
                ];

                Some(Obb::from_points(&box_).into_aabb())
            }
            // TODO: Support making bounding volume from the sphere
            (_, _, Some(_)) => None,
            _ => None,
        };

        let default_refine = Refine::Replace;

        let uri = tile.content.as_ref().map(|c| c.uri.clone());

        let is_renderable_content = check_if_renderable_content(&uri);

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
            state: Cesium3dTileContentState::default(),
        }
    }

    pub fn make_content_url(
        &self,
        base_url: &Url,
    ) -> Result<Option<(String, DataRequesterExtension)>, ParseError> {
        let url = match &self.uri {
            Some(uri) => base_url.join(uri)?,
            None => return Ok(None),
        };
        let extension = DataRequesterExtension::from_url(&url);
        Ok(Some((url.to_string(), extension)))
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
    pub meet_sse: bool,
    pub is_data_loaded: bool,
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
    pub url: Option<String>,
}

fn check_if_renderable_content(uri: &Option<String>) -> bool {
    uri.as_ref()
        .map(|u| {
            let is_json = u.ends_with(".json") || u.contains(".json?");
            !is_json
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_if_renderable_content() {
        let uri = Some("https://example.com/model.glb".to_string());
        assert!(check_if_renderable_content(&uri));

        let uri = Some("https://example.com/model.json".to_string());
        assert!(!check_if_renderable_content(&uri));

        let uri = Some("https://example.com/model.json?param=value".to_string());
        assert!(!check_if_renderable_content(&uri));

        let uri = None;
        assert!(!check_if_renderable_content(&uri));
    }
}
