use bevy_ecs::component::Component;
use navara_buffer_store::{BufferStore, Handle};
use navara_core::CRS;

#[derive(Component)]
pub struct PolylineMarker;

#[derive(Component)]
pub struct PolylineGeometry {
    pub coords: Handle,
    pub crs: CRS,
}

impl PolylineGeometry {
    pub fn with_buf(buf: &mut BufferStore, coords: Vec<f64>, crs: CRS) -> Self {
        Self {
            coords: buf.new_f64(coords),
            crs,
        }
    }

    /// Removes the buffer handle from BufferStore.
    /// Must be called before despawning the entity to avoid memory leaks.
    pub fn remove_from_buf(&self, buf: &mut BufferStore) {
        buf.remove(&self.coords);
    }
}
