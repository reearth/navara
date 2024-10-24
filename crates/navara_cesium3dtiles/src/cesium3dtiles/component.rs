use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{Aabb, Extent, LngLat};
use navara_data_requester::DataRequesterExtension;
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
        layer: Option<&Cesium3dTilesLayer>,
        metadata: &navara_parser::cesium3dtiles::tileset::Tileset,
    ) -> Result<Self, ParseError> {
        let base_url = Url::parse(url)?;
        let root = Cesium3dTileContent::new(&metadata.root, None);

        let appearance = layer.and_then(|l| {
            l.appearances
                .iter()
                .find(|a| matches!(a, Appearance::Model(_)))
        });
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
    pub uri: String,
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
        let content = match &tile.content {
            Some(c) => c,
            None => unimplemented!("TODO: Support multiple contents"),
        };
        let bv = &tile.bounding_volume;
        let bounding_volume = match (bv.region, bv.sphere) {
            (Some([west, south, east, north, min_height, max_height]), _) => {
                Some(Aabb::from_extent_f32(
                    Extent::from_points(&[
                        LngLat::new(south as FloatType, west as FloatType),
                        LngLat::new(north as FloatType, east as FloatType),
                    ]),
                    min_height as FloatType,
                    max_height as FloatType,
                ))
            }
            // TODO: Support making bounding volume from the sphere
            (_, Some(_)) => None,
            _ => None,
        };
        let default_refine = Refine::Replace;
        Self {
            uri: content.uri.clone(),
            data_requester_id: None,
            rendered_tile_id: None,
            children: None,
            is_renderable_content: !content.uri.ends_with(".json"),
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
    ) -> Result<(String, DataRequesterExtension), ParseError> {
        let url = base_url.join(&self.uri)?;
        let extension = DataRequesterExtension::from_url(&url);
        Ok((url.to_string(), extension))
    }

    pub fn reset_state(&mut self) {
        self.state.reset();
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
    pub distance_from_camera: f32,
    pub sse: f32,
}

impl Cesium3dTileContentState {
    fn reset(&mut self) {
        self.leaf = false;
        self.is_visible = false;
        self.touched = false;
        self.is_data_loaded = false;
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

// TODO
// 1. Load layer and parse JSON
// 2. Traverse tileset while loading metadata
// 3. Spawn component if it's renderable
// 4. Remove the component if it's stale
//   - Need to count maximum rendered tiles.

// fn traverse(
//     tile: &mut Cesium3dTileContent,
//     tile_meta: &navara_parser::cesium3dtiles::tileset::Tile,
// ) {
//     let children_meta = match &tile_meta.children {
//         Some(c) => c,
//         None => return,
//     };
//     for (i, child_meta) in children_meta.iter().enumerate() {
//         let child = &mut tile.children.get_mut(i);
//         let child = match child {
//             Some(c) => c,
//             None => {}
//         };
//         traverse(child, child_meta);
//     }
// }
