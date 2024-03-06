use bevy_ecs::prelude::*;
use map_engine_core::{
    iter_tiles, tile_geometry::tile_triangles_flat, Extent, Radians, TileXYZ, WGS84_32,
};

use crate::{BufferStore, DataRequester, Material, Mesh, MeshBundle, ObjectBundle};

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

pub fn update_tiles(
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
            let terrain_url = tiles.terrain_url.as_ref().map(|s| tile_url(s, &xyz));

            let mut e = commands.spawn(MeshBundle {
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

            if let Some(tu) = terrain_url {
                e.insert(DataRequester::from_store(tu, &mut buf));
            }
        }
    }
}

fn tile_url(s: &str, xyz: &TileXYZ) -> String {
    s.replace("{x}", &xyz.x.to_string())
        .replace("{y}", &xyz.y.to_string())
        .replace("{z}", &xyz.z.to_string())
}
