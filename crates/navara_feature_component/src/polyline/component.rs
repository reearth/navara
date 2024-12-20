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
    pub fn with_buf(buf: &mut BufferStore, coords: Vec<f32>, crs: CRS) -> Self {
        Self {
            coords: buf.new_f32(coords),
            crs,
        }
    }
}
