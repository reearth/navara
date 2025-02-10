use bevy_app::prelude::*;
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
use navara_input::InputPlugin;
use navara_layer_event::LayerPlugin;
use navara_mesh::MeshPlugin;
use navara_mvt::MvtPlugin;
use navara_occluder::OccluderPlugin;
use navara_texture_fragment::TextureFragmentPlugin;
use navara_tile::TilePlugin;
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
        app.add_plugins(BufferStorePlugin);
        app.add_plugins(InputPlugin);
        app.add_plugins(EventPlugin);
        app.add_plugins(TextureFragmentPlugin);
        app.add_plugins(DataRequesterPlugin);
        app.add_plugins(MeshPlugin);
        app.add_plugins(WindowPlugin);
        app.add_plugins(CameraPlugin);
        app.add_plugins(FogPlugin);
        app.add_plugins(OccluderPlugin);
        app.add_plugins(LayerPlugin);
        app.add_plugins(FeaturePlugin);
        app.add_plugins(GeoJsonPlugin);
        app.add_plugins(TilePlugin);
        app.add_plugins(Cesium3dTilesPlugin);
        app.add_plugins(MvtPlugin);
        app.add_plugins(WorkerPlugin);

        // custom systems
        app.add_systems(Startup, startup);
        app.add_systems(Update, update);
    }
}

fn startup(mut _commands: Commands) {
    // TODO
}

fn update() {
    // TODO
}
