use bevy_app::{App, Plugin, Update};
use bevy_ecs::schedule::{IntoScheduleConfigs, SystemSet};

pub mod component;
pub mod data_requester;
pub mod layer;
pub mod pos_converter;
pub mod source;
pub mod source_cache;
pub mod tile;

pub use component::*;
pub use layer::resource::LayerResources;
pub use layer::tile_cache_manager::TileCacheManager;
pub use pos_converter::{AsXYZ, PosConverter};
pub use source::{ReadyState, TileSource, VectorTileSource};
pub use source_cache::{
    SourceId, TraversalConfig, VectorTileSourceCache, VectorTileSourceResources,
};
pub use tile::render::RenderedTile;
pub use tile::traverse::{
    TraversalResult, activate_all_renderable_features, are_all_renderable_features_active,
    spawn_tile_entity, traverse_tile,
};

/// System sets for ordering vector tile processing stages.
///
/// External plugins (e.g. MvtPlugin, GeoJsonPlugin) should add their
/// source/layer preparation systems to [`VectorTileSet::Prepare`] so they
/// run before the core tile traversal in [`VectorTileSet::Process`].
#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub enum VectorTileSet {
    /// Preparation phase: layer resources and tile sources are set up.
    Prepare,
    /// Processing phase: tile traversal, mesh transfer, and cache cleanup.
    Process,
}

pub struct VectorTilePlugin;

impl Plugin for VectorTilePlugin {
    fn build(&self, app: &mut App) {
        app.configure_sets(
            Update,
            VectorTileSet::Prepare.before(VectorTileSet::Process),
        );

        app.init_resource::<VectorTileSourceCache>().add_systems(
            Update,
            (
                tile::system::update_tiles,
                tile::system::transfer_mesh,
                data_requester::system::filter_requestable_data_requester,
                tile::system::clear_caches,
            )
                .chain()
                .in_set(VectorTileSet::Process),
        );
    }
}
