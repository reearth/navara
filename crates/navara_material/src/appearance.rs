use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{calc_transform, ElevationDecoder, CRS};
use navara_math::{FloatType, Transform, Vec2, Vec3};

#[derive(Debug, Clone, PartialEq)]
pub enum Appearance {
    Point(PointMaterial),
    Billboard(BillboardMaterial),
    Text(TextMaterial),
    Polyline(PolylineMaterial),
    Polygon(PolygonMaterial),
    Model(ModelMaterial),
    VectorTile(VectorTileMaterial),
    RasterTile(RasterTileMaterial),
}

impl Appearance {
    pub fn set(&mut self, appearance: &Appearance) {
        match (self, appearance) {
            (Appearance::Point(dist), Appearance::Point(src)) => {
                *dist = src.clone();
            }
            (Appearance::Polyline(dist), Appearance::Polyline(src)) => {
                *dist = src.clone();
            }
            (Appearance::Polygon(dist), Appearance::Polygon(src)) => {
                *dist = src.clone();
            }
            (Appearance::Model(dist), Appearance::Model(src)) => {
                *dist = src.clone();
            }
            (Appearance::VectorTile(dist), Appearance::VectorTile(src)) => {
                *dist = src.clone();
            }
            (Appearance::RasterTile(dist), Appearance::RasterTile(src)) => {
                *dist = src.clone();
            }
            _ => {}
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PointMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    /// near, far
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    // Allow transparency and anti-aliasing.
    pub transparent: bool,
    pub id_property: String,
}

impl Default for PointMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 0.1,
            color: 0xffffff,
            center: Vec2::new(0.5, 0.),
            clamp_to_ground: true,
            height: 1.,
            scale_by_distance: true,
            depth_test: true,
            transparent: true,
            id_property: "".to_string(),
        }
    }
}

impl PointMaterial {
    pub fn update(
        &mut self,
        from: &PointMaterial,
        coordinates: &Vec3,
        crs: &CRS,
        transform: &mut Transform,
    ) {
        let should_update_transform = self.height != from.height || self.size != from.size;
        *self = from.clone();

        if should_update_transform {
            *transform = calc_transform(coordinates, crs, self.height, self.size, false);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct BillboardMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    pub url: String,
    /// near, far
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    // Allow transparency and anti-aliasing.
    pub transparent: bool,
    pub alpha_test: f32,
    pub id_property: String,
}

impl Default for BillboardMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 0.1,
            color: 0xffffff,
            center: Vec2::new(0.5, 0.),
            clamp_to_ground: true,
            height: 1.,
            url: "".to_string(),
            scale_by_distance: true,
            depth_test: true,
            transparent: false,
            alpha_test: 0.1,
            id_property: "".to_string(),
        }
    }
}

impl BillboardMaterial {
    pub fn update(
        &mut self,
        from: &BillboardMaterial,
        coordinates: &Vec3,
        crs: &CRS,
        transform: &mut Transform,
    ) {
        let should_update_transform = self.height != from.height || self.size != from.size;
        *self = from.clone();

        if should_update_transform {
            *transform = calc_transform(coordinates, crs, self.height, self.size, false);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct TextMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    /// near, far
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    pub text: String,
    pub font: String,
    pub background_color: Option<u32>,
    pub border_color: u32,
    pub border_width: FloatType, // 0 ~ 0.5, the ratio of the border to the height
    pub corner_radius: FloatType, // 0 ~ 0.5, the ratio of the corner radius to the height
    pub padding: Vec2,
    pub id_property: String,
}

impl Default for TextMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 10.0,
            color: 0xffffff,
            center: Vec2::new(0.5, 0.),
            clamp_to_ground: true,
            height: 1.,
            scale_by_distance: true,
            depth_test: true,
            text: "".to_string(),
            font: "".to_string(),
            background_color: None,
            border_color: 0x000000,
            border_width: 0.05,
            corner_radius: 0.1,
            padding: Vec2::new(5.0, 2.0),
            id_property: "".to_string(),
        }
    }
}

impl TextMaterial {
    pub fn update(
        &mut self,
        from: &TextMaterial,
        coordinates: &Vec3,
        crs: &CRS,
        transform: &mut Transform,
    ) {
        let should_update_transform = self.height != from.height;
        *self = from.clone();

        if should_update_transform {
            *transform = calc_transform(coordinates, crs, self.height, self.size, false);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: bool,
    pub color: u32,
    pub width: f32,
    pub clamp_to_ground: bool,
    pub use_ground_normals: bool,
    pub height: f32,
    pub internal: Option<PolylineInternalMaterial>,
    pub id_property: String,
}

impl Default for PolylineMaterial {
    fn default() -> Self {
        Self {
            show: true,
            color: 0xffffff,
            width: 1.,
            clamp_to_ground: true,
            use_ground_normals: false,
            height: 1.,
            internal: None,
            id_property: "".to_string(),
        }
    }
}

impl PolylineMaterial {
    pub fn update(&mut self, from: &PolylineMaterial) {
        let internal = self.internal.take();
        *self = from.clone();
        self.internal = internal;
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolylineInternalMaterial {
    pub min_max_heights: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: bool,
    pub color: u32,
    pub clamp_to_ground: bool,
    pub use_ground_normals: bool,
    pub height: f32,
    pub extruded_height: Option<f32>,
    pub wireframe: bool,
    pub internal: Option<PolygonInternalMaterial>,
    pub id_property: String,
}

impl Default for PolygonMaterial {
    fn default() -> Self {
        Self {
            show: true,
            color: 0xffffff,
            clamp_to_ground: true,
            use_ground_normals: false,
            height: 1.,
            extruded_height: None,
            wireframe: false,
            internal: None,
            id_property: "".to_string(),
        }
    }
}

impl PolygonMaterial {
    pub fn update(&mut self, from: &PolygonMaterial) {
        let internal = self.internal.clone();
        *self = from.clone();
        self.internal = internal;
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolygonInternalMaterial {
    pub min_max_heights: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show: bool,
    pub url: String,
    pub size: FloatType,
    pub height: FloatType,
    pub clamp_to_ground: bool,
    pub should_rotate_in_default: bool,
    pub max_sse: f32,
    pub id_property: String,
    pub color: u32,
    pub metalness: f32,
    pub roughness: f32,
}

impl Default for ModelMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 1.,
            clamp_to_ground: true,
            height: 1.,
            url: "".to_string(),
            should_rotate_in_default: true,
            max_sse: 2.,
            id_property: "".to_string(),
            color: 0xffffff,
            metalness: 0.0,
            roughness: 1.0,
        }
    }
}

impl ModelMaterial {
    pub fn update(
        &mut self,
        from: &ModelMaterial,
        coordinates: &Vec3,
        crs: &CRS,
        transform: &mut Transform,
    ) {
        let should_update_transform = self.height != from.height
            || self.size != from.size
            || self.should_rotate_in_default != from.should_rotate_in_default;
        *self = from.clone();

        if should_update_transform {
            *transform = calc_transform(
                coordinates,
                crs,
                self.height,
                self.size,
                self.should_rotate_in_default,
            );
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct VectorTileMaterial {
    pub show: bool,
    pub max_sse: f32,
    pub max_zoom: usize,
    pub layers: Option<Vec<String>>,
}

impl Default for VectorTileMaterial {
    fn default() -> Self {
        Self {
            show: true,
            max_sse: 2.,
            max_zoom: 20,
            layers: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTileMaterial {
    pub show: bool,
    pub segments: usize,
    pub color: u32,
    pub opacity: f32,
    pub max_sse: f32,
    pub max_zoom: usize,
    pub min_zoom: usize,
    pub wireframe: bool,
    pub tms: bool,
    pub should_compute_normal_from_vertex: Option<bool>,
}

impl Default for RasterTileMaterial {
    fn default() -> Self {
        Self {
            show: true,
            color: 0xffffff,
            opacity: 1.,

            // TODO: Replace with one resource
            segments: 10,
            max_sse: 2.,
            max_zoom: 20,
            min_zoom: 0,
            wireframe: false,
            tms: false,
            should_compute_normal_from_vertex: None,
        }
    }
}

/// This is used to handle each tile's style in uniforms.
#[derive(Debug, Clone, PartialEq, Component, Default)]
pub struct RasterTileInternalMaterial {
    pub shows: Vec<bool>,
    pub colors: Vec<u32>,
    pub opacities: Vec<f32>,
    pub texture_fragments: Option<Vec<Option<Entity>>>,
    pub should_compute_normal_from_vertex: Option<bool>,
    pub wireframe: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTerrainMaterial {
    pub show: bool,
    pub segments: usize,
    pub max_zoom: usize,
    pub min_zoom: usize,
    pub wireframe: bool,
    pub elevation_decoder: ElevationDecoder,
    pub tile_size: u32,
}

impl Default for RasterTerrainMaterial {
    fn default() -> Self {
        Self {
            show: true,
            segments: 64,
            max_zoom: 20,
            min_zoom: 0,
            wireframe: false,
            elevation_decoder: ElevationDecoder::default(),
            tile_size: 256,
        }
    }
}
