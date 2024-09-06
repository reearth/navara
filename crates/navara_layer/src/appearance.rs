use bevy_ecs::component::Component;
use navara_math::Vec2;

#[derive(Debug, Clone, PartialEq)]
pub enum Appearance {
    Point(PointMaterial),
    Billboard(BillboardMaterial),
    Polyline(PolylineMaterial),
    Polygon(PolygonMaterial),
    Model(ModelMaterial),
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PointMaterial {
    pub show: bool,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    /// near, far
    pub scale_by_distance: (f32, f32),
    pub clamp_to_ground: bool,
    pub depth_test: bool,
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
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show: bool,
    pub url: String,
}
