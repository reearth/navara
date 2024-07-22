use bevy_ecs::component::Component;
use bevy_math::{Vec2, Vec3};

#[derive(Debug, Clone, PartialEq)]
pub enum Appearance {
    Point(PointMaterial),
    Billboard(BillboardMaterial),
    Polyline(PolylineMaterial),
    Polygon(PolygonMaterial),
    Model(ModelMaterial),
}

// The actual mesh will be constructed in Navara.
#[derive(Component, Debug, Default)]
pub struct PointGeometry;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PointMaterial {
    pub show: bool,
}

// The actual mesh will be constructed in a rendering engine, so this geometry has a position.
#[derive(Component, Clone, Debug, Default)]
pub struct BillboardGeometry {
    pub position: Vec3,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct BillboardMaterial {
    pub show: bool,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    pub url: String,
    /// near, far
    pub scale_by_distance: (f32, f32),
}

// The actual mesh will be constructed in Navara.
#[derive(Component, Debug, Default)]
pub struct PolylineGeometry;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: bool,
}
// The actual mesh will be constructed in Navara.
#[derive(Component, Debug, Default)]
pub struct PolygonGeometry;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: bool,
}

// The actual mesh will be constructed in a rendering engine, so this geometry has a position.
#[derive(Component, Clone, Debug, Default)]
pub struct ModelGeometry {
    pub position: Vec3,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show: bool,
    pub url: String,
}
