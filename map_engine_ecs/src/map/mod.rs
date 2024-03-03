use bevy_app::{App, Plugin, Update};
use bevy_ecs::{
    component::Component,
    event::{Event, EventReader},
    query::Added,
    system::{Commands, Query, ResMut},
};
use map_engine_core::{
    iter_tiles, tile_geometry::tile_triangles_flat, Extent, Radians, TileXYZ, WGS84_32,
};

use crate::{BufferStore, Material, Mesh, MeshBundle, ObjectBundle};

pub struct MapPlugin;

impl Plugin for MapPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (process_events, update_tiles))
            .add_event::<AddLayerEvent>();
    }
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles {
        tile_url: String,
        terrain_url: Option<String>,
        z: usize,
        segments: usize,
        height: f32,
        extent: Option<Extent<f32, Radians>>,
        color: u32,
        wireframe: bool,
    },
}

fn process_events(mut commands: Commands, mut events: EventReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        match desc {
            LayerDescription::Tiles {
                tile_url,
                terrain_url,
                z,
                segments,
                height,
                extent,
                color,
                wireframe,
            } => {
                commands.spawn(Tiles {
                    tile_url: Some(tile_url.clone()),
                    terrain_url: terrain_url.clone(),
                    z: *z,
                    segments: *segments,
                    height: *height,
                    extent: *extent,
                    color: *color,
                    wireframe: *wireframe,
                });
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct Tiles {
    pub tile_url: Option<String>,
    pub terrain_url: Option<String>,
    pub z: usize,
    pub segments: usize,
    pub height: f32,
    pub extent: Option<Extent<f32, Radians>>,
    pub color: u32,
    pub wireframe: bool,
}

fn update_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    tiles: Query<&Tiles, Added<Tiles>>,
) {
    for tiles in tiles.iter() {
        for xyz in iter_tiles(tiles.z) {
            let extent = xyz.extent();

            if let Some(ref tiles_extent) = tiles.extent {
                if !tiles_extent.intersects(extent) {
                    continue;
                }
            }

            let triangles = tile_triangles_flat(WGS84_32, extent, tiles.segments, tiles.height);

            let vhandle = buf.new_f32(triangles.vertices.into_iter().flatten().collect());
            let ihandle = buf.new_u32(triangles.indices);
            let uvshandle = buf.new_f32(triangles.uvs.into_iter().flatten().collect());

            let map_url = tiles.tile_url.as_ref().map(|s| tile_url(s, &xyz));

            commands.spawn(MeshBundle {
                mesh: Mesh {
                    vertices: vhandle,
                    indices: ihandle,
                    uvs: uvshandle,
                },
                material: Material {
                    color: tiles.color,
                    map_url,
                    wireframe: tiles.wireframe,
                },
                object: ObjectBundle {
                    transform: Default::default(),
                    marker: Default::default(),
                },
            });
        }
    }
}

fn tile_url(s: &str, xyz: &TileXYZ) -> String {
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &xyz.y.to_string())
        .replace("{z}", &xyz.z.to_string())
}
