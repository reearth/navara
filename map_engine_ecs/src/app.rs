use bevy_app::prelude::*;
use bevy_ecs::system::Commands;
use bevy_time::TimePlugin;
use map_engine_core::{Deg, Degrees, Extent};

pub struct Plugin;

impl bevy_app::Plugin for Plugin {
    fn build(&self, app: &mut App) {
        // bevy plugins
        app.add_plugins(bevy_log::LogPlugin::default());
        app.add_plugins(TimePlugin);

        // custom plugins
        app.add_plugins(super::buffer::BufferStorePlugin);
        app.add_plugins(super::input::InputPlugin);
        app.add_plugins(super::event::EventPlugin);
        app.add_plugins(super::object::ObjectPlugin);
        app.add_plugins(super::camera::CameraPlugin);
        app.add_plugins(super::map::MapPlugin);

        // custom systems
        app.add_systems(Startup, startup);
        app.add_systems(Update, update);
    }
}

fn startup(mut commands: Commands) {
    let chiyoda_extent: Extent<f32, Degrees> = Extent {
        west: Deg::new(139.712),
        south: Deg::new(35.6544),
        north: Deg::new(35.71),
        east: Deg::new(139.782),
    };

    let fuji_extent: Extent<f32, Degrees> = Extent {
        west: Deg::new(138.558),
        south: Deg::new(35.244),
        north: Deg::new(35.496),
        east: Deg::new(138.866),
    };

    const BASE: &str = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
    const TERRAIN: &str = "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png";

    // globe
    commands.spawn(crate::map::Tiles {
        tile_url: Some(BASE.to_string()),
        terrain_url: None,
        z: 4,
        segments: 1,
        height: 0.0,
        extent: None,
        color: 0xffffff,
        wireframe: false,
    });

    // chiyoda-ku
    commands.spawn(crate::map::Tiles {
        tile_url: Some(BASE.to_string()),
        terrain_url: None,
        z: 12,
        segments: 10,
        height: 36.6,
        extent: Some(chiyoda_extent.into()),
        color: 0xffffff,
        wireframe: false,
    });

    // fuji
    commands.spawn(crate::map::Tiles {
        tile_url: Some(BASE.to_string()),
        terrain_url: Some(TERRAIN.to_string()),
        z: 10,
        segments: 256,
        height: 42.0698,
        extent: Some(fuji_extent.into()),
        color: 0xffffff,
        wireframe: false,
    });
}

fn update() {
    // TODO
}
