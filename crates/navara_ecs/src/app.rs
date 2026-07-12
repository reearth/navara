use bevy_app::prelude::*;
use bevy_ecs::schedule::IntoScheduleConfigs;
use bevy_ecs::system::Commands;
use navara_buffer_store::BufferStorePlugin;
use navara_camera::CameraPlugin;
use navara_cesium3dtiles::Cesium3dTilesPlugin;
use navara_data_requester::DataRequesterPlugin;
use navara_event::EventPlugin;
use navara_feature::FeaturePlugin;
use navara_fog::FogPlugin;
use navara_frame::FramePlugin;
use navara_geojson::GeoJsonPlugin;
use navara_globe::GlobePlugin;
use navara_input::InputPlugin;
use navara_layer_event::LayerPlugin;
use navara_memory::{MemoryAccountingSet, MemoryPlugin, PendingEvictionResetSet};
use navara_mesh::{MeshPlugin, remove_removed_mesh};
use navara_mvt::MvtPlugin;
use navara_occluder::OccluderPlugin;
use navara_pmtiles::PmTilesPlugin;
use navara_source::SourcePlugin;
use navara_texture_fragment::TextureFragmentPlugin;
use navara_tile::{TilePlugin, TileSet};
use navara_vector_tile::{VectorTilePlugin, VectorTileSet};
use navara_window::WindowPlugin;
use navara_worker::WorkerPlugin;

pub struct Plugin;

impl bevy_app::Plugin for Plugin {
    fn build(&self, app: &mut App) {
        // bevy plugins
        #[cfg(feature = "debug")]
        app.add_plugins(bevy_log::LogPlugin::default());

        // custom plugins
        app.add_plugins(FramePlugin);
        app.add_plugins(GlobePlugin);
        app.add_plugins(BufferStorePlugin);
        app.add_plugins(MemoryPlugin);
        app.add_plugins(InputPlugin);
        app.add_plugins(EventPlugin);
        app.add_plugins(TextureFragmentPlugin);
        app.add_plugins(DataRequesterPlugin);
        app.add_plugins(MeshPlugin);
        app.add_plugins(WindowPlugin);
        app.add_plugins(CameraPlugin);
        app.add_plugins(FogPlugin);
        app.add_plugins(OccluderPlugin);
        app.add_plugins(SourcePlugin);
        app.add_plugins(LayerPlugin);
        app.add_plugins(FeaturePlugin);
        app.add_plugins(GeoJsonPlugin);
        app.add_plugins(TilePlugin);
        app.add_plugins(Cesium3dTilesPlugin);
        app.add_plugins(VectorTilePlugin);
        app.add_plugins(MvtPlugin);
        app.add_plugins(PmTilesPlugin);
        app.add_plugins(WorkerPlugin);

        // The draped-vector traverse reads the terrain quadtree by extent to keep its
        // SSE in step with the terrain's subdivision (like raster). Run it after the
        // terrain/raster `TileSet` so it sees this frame's rendered terrain tiles.
        app.configure_sets(Update, VectorTileSet::Process.after(TileSet));

        // Layer add/update/delete events must apply BEFORE the tile pipeline
        // runs, so `sync_terrain_layer_changes` observes `Added<TerrainLayer>`
        // in the same frame `update_terrain` first traverses with the new
        // layer. Without this the spawn can land between the two (schedule
        // ambiguity), and the one-frame-late teardown destroys in-flight DEM
        // requesters whose re-created shared-fetch consumers then wait forever
        // (terrain never renders when the DEM source lacks low-zoom tiles).
        app.configure_sets(Update, navara_layer_event::LayerEventSet.before(TileSet));

        // The deferred-eviction credit (`pending_evicted_gpu_bytes`) must be
        // cleared only AFTER the previous frame's evicted meshes are despawned
        // (firing their `TileCost` hooks, so `gpu_bytes_est` already reflects
        // the eviction). The reset system is registered by `MemoryPlugin` in
        // its own set; only here are both crates in scope to order it.
        app.configure_sets(
            PreUpdate,
            PendingEvictionResetSet.after(remove_removed_mesh),
        );

        // custom systems
        app.add_systems(Startup, startup);
        app.add_systems(Update, update);
        // Fold the per-layer retention pools into the ledger each frame so the
        // load gate / pressure controller can exclude the evictable cache from
        // the budget decision (see `MemoryLedger::hard_usage`).
        app.add_systems(
            PostUpdate,
            crate::sync_retained_bytes.in_set(MemoryAccountingSet),
        );
    }
}

fn startup(mut _commands: Commands) {
    // TODO
}

fn update() {
    // TODO
}
