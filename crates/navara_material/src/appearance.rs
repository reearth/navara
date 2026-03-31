use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{CRS, ElevationDecoder, calc_transform};
use navara_math::{Transform, Vec2, Vec3};

/// Configuration for elevation heatmap rendering.
/// Shared across all elevation heatmap layers in a tile.
/// Note: color_map_lut is now stored in Globe.elevation_colormap
#[derive(Debug, Clone, PartialEq)]
pub struct ElevationHeatmapConfig {
    pub max_height: f64,
    pub min_height: f64,
    pub elevation_decoder: ElevationDecoder,

    pub logarithmic: bool,
    pub log_boundary: f64,
}

/// Configuration for hillshade rendering.
/// Computes normals from DEM gradients to fix tile boundary seams.
/// The computed normals are used with existing scene lighting.
#[derive(Debug, Clone, PartialEq)]
pub struct HillshadeConfig {
    pub elevation_decoder: ElevationDecoder,

    /// Exaggeration factor for hillshade effect (default: 1.0)
    /// Higher values make terrain appear more dramatic, lower values flatten it. Recommended range is 0.5 to 2.0.
    pub exaggeration: f32,
}

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
            (Appearance::Billboard(dist), Appearance::Billboard(src)) => {
                *dist = src.clone();
            }
            (Appearance::Text(dist), Appearance::Text(src)) => {
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
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    /// near, far
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    pub offset_depth: bool,
    // Allow transparency and anti-aliasing.
    pub transparent: bool,
    // post effect
    pub effect_ids: Option<Vec<String>>,
    /// Depth behavior for selective effect mask passes: "normal" or "silhouette"
    pub selective_effect_occlusion: Option<String>,
    pub emissive_intensity: Option<f32>,
    pub emissive_color: Option<u32>,
}

impl Default for PointMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 0.1,
            color: 0xffffff,
            center: Vec2::new(0.0, 0.),
            clamp_to_ground: true,
            height: 1.,
            scale_by_distance: true,
            depth_test: true,
            offset_depth: true,
            transparent: true,
            // post effect
            effect_ids: None,
            selective_effect_occlusion: None,
            emissive_intensity: None,
            emissive_color: None,
        }
    }
}

impl PointMaterial {
    pub fn update(&mut self, from: &PointMaterial, transform: &mut Transform) {
        if self.size != from.size {
            transform.scale = Vec3::splat(from.size as f64);
        }
        *self = from.clone();
    }
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
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    pub offset_depth: bool,
    // Allow transparency and anti-aliasing.
    pub transparent: bool,
    pub alpha_test: f32,
    // post effect
    pub effect_ids: Option<Vec<String>>,
    /// Depth behavior for selective effect mask passes: "normal" or "silhouette"
    pub selective_effect_occlusion: Option<String>,
    pub emissive_intensity: Option<f32>,
    pub emissive_color: Option<u32>,
}

impl Default for BillboardMaterial {
    fn default() -> Self {
        Self {
            show: true,
            size: 0.1,
            color: 0xffffff,
            center: Vec2::new(0.0, 0.),
            clamp_to_ground: true,
            height: 1.,
            url: "".to_string(),
            scale_by_distance: true,
            depth_test: true,
            offset_depth: true,
            transparent: false,
            alpha_test: 0.1,
            // post effect
            effect_ids: None,
            selective_effect_occlusion: None,
            emissive_intensity: None,
            emissive_color: None,
        }
    }
}

impl BillboardMaterial {
    pub fn update(&mut self, from: &BillboardMaterial, transform: &mut Transform) {
        if self.size != from.size {
            transform.scale = Vec3::splat(from.size as f64);
        }
        *self = from.clone();
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct TextMaterial {
    pub show: bool,
    pub size: f32,
    pub color: u32,
    pub center: Vec2,
    pub height: f32,
    /// near, far
    pub scale_by_distance: bool,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
    pub offset_depth: bool,
    pub text: String,
    pub font: String,
    pub background_color: Option<u32>,
    pub border_color: u32,
    pub border_width: f32,  // 0 ~ 0.5, the ratio of the border to the height
    pub corner_radius: f32, // 0 ~ 0.5, the ratio of the corner radius to the height
    pub padding: Vec2,
    // outline
    pub outline_blur: f32,    // outlineBlur Defalut:0
    pub outline_color: u32,   // outlineColor Defalut:black
    pub outline_offset: Vec2, // outlineOffset Default: (0,0)
    pub outline_opacity: f32, // outlineOpacity Default:1
    pub outline_width: f32,   // outlineWidth Default:0
    pub lang: String,
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
            offset_depth: true,
            text: "".to_string(),
            font: "".to_string(),
            background_color: None,
            border_color: 0x000000,
            border_width: 0.05,
            corner_radius: 0.1,
            padding: Vec2::new(5.0, 2.0),
            outline_blur: 0.0,
            outline_color: 0x000000,
            outline_offset: Vec2::new(0.0, 0.0),
            outline_opacity: 1.0,
            outline_width: 0.0,
            lang: "".to_string(),
        }
    }
}

impl TextMaterial {
    pub fn update(&mut self, from: &TextMaterial) {
        *self = from.clone();
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: bool,
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub color: u32,
    pub width: f32,
    pub max_width: f32,
    pub clamp_to_ground: bool,
    pub use_ground_normals: bool,
    pub height: f32,
    pub internal: Option<PolylineInternalMaterial>,
    // post effect
    pub effect_ids: Option<Vec<String>>,
    /// Depth behavior for selective effect mask passes: "normal" or "silhouette"
    pub selective_effect_occlusion: Option<String>,
    pub emissive_intensity: Option<f32>,
    pub emissive_color: Option<u32>,
}

impl Default for PolylineMaterial {
    fn default() -> Self {
        Self {
            show: true,
            cast_shadow: false,
            receive_shadow: false,
            color: 0xffffff,
            width: 1.,
            max_width: 10000.,
            clamp_to_ground: true,
            use_ground_normals: false,
            height: 1.,
            internal: None,
            // post effect
            effect_ids: None,
            selective_effect_occlusion: None,
            emissive_intensity: None,
            emissive_color: None,
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
    pub min_max_heights: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: bool,
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub color: u32,
    pub clamp_to_ground: bool,
    pub use_ground_normals: bool,
    pub height: f32,
    pub extruded_height: Option<f32>,
    pub wireframe: bool,
    pub reflectivity: f32,
    pub roughness: f32,
    pub internal: Option<PolygonInternalMaterial>,
    pub per_position_height: bool,
    pub opacity: f32,
    pub transparent: bool,

    pub surface_show: bool,
    pub outline: bool,
    pub outline_show: bool,
    pub outline_color: u32,
    pub outline_width: f32,

    pub water: bool,
    pub water_scale_normal: f32,
    pub water_speed: f32,
    pub shininess: f32,
    pub specular_strength: f32,
    pub apply_water_normal: bool,
    pub specular: bool,
    pub ior: f32,
    // post effect
    pub effect_ids: Option<Vec<String>>,
    /// Depth behavior for selective effect mask passes: "normal" or "silhouette"
    pub selective_effect_occlusion: Option<String>,
    pub emissive_intensity: Option<f32>,
    pub emissive_color: Option<u32>,
}

impl Default for PolygonMaterial {
    fn default() -> Self {
        Self {
            show: true,
            cast_shadow: false,
            receive_shadow: false,
            color: 0xffffff,
            clamp_to_ground: true,
            use_ground_normals: false,
            height: 1.,
            extruded_height: None,
            wireframe: false,
            reflectivity: 0.0,
            roughness: 0.0,
            internal: None,
            per_position_height: false,
            opacity: 1.0,
            transparent: false,

            surface_show: true,
            outline: false,
            outline_show: false,
            outline_color: 0xffffff,
            outline_width: 1.,

            water: false,
            water_scale_normal: 0.1,
            water_speed: 0.0003,
            shininess: 100.0,
            specular_strength: 2.0,
            apply_water_normal: false,
            specular: false,
            ior: 1.33333,

            // post effect
            effect_ids: None,
            selective_effect_occlusion: None,
            emissive_intensity: None,
            emissive_color: None,
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
    pub min_max_heights: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show: bool,
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub url: String,
    pub size: f32,
    pub height: f32,
    pub clamp_to_ground: bool,
    pub should_rotate_in_default: bool,
    pub max_sse: f32,
    pub color: u32,
    pub metalness: f32,
    pub roughness: f32,
    pub reflectivity: f32,
    pub water: bool,
    pub water_scale_normal: f32,
    pub water_speed: f32,
    pub shininess: f32,
    pub specular_strength: f32,
    pub apply_water_normal: bool,
    pub specular: bool,
    pub ior: f32,
    // animation
    pub animation_active_clip: Option<String>,
    pub animation_speed: Option<f32>,
    pub point_size: f32,
    pub show_bounding_box: bool,
    pub internal: Option<ModelInternalMaterial>,
    // post effect
    pub effect_ids: Option<Vec<String>>,
    /// Depth behavior for selective effect mask passes: "normal" or "silhouette"
    pub selective_effect_occlusion: Option<String>,
    pub emissive_intensity: Option<f32>,
    pub emissive_color: Option<u32>,
}

impl Default for ModelMaterial {
    fn default() -> Self {
        Self {
            show: true,
            cast_shadow: false,
            receive_shadow: false,
            size: 1.,
            clamp_to_ground: true,
            height: 1.,
            url: "".to_string(),
            should_rotate_in_default: true,
            max_sse: 16.,
            color: 0xffffff,
            metalness: 0.0,
            roughness: 1.0,
            reflectivity: 0.0,
            water: false,
            water_scale_normal: 0.01,
            water_speed: 0.0003,
            shininess: 100.0,
            specular_strength: 2.0,
            apply_water_normal: false,
            specular: false,
            ior: 1.33333,
            // animation
            animation_active_clip: None,
            animation_speed: None,
            point_size: 0.3,
            show_bounding_box: false,
            internal: None,
            // post effect
            effect_ids: None,
            selective_effect_occlusion: None,
            emissive_intensity: None,
            emissive_color: None,
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

#[derive(Debug, Clone, PartialEq)]
pub struct ModelInternalMaterial {
    pub point_cloud: bool,
    pub draco_compressed: bool,
    pub point_cloud_geodetic_normal: Vec3,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct VectorTileMaterial {
    pub show: bool,
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub max_sse: f32,
    pub max_zoom: usize,
    pub layers: Option<Vec<String>>,
    pub overscaled_max_zoom: usize,
}

impl Default for VectorTileMaterial {
    fn default() -> Self {
        Self {
            show: true,
            cast_shadow: false,
            receive_shadow: false,
            max_sse: 2.,
            max_zoom: 20,
            layers: None,
            overscaled_max_zoom: 24, // Allow overscaling up to zoom level 24 by default
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTileMaterial {
    pub show: bool,
    pub color: u32,
    pub opacity: f32,
    pub max_zoom: usize,
    pub min_zoom: usize,
    pub tms: bool,
    pub show_bounding_box: bool,
}

impl Default for RasterTileMaterial {
    fn default() -> Self {
        Self {
            show: true,
            color: 0xffffff,
            opacity: 1.,
            max_zoom: 20,
            min_zoom: 0,
            tms: false,
            show_bounding_box: false,
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
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub show_bounding_box: Option<bool>,

    // Elevation Heatmap fields
    pub is_elevation_heatmaps: Vec<bool>, // Per-layer flags: which texture slots are elevation heatmaps
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>, // Shared config for all heatmap layers

    // Hillshade fields
    pub is_hillshades: Vec<bool>, // Per-layer flags: which texture slots are hillshades
    pub hillshade_config: Option<HillshadeConfig>, // Shared config for all hillshade layers
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTerrainMaterial {
    pub show: bool,
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub show_bounding_box: bool,
    pub max_zoom: usize,
    pub min_zoom: usize,
    pub elevation_decoder: ElevationDecoder,
    pub tile_size: u32,
    pub overscaled_max_zoom: usize,
    /// Whether to render skirts along tile boundaries to hide gaps.
    pub skirt: bool,
    /// Multiplier for the automatically calculated skirt height.
    /// A value of 1.0 uses the default calculated height.
    pub skirt_exaggeration: f32,
}

impl Default for RasterTerrainMaterial {
    fn default() -> Self {
        Self {
            show: true,
            cast_shadow: false,
            receive_shadow: false,
            show_bounding_box: false,
            max_zoom: 20,
            min_zoom: 0,
            elevation_decoder: ElevationDecoder::default(),
            tile_size: 256,
            overscaled_max_zoom: 24,
            skirt: true,
            skirt_exaggeration: 1.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct EllipsoidTerrainMaterial {
    pub cast_shadow: bool,
    pub receive_shadow: bool,
    pub show_bounding_box: bool,
    pub max_zoom: usize,
    pub min_zoom: usize,
}

impl Default for EllipsoidTerrainMaterial {
    fn default() -> Self {
        Self {
            cast_shadow: false,
            receive_shadow: false,
            show_bounding_box: false,
            max_zoom: 20,
            min_zoom: 0,
        }
    }
}
