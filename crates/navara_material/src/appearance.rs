use bevy_ecs::{component::Component, entity::Entity};
use navara_core::{calc_transform, ElevationDecoder, CRS};
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

    pub fn merge(&self, other: &Appearance) -> Appearance {
        match (self, other) {
            (Appearance::Point(dist), Appearance::Point(src)) => {
                Appearance::Point(dist.merge(src))
            }
            (Appearance::Billboard(dist), Appearance::Billboard(src)) => {
                Appearance::Billboard(dist.merge(src))
            }
            (Appearance::Text(dist), Appearance::Text(src)) => {
                Appearance::Text(dist.merge(src))
            }
            (Appearance::Polyline(dist), Appearance::Polyline(src)) => {
                Appearance::Polyline(dist.merge(src))
            }
            (Appearance::Polygon(dist), Appearance::Polygon(src)) => {
                Appearance::Polygon(dist.merge(src))
            }
            (Appearance::Model(dist), Appearance::Model(src)) => {
                Appearance::Model(dist.merge(src))
            }
            (Appearance::VectorTile(dist), Appearance::VectorTile(src)) => {
                Appearance::VectorTile(dist.merge(src))
            }
            (Appearance::RasterTile(dist), Appearance::RasterTile(src)) => {
                Appearance::RasterTile(dist.merge(src))
            }
            _ => other.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PointMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    /// near, far
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    pub offset_depth: Option<bool>,
    // Allow transparency and anti-aliasing.
    pub transparent: Option<bool>,
}

impl Default for PointMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            size: Some(0.1),
            color: Some(0xffffff),
            center: Some(Vec2::new(0.5, 0.)),
            clamp_to_ground: Some(true),
            height: Some(1.),
            scale_by_distance: Some(true),
            depth_test: Some(true),
            offset_depth: Some(true),
            transparent: Some(true),
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
            *transform = calc_transform(coordinates, crs, self.height.unwrap(), self.size.unwrap(), false);
        }
    }

    pub fn merge(&self, from: &PointMaterial) -> PointMaterial {
        let result = PointMaterial {
            show: self.show.or(from.show),
            size: self.size.or(from.size),
            color: self.color.or(from.color),
            center: self.center.or(from.center),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            height: self.height.or(from.height),
            scale_by_distance: self.scale_by_distance.or(from.scale_by_distance),
            depth_test: self.depth_test.or(from.depth_test),
            offset_depth: self.offset_depth.or(from.offset_depth),
            transparent: self.transparent.or(from.transparent),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct BillboardMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    pub url: Option<String>,
    /// near, far
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    pub offset_depth: Option<bool>,
    // Allow transparency and anti-aliasing.
    pub transparent: Option<bool>,
    pub alpha_test: Option<f32>,
}

impl Default for BillboardMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            size: Some(0.1),
            color: Some(0xffffff),
            center: Some(Vec2::new(0.5, 0.)),
            clamp_to_ground: Some(true),
            height: Some(1.),
            url: Some("".to_string()),
            scale_by_distance: Some(true),
            depth_test: Some(true),
            offset_depth: Some(true),
            transparent: Some(false),
            alpha_test: Some(0.1),
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
            *transform = calc_transform(coordinates, crs, self.height.unwrap(), self.size.unwrap(), false);
        }
    }

    pub fn merge(&self, from: &BillboardMaterial) -> BillboardMaterial {
        let result = BillboardMaterial {
            show: self.show.or(from.show),
            size: self.size.or(from.size),
            color: self.color.or(from.color),
            center: self.center.or(from.center),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            height: self.height.or(from.height),
            url: self.url.clone().or(from.url.clone()),
            scale_by_distance: self.scale_by_distance.or(from.scale_by_distance),
            depth_test: self.depth_test.or(from.depth_test),
            offset_depth: self.offset_depth.or(from.offset_depth),
            transparent: self.transparent.or(from.transparent),
            alpha_test: self.alpha_test.or(from.alpha_test),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct TextMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    /// near, far
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    pub offset_depth: Option<bool>,
    pub text: Option<String>,
    pub font: Option<String>,
    pub background_color: Option<u32>,
    pub border_color: Option<u32>,
    pub border_width: Option<f32>,  // 0 ~ 0.5, the ratio of the border to the height
    pub corner_radius: Option<f32>, // 0 ~ 0.5, the ratio of the corner radius to the height
    pub padding: Option<Vec2>,
    // outline
    pub outline_blur: Option<f32>,    // outlineBlur Defalut: 0
    pub outline_color: Option<u32>,   // outlineColor Defalut: black
    pub outline_offset: Option<Vec2>, // outlineOffset Default: (0,0)
    pub outline_opacity: Option<f32>, // outlineOpacity Default: 1
    pub outline_width: Option<f32>,   // outlineWidth Default: 0
}

impl Default for TextMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            size: Some(10.0),
            color: Some(0xffffff),
            center: Some(Vec2::new(0.5, 0.)),
            clamp_to_ground: Some(true),
            height: Some(1.),
            scale_by_distance: Some(true),
            depth_test: Some(true),
            offset_depth: Some(true),
            text: Some("".to_string()),
            font: Some("".to_string()),
            background_color: None,
            border_color: Some(0x000000),
            border_width: Some(0.05),
            corner_radius: Some(0.1),
            padding: Some(Vec2::new(5.0, 2.0)),
            outline_blur: Some(0.0),
            outline_color: Some(0x000000),
            outline_offset: Some(Vec2::new(0.0, 0.0)),
            outline_opacity: Some(1.0),
            outline_width: Some(0.0),
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
            *transform = calc_transform(coordinates, crs, self.height.unwrap(), self.size.unwrap(), false);
        }
    }

    pub fn merge(&self, from: &TextMaterial) -> TextMaterial {
        let result = TextMaterial {
            show: self.show.or(from.show),
            size: self.size.or(from.size),
            color: self.color.or(from.color),
            center: self.center.or(from.center),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            height: self.height.or(from.height),
            scale_by_distance: self.scale_by_distance.or(from.scale_by_distance),
            depth_test: self.depth_test.or(from.depth_test),
            offset_depth: self.offset_depth.or(from.offset_depth),
            text: self.text.clone().or(from.text.clone()),
            font: self.font.clone().or(from.font.clone()),
            background_color: self.background_color.or(from.background_color),
            border_color: self.border_color.or(from.border_color),
            border_width: self.border_width.or(from.border_width),
            corner_radius: self.corner_radius.or(from.corner_radius),
            padding: self.padding.or(from.padding),
            outline_blur: self.outline_blur.or(from.outline_blur),
            outline_color: self.outline_color.or(from.outline_color),
            outline_offset: self.outline_offset.or(from.outline_offset),
            outline_opacity: self.outline_opacity.or(from.outline_opacity),
            outline_width: self.outline_width.or(from.outline_width),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub color: Option<u32>,
    pub width: Option<f32>,
    pub clamp_to_ground: Option<bool>,
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    pub internal: Option<PolylineInternalMaterial>,
}

impl Default for PolylineMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            color: Some(0xffffff),
            width: Some(1.0),
            clamp_to_ground: Some(true),
            use_ground_normals: Some(false),
            height: Some(1.0),
            internal: None,
        }
    }
}

impl PolylineMaterial {
    pub fn update(&mut self, from: &PolylineMaterial) {
        let internal = self.internal.take();
        *self = from.clone();
        self.internal = internal;
    }
    pub fn merge(&self, from: &PolylineMaterial) -> PolylineMaterial {
        let result = PolylineMaterial {
            show: self.show.or(from.show),
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            color: self.color.or(from.color),
            width: self.width.or(from.width),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            use_ground_normals: self.use_ground_normals.or(from.use_ground_normals),
            height: self.height.or(from.height),
            internal: self.internal.clone(),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolylineInternalMaterial {
    pub min_max_heights: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub color: Option<u32>,
    pub clamp_to_ground: Option<bool>,
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    pub extruded_height: Option<f32>,
    pub wireframe: Option<bool>,
    pub reflectivity: Option<f32>,
    pub roughness: Option<f32>,
    pub internal: Option<PolygonInternalMaterial>,
    pub per_position_height: Option<bool>,
    pub opacity: Option<f32>,
    pub transparent: Option<bool>,

    pub surface_show: Option<bool>,
    pub outline_show: Option<bool>,
    pub outline_color: Option<u32>,
    pub outline_width: Option<f32>,

    pub water: Option<bool>,
    pub water_scale_normal: Option<f32>,
    pub water_speed: Option<f32>,
    pub shininess: Option<f32>,
    pub specular_strength: Option<f32>,
    pub apply_water_normal: Option<bool>,
    pub specular: Option<bool>,
    pub ior: Option<f32>,
}

impl Default for PolygonMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            color: Some(0xffffff),
            clamp_to_ground: Some(true),
            use_ground_normals: Some(false),
            height: Some(1.0),
            extruded_height: None,
            wireframe: Some(false),
            reflectivity: Some(0.0),
            roughness: Some(0.0),
            internal: None,
            per_position_height: Some(false),
            opacity: Some(1.0),
            transparent: Some(false),
            surface_show: Some(true),
            outline_show: Some(false),
            outline_color: Some(0xffffff),
            outline_width: Some(1.0),
            water: Some(false),
            water_scale_normal: Some(0.1),
            water_speed: Some(0.0003),
            shininess: Some(100.0),
            specular_strength: Some(2.0),
            apply_water_normal: Some(false),
            specular: Some(false),
            ior: Some(1.33333),
        }
    }
}

impl PolygonMaterial {
    pub fn update(&mut self, from: &PolygonMaterial) {
        let internal = self.internal.clone();
        *self = from.clone();
        self.internal = internal;
    }

    pub fn merge(&self, from: &PolygonMaterial) -> PolygonMaterial {
        let result = PolygonMaterial {
            show: self.show.or(from.show),
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            color: self.color.or(from.color),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            use_ground_normals: self.use_ground_normals.or(from.use_ground_normals),
            height: self.height.or(from.height),
            extruded_height: self.extruded_height.or(from.extruded_height),
            wireframe: self.wireframe.or(from.wireframe),
            reflectivity: self.reflectivity.or(from.reflectivity),
            roughness: self.roughness.or(from.roughness),
            internal: self.internal.clone(),
            per_position_height: self.per_position_height.or(from.per_position_height),
            opacity: self.opacity.or(from.opacity),
            transparent: self.transparent.or(from.transparent),
            surface_show: self.surface_show.or(from.surface_show),
            outline_show: self.outline_show.or(from.outline_show),
            outline_color: self.outline_color.or(from.outline_color),
            outline_width: self.outline_width.or(from.outline_width),
            water: self.water.or(from.water),
            water_scale_normal: self.water_scale_normal.or(from.water_scale_normal),
            water_speed: self.water_speed.or(from.water_speed),
            shininess: self.shininess.or(from.shininess),
            specular_strength: self.specular_strength.or(from.specular_strength),
            apply_water_normal: self.apply_water_normal.or(from.apply_water_normal),
            specular: self.specular.or(from.specular),
            ior: self.ior.or(from.ior),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolygonInternalMaterial {
    pub min_max_heights: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show:Option<bool>,
    pub cast_shadow:Option<bool>,
    pub receive_shadow:Option<bool>,
    pub url:Option<String>,
    pub size:Option<f32>,
    pub height:Option<f32>,
    pub clamp_to_ground:Option<bool>,
    pub should_rotate_in_default:Option<bool>,
    pub max_sse:Option<f32>,
    pub color:Option<u32>,
    pub metalness:Option<f32>,
    pub roughness:Option<f32>,
    pub reflectivity:Option<f32>,
    pub water:Option<bool>,
    pub water_scale_normal:Option<f32>,
    pub water_speed:Option<f32>,
    pub shininess:Option<f32>,
    pub specular_strength:Option<f32>,
    pub apply_water_normal:Option<bool>,
    pub specular:Option<bool>,
    pub ior:Option<f32>,
    // animation
    pub animation_active_clip: Option<String>,
    pub animation_speed: Option<f32>,
    pub point_size: Option<f32>,
    pub show_bounding_box: Option<bool>,
    pub internal: Option<ModelInternalMaterial>,
}

impl Default for ModelMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            size: Some(1.),
            clamp_to_ground: Some(true),
            height: Some(1.),
            url: Some("".to_string()),
            should_rotate_in_default: Some(true),
            max_sse: Some(16.),
            color: Some(0xffffff),
            metalness: Some(0.0),
            roughness: Some(1.0),
            reflectivity: Some(0.0),
            water: Some(false),
            water_scale_normal: Some(0.01),
            water_speed: Some(0.0003),
            shininess: Some(100.0),
            specular_strength: Some(2.0),
            apply_water_normal: Some(false),
            specular: Some(false),
            ior: Some(1.33333),
            // animation
            animation_active_clip: None,
            animation_speed: None,
            point_size: Some(0.3),
            show_bounding_box: Some(false),
            internal: None,
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
                self.height.unwrap(),
                self.size.unwrap(),
                self.should_rotate_in_default.unwrap(),
            );
        }
    }

    pub fn merge(&self, from: &ModelMaterial) -> ModelMaterial {
        let result = ModelMaterial {
            show: self.show.or(from.show),
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            url: self.url.clone().or(from.url.clone()),
            size: self.size.or(from.size),
            height: self.height.or(from.height),
            clamp_to_ground: self.clamp_to_ground.or(from.clamp_to_ground),
            should_rotate_in_default: self
                .should_rotate_in_default
                .or(from.should_rotate_in_default),
            max_sse: self.max_sse.or(from.max_sse),
            color: self.color.or(from.color),
            metalness: self.metalness.or(from.metalness),
            roughness: self.roughness.or(from.roughness),
            reflectivity: self.reflectivity.or(from.reflectivity),
            water: self.water.or(from.water),
            water_scale_normal: self.water_scale_normal.or(from.water_scale_normal),
            water_speed: self.water_speed.or(from.water_speed),
            shininess: self.shininess.or(from.shininess),
            specular_strength: self.specular_strength.or(from.specular_strength),
            apply_water_normal: self.apply_water_normal.or(from.apply_water_normal),
            specular: self.specular.or(from.specular),
            ior: self.ior.or(from.ior),
            // animation
            animation_active_clip: self
                .animation_active_clip
                .clone()
                .or(from.animation_active_clip.clone()),
            animation_speed: self.animation_speed.or(from.animation_speed),
            point_size: self.point_size.or(from.point_size),
            show_bounding_box: self.show_bounding_box.or(from.show_bounding_box),
            internal: self.internal.clone(),
        };
        result
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
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub max_sse: Option<f32>,
    pub max_zoom: Option<usize>,
    pub layers: Option<Vec<String>>,
    pub overscaled_max_zoom: Option<usize>,
}

impl Default for VectorTileMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            max_sse: Some(2.),
            max_zoom: Some(20),
            layers: None,
            overscaled_max_zoom: Some(24), // Allow overscaling up to zoom level 24 by default
        }
    }
}

impl VectorTileMaterial {
    pub fn merge(&self, from: &VectorTileMaterial) -> VectorTileMaterial {
        let result = VectorTileMaterial {
            show: self.show.or(from.show),
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            max_sse: self.max_sse.or(from.max_sse),
            max_zoom: self.max_zoom.or(from.max_zoom),
            layers: self.layers.clone().or(from.layers.clone()),
            overscaled_max_zoom: self.overscaled_max_zoom.or(from.overscaled_max_zoom),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTileMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
    pub tms: Option<bool>,
    pub show_bounding_box: Option<bool>,
}

impl Default for RasterTileMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            color: Some(0xffffff),
            opacity: Some(1.),
            max_zoom: Some(20),
            min_zoom: Some(0),
            tms: Some(false),
            show_bounding_box: Some(false),
        }
    }
}

impl RasterTileMaterial {
    pub fn merge(&self, from: &RasterTileMaterial) -> RasterTileMaterial {
        let result = RasterTileMaterial {
            show: self.show.or(from.show),
            color: self.color.or(from.color),
            opacity: self.opacity.or(from.opacity),
            max_zoom: self.max_zoom.or(from.max_zoom),
            min_zoom: self.min_zoom.or(from.min_zoom),
            tms: self.tms.or(from.tms),
            show_bounding_box: self.show_bounding_box.or(from.show_bounding_box),
        };
        result
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
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct RasterTerrainMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub show_bounding_box: Option<bool>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
    pub elevation_decoder: Option<ElevationDecoder>,
    pub tile_size: Option<u32>,
    pub overscaled_max_zoom: Option<usize>,
    /// Whether to render skirts along tile boundaries to hide gaps.
    pub skirt: Option<bool>,
    /// Multiplier for the automatically calculated skirt height.
    /// A value of 1.0 uses the default calculated height.
    pub skirt_exaggeration: Option<f32>,
}

impl Default for RasterTerrainMaterial {
    fn default() -> Self {
        Self {
            show: Some(true),
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            show_bounding_box: Some(false),
            max_zoom: Some(20),
            min_zoom: Some(0),
            elevation_decoder: Some(ElevationDecoder::default()),
            tile_size: Some(256),
            overscaled_max_zoom: Some(24),
            skirt: Some(true),
            skirt_exaggeration: Some(1.0),
        }
    }
}

impl RasterTerrainMaterial {
    pub fn merge(&self, from: &RasterTerrainMaterial) -> RasterTerrainMaterial {
        let result = RasterTerrainMaterial {
            show: self.show.or(from.show),
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            show_bounding_box: self.show_bounding_box.or(from.show_bounding_box),
            max_zoom: self.max_zoom.or(from.max_zoom),
            min_zoom: self.min_zoom.or(from.min_zoom),
            elevation_decoder: self.elevation_decoder.clone().or(from.elevation_decoder.clone()),
            tile_size: self.tile_size.or(from.tile_size),
            overscaled_max_zoom: self.overscaled_max_zoom.or(from.overscaled_max_zoom),
            skirt: self.skirt.or(from.skirt),
            skirt_exaggeration: self.skirt_exaggeration.or(from.skirt_exaggeration),
        };
        result
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct EllipsoidTerrainMaterial {
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub show_bounding_box: Option<bool>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
}

impl Default for EllipsoidTerrainMaterial {
    fn default() -> Self {
        Self {
            cast_shadow: Some(false),
            receive_shadow: Some(false),
            show_bounding_box: Some(false),
            max_zoom: Some(20),
            min_zoom: Some(0),
        }
    }
}

impl EllipsoidTerrainMaterial {
    pub fn merge(&self, from: &EllipsoidTerrainMaterial) -> EllipsoidTerrainMaterial {
        EllipsoidTerrainMaterial {
            cast_shadow: self.cast_shadow.or(from.cast_shadow),
            receive_shadow: self.receive_shadow.or(from.receive_shadow),
            show_bounding_box: self.show_bounding_box.or(from.show_bounding_box),
            max_zoom: self.max_zoom.or(from.max_zoom),
            min_zoom: self.min_zoom.or(from.min_zoom),
        }
    }
}
