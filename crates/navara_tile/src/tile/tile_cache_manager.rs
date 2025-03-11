use bevy_ecs::{
    entity::Entity,
    query::{With, Without},
    system::{Query, Resource},
};
use fxhash::{FxHashMap, FxHashSet};
use navara_component::Deleted;
use navara_mesh::Mesh;
use navara_tile_component::{TileHandle, TileMeshMarker};

/// This struct caches an information that is necessary in rendering.
/// Of course, we can store these value in the tile of TileQuadtree,
/// but accessing it is a little bit high cost.
/// These values are removed and added frequently,so we should use this cache structure.
pub struct RenderedTileCache {
    pub mesh_entity: Option<Entity>,
    pub rendered_tile_entity: Entity,
    /// This is used to check if the mesh is prepared in client side.
    /// Because sometimes rendering engine needs to do some preparation asynchronously.
    pub mesh_prepared: bool,
}

// Manage the tiles that are going to be rendered.
#[derive(Default, Resource)]
pub struct TileCacheManager {
    pub rendered_tile_caches: FxHashMap<TileHandle, RenderedTileCache>,
    pub requested_tile_caches: FxHashSet<TileHandle>,
    pub last_rendered_frame: usize,
    pub is_updated_in_this_frame: bool,
}

impl TileCacheManager {
    pub fn activate_rendered_tile(
        &self,
        handle: &TileHandle,
        meshes: &mut Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
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
        meshes: &mut Query<&mut Mesh, (With<TileMeshMarker>, Without<Deleted>)>,
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

    pub fn set_is_rendered_tile_prepared(&mut self, handle: &TileHandle, prepared: bool) {
        let t = match self.rendered_tile_caches.get_mut(handle) {
            Some(t) => t,
            None => return,
        };

        t.mesh_prepared = prepared;
    }

    pub fn is_rendered_tile_prepared(&self, handle: &TileHandle) -> bool {
        let t = match self.rendered_tile_caches.get(handle) {
            Some(t) => t,
            None => return false,
        };

        t.mesh_prepared
    }
}
