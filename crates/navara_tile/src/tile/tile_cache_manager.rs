use std::collections::{HashMap, HashSet};

use bevy_ecs::{
    entity::Entity,
    query::With,
    system::{Query, Resource},
};
use navara_mesh::Mesh;

use super::{TileHandle, TileMeshMarker};

/// This struct caches an information that is necessary in rendering.
/// Of course, we can store these value in the tile of TileQuadtree,
/// but accessing it is a little bit high cost.
/// These values are removed and added frequently,so we should use this cache structure.
pub struct TileCache {
    pub mesh_entity: Option<Entity>,
    pub rendered_tile_entity: Entity,
    pub mesh_prepared: bool,
    pub are_children_prepared: bool,
    pub has_children: bool,
}

impl TileCache {
    pub fn reset_state(&mut self) {
        self.are_children_prepared = false;
        self.has_children = false;
    }
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub struct TileCacheManager {
    pub rendered_tile_caches: HashMap<TileHandle, TileCache>,
    pub cached_textures_tile_handles: HashSet<TileHandle>,
    pub rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}

impl TileCacheManager {
    pub fn activate_rendered_tile(
        &self,
        handle: &TileHandle,
        meshes: &mut Query<&mut Mesh, With<TileMeshMarker>>,
        active: bool,
    ) {
        let t = match self.rendered_tile_caches.get(handle) {
            Some(t) => t,
            None => return,
        };
        let mesh_entity = match t.mesh_entity {
            Some(m) => m,
            None => return,
        };
        let mesh = match meshes.get(mesh_entity) {
            Ok(m) => m,
            Err(_) => return,
        };

        if mesh.active != active {
            meshes.get_mut(mesh_entity).unwrap().active = active;
        }
    }

    pub fn is_rendered_tile_activated(
        &self,
        handle: &TileHandle,
        meshes: &Query<&mut Mesh, With<TileMeshMarker>>,
    ) -> bool {
        let t = match self.rendered_tile_caches.get(handle) {
            Some(t) => t,
            None => return false,
        };
        let mesh_entity = match t.mesh_entity {
            Some(m) => m,
            None => return false,
        };
        let mesh = match meshes.get(mesh_entity) {
            Ok(m) => m,
            Err(_) => return false,
        };
        mesh.active
    }

    pub fn is_rendered_tile_prepared(&self, handle: &TileHandle) -> bool {
        let t = match self.rendered_tile_caches.get(handle) {
            Some(t) => t,
            None => return false,
        };

        t.mesh_prepared
    }
}

pub const MAX_CACHE_SIZE: usize = 100;
