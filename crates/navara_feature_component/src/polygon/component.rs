use bevy_ecs::{component::Component, entity::Entity};
use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_geometry::TransferableHierarchy;
use navara_material::PolygonMaterial;

#[derive(Component)]
pub struct PolygonMarker;

#[derive(Component, Debug)]
pub struct PolygonGeometry {
    pub hierarchy: TransferableHierarchy,
    pub crs: CRS,
}

impl PolygonGeometry {
    /// Removes all buffer handles from BufferStore.
    /// Must be called before despawning the entity to avoid memory leaks.
    pub fn remove_from_buf(&self, buf: &mut BufferStore) {
        self.hierarchy.remove_from_buf(buf);
    }
}

#[derive(Component)]
pub struct UpdatePolygon {
    pub material: PolygonMaterial,
    pub feature_id: Entity,
}
