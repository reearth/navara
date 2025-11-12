use navara_wasm_utils::ToU8;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{ElevationDecoder, TextureFragment, Vec2};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    pub transparent: Option<bool>,
}

impl From<PointMaterial> for navara_material::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        let default = navara_material::PointMaterial::default();
        navara_material::PointMaterial {
            show: val.show.unwrap_or(default.show),
            size: val.size.unwrap_or(default.size),
            color: val.color.unwrap_or(default.color),
            center: val.center.unwrap_or(default.center.into()).into(),
            height: val.height.unwrap_or(default.height),
            scale_by_distance: val.scale_by_distance.unwrap_or(default.scale_by_distance),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            transparent: val.transparent.unwrap_or(default.transparent),
        }
    }
}
impl<'a> From<&'a navara_material::PointMaterial> for PointMaterial {
    fn from(value: &'a navara_material::PointMaterial) -> PointMaterial {
        PointMaterial {
            show: Some(value.show),
            size: Some(value.size),
            color: Some(value.color),
            center: Some(value.center.into()),
            height: Some(value.height),
            scale_by_distance: Some(value.scale_by_distance),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            transparent: Some(value.transparent),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearFar {
    pub near: f32,
    pub far: f32,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillboardMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    pub transparent: Option<bool>,
    pub alpha_test: Option<f32>,
}

impl From<BillboardMaterial> for navara_material::BillboardMaterial {
    fn from(val: BillboardMaterial) -> Self {
        let default = navara_material::BillboardMaterial::default();
        navara_material::BillboardMaterial {
            show: val.show.unwrap_or(default.show),
            size: val.size.unwrap_or(default.size),
            color: val.color.unwrap_or(default.color),
            center: val.center.unwrap_or(default.center.into()).into(),
            height: val.height.unwrap_or(default.height),
            url: val.url.unwrap_or(default.url),
            scale_by_distance: val.scale_by_distance.unwrap_or(default.scale_by_distance),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            transparent: val.transparent.unwrap_or(default.transparent),
            alpha_test: val.alpha_test.unwrap_or(default.alpha_test),
        }
    }
}
impl<'a> From<&'a navara_material::BillboardMaterial> for BillboardMaterial {
    fn from(value: &'a navara_material::BillboardMaterial) -> BillboardMaterial {
        BillboardMaterial {
            show: Some(value.show),
            size: Some(value.size),
            color: Some(value.color),
            center: Some(value.center.into()),
            height: Some(value.height),
            url: Some(value.url.clone()),
            scale_by_distance: Some(value.scale_by_distance),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            transparent: Some(value.transparent),
            alpha_test: Some(value.alpha_test),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: Option<bool>,
    pub depth_test: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub text: Option<String>,
    /// Specify URL for font file. Supported files are ttf, otf and woff. Default is `Roboto`.
    #[wasm_bindgen(getter_with_clone)]
    pub font: Option<String>,
    pub background_color: Option<u32>,
    pub border_color: Option<u32>,
    pub border_width: Option<f32>,
    pub corner_radius: Option<f32>,
    pub padding: Option<Vec2>,
    // outline
    /// Outline blur radius in CSS pixels. Defaults to `0.0`.
    pub outline_blur: Option<f32>,
    pub outline_color: Option<u32>, // outlineColor Defalut:black
    /// Pixel offset `[x, y]` in CSS pixels. Defaults to `(0.0, 0.0)`.
    pub outline_offset: Option<Vec2>,
    pub outline_opacity: Option<f32>, // outlineOpacity Default:1
    /// Outline thickness measured in CSS pixels. Defaults to `0.0`.
    pub outline_width: Option<f32>,
}

impl From<TextMaterial> for navara_material::TextMaterial {
    fn from(val: TextMaterial) -> Self {
        let default = navara_material::TextMaterial::default();
        navara_material::TextMaterial {
            show: val.show.unwrap_or(default.show),
            size: val.size.unwrap_or(default.size),
            color: val.color.unwrap_or(default.color),
            center: val.center.unwrap_or(default.center.into()).into(),
            height: val.height.unwrap_or(default.height),
            scale_by_distance: val.scale_by_distance.unwrap_or(default.scale_by_distance),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            text: val.text.unwrap_or(default.text),
            font: val.font.unwrap_or(default.font),
            background_color: val.background_color,
            border_color: val.border_color.unwrap_or(default.border_color),
            border_width: val.border_width.unwrap_or(default.border_width),
            corner_radius: val.corner_radius.unwrap_or(default.corner_radius),
            padding: val.padding.unwrap_or(default.padding.into()).into(),
            outline_blur: val.outline_blur.unwrap_or(default.outline_blur),
            outline_color: val.outline_color.unwrap_or(default.outline_color),
            outline_offset: val
                .outline_offset
                .unwrap_or(default.outline_offset.into())
                .into(),
            outline_opacity: val.outline_opacity.unwrap_or(default.outline_opacity),
            outline_width: val.outline_width.unwrap_or(default.outline_width),
        }
    }
}
impl<'a> From<&'a navara_material::TextMaterial> for TextMaterial {
    fn from(value: &'a navara_material::TextMaterial) -> TextMaterial {
        TextMaterial {
            show: Some(value.show),
            size: Some(value.size),
            color: Some(value.color),
            center: Some(value.center.into()),
            height: Some(value.height),
            scale_by_distance: Some(value.scale_by_distance),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            text: Some(value.text.clone()),
            font: Some(value.font.clone()),
            background_color: value.background_color,
            border_color: Some(value.border_color),
            border_width: Some(value.border_width),
            corner_radius: Some(value.corner_radius),
            padding: Some(value.padding.into()),
            outline_blur: Some(value.outline_blur),
            outline_color: Some(value.outline_color),
            outline_offset: Some(value.outline_offset.into()),
            outline_opacity: Some(value.outline_opacity),
            outline_width: Some(value.outline_width),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub color: Option<u32>,
    pub width: Option<f32>,
    pub clamp_to_ground: Option<bool>,
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolylineInternalMaterial>,
}

#[wasm_bindgen]
impl PolylineMaterial {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        show: Option<bool>,
        cast_shadow: Option<bool>,
        receive_shadow: Option<bool>,
        color: Option<u32>,
        clamp_to_ground: Option<bool>,
        use_ground_normals: Option<bool>,
        height: Option<f32>,
        width: Option<f32>,
        __internal__: Option<PolylineInternalMaterial>,
    ) -> Self {
        Self {
            show,
            cast_shadow,
            receive_shadow,
            color,
            clamp_to_ground,
            use_ground_normals,
            height,
            width,
            __internal__,
        }
    }
}

impl From<PolylineMaterial> for navara_material::PolylineMaterial {
    fn from(val: PolylineMaterial) -> Self {
        let default = navara_material::PolylineMaterial::default();
        navara_material::PolylineMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            color: val.color.unwrap_or(default.color),
            width: val.width.unwrap_or(default.width),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            use_ground_normals: val.use_ground_normals.unwrap_or(default.use_ground_normals),
            height: val.height.unwrap_or(default.height),
            internal: val.__internal__.map(|v| v.into()),
        }
    }
}
impl<'a> From<&'a navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_material::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            color: Some(value.color),
            width: Some(value.width),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            __internal__: value.internal.as_ref().map(|v| v.into()),
        }
    }
}

impl From<navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: navara_material::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            color: Some(value.color),
            width: Some(value.width),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            __internal__: value.internal.map(|v| v.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub min_max_heights: Vec<f64>,
}

impl From<PolylineInternalMaterial> for navara_material::PolylineInternalMaterial {
    fn from(val: PolylineInternalMaterial) -> Self {
        navara_material::PolylineInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}
impl From<&navara_material::PolylineInternalMaterial> for PolylineInternalMaterial {
    fn from(val: &navara_material::PolylineInternalMaterial) -> Self {
        PolylineInternalMaterial {
            min_max_heights: val.min_max_heights.clone(),
        }
    }
}

impl From<navara_material::PolylineInternalMaterial> for PolylineInternalMaterial {
    fn from(val: navara_material::PolylineInternalMaterial) -> Self {
        PolylineInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    /// Reflectivity for post-process or env map.
    pub reflectivity: Option<f32>,
    /// Reflectivity for post-process.
    pub roughness: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolygonInternalMaterial>,

    /// Whether or not the height is obtained from the data. If false, the height is constant.
    pub per_position_height: Option<bool>,
    /// Need to enable `transparent`.
    pub opacity: Option<f32>,
    /// Enable `opacity`. It might cause unexpected behavior when you use an effect layer.
    pub transparent: Option<bool>,

    /// Currently, this property is supported only in GeoJSON.
    pub surface_show: Option<bool>,
    /// Currently, this property is supported only in GeoJSON.
    pub outline_show: Option<bool>,
    /// Currently, this property is supported only in GeoJSON.
    pub outline_color: Option<u32>,
    /// Currently, this property is supported only in GeoJSON.
    pub outline_width: Option<f32>,

    /// Apply a water material on the polygon. It might slow down the loading of the mesh.
    pub water: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub water_normal_url: Option<String>,
    /// Scale water normal. Decreasing this value will make the water surface rough.
    pub water_scale_normal: Option<f32>,
    /// Water wave speed.
    pub water_speed: Option<f32>,
    pub shininess: Option<f32>,
    pub specular_strength: Option<f32>,
    pub apply_water_normal: Option<bool>,
    /// Enabling this value allows using `shininess` and `specular_strength`.
    pub specular: Option<bool>,
    pub ior: Option<f32>,
}

#[wasm_bindgen]
impl PolygonMaterial {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        show: Option<bool>,
        cast_shadow: Option<bool>,
        receive_shadow: Option<bool>,
        color: Option<u32>,
        clamp_to_ground: Option<bool>,
        use_ground_normals: Option<bool>,
        height: Option<f32>,
        extruded_height: Option<f32>,
        wireframe: Option<bool>,
        per_position_height: Option<bool>,
        __internal__: Option<PolygonInternalMaterial>,
    ) -> Self {
        Self {
            show,
            cast_shadow,
            receive_shadow,
            color,
            clamp_to_ground,
            use_ground_normals,
            height,
            extruded_height,
            wireframe,
            reflectivity: None,
            roughness: None,
            __internal__,

            per_position_height,
            opacity: None,
            transparent: None,

            surface_show: None,
            outline_show: None,
            outline_color: None,
            outline_width: None,

            // These are unnecessary for polygon geometry construction.
            water: None,
            water_normal_url: None,
            water_scale_normal: None,
            water_speed: None,
            shininess: None,
            specular_strength: None,
            apply_water_normal: None,
            specular: None,
            ior: None,
        }
    }
}

impl From<PolygonMaterial> for navara_material::PolygonMaterial {
    fn from(val: PolygonMaterial) -> Self {
        let default = navara_material::PolygonMaterial::default();
        navara_material::PolygonMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            color: val.color.unwrap_or(default.color),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            use_ground_normals: val.use_ground_normals.unwrap_or(default.use_ground_normals),
            height: val.height.unwrap_or(default.height),
            extruded_height: val.extruded_height,
            wireframe: val.wireframe.unwrap_or(default.wireframe),
            reflectivity: val.reflectivity.unwrap_or(default.reflectivity),
            roughness: val.roughness.unwrap_or(default.reflectivity),
            internal: val.__internal__.map(|v| v.into()),

            per_position_height: val
                .per_position_height
                .unwrap_or(default.per_position_height),
            opacity: val.opacity.unwrap_or(default.opacity),
            transparent: val.transparent.unwrap_or(default.transparent),

            surface_show: val.surface_show.unwrap_or(default.surface_show),
            outline_show: val.outline_show.unwrap_or(default.outline_show),
            outline_color: val.outline_color.unwrap_or(default.outline_color),
            outline_width: val.outline_width.unwrap_or(default.outline_width),
            water: val.water.unwrap_or(default.water),
            water_normal_url: val.water_normal_url,
            water_scale_normal: val.water_scale_normal.unwrap_or(default.water_scale_normal),
            water_speed: val.water_speed.unwrap_or(default.water_speed),
            shininess: val.shininess.unwrap_or(default.shininess),
            specular_strength: val.specular_strength.unwrap_or(default.specular_strength),
            apply_water_normal: val.apply_water_normal.unwrap_or(default.apply_water_normal),
            specular: val.specular.unwrap_or(default.specular),
            ior: val.ior.unwrap_or(default.ior),
        }
    }
}
impl<'a> From<&'a navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            color: Some(value.color),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            extruded_height: value.extruded_height,
            wireframe: Some(value.wireframe),
            reflectivity: Some(value.reflectivity),
            roughness: Some(value.roughness),
            __internal__: value.internal.as_ref().map(|v| v.into()),

            per_position_height: Some(value.per_position_height),
            opacity: Some(value.opacity),
            transparent: Some(value.transparent),

            surface_show: Some(value.surface_show),
            outline_show: Some(value.outline_show),
            outline_color: Some(value.outline_color),
            outline_width: Some(value.outline_width),
            water: Some(value.water),
            water_normal_url: value.water_normal_url.clone(),
            water_scale_normal: Some(value.water_scale_normal),
            water_speed: Some(value.water_speed),
            shininess: Some(value.shininess),
            specular_strength: Some(value.specular_strength),
            apply_water_normal: Some(value.apply_water_normal),
            specular: Some(value.specular),
            ior: Some(value.ior),
        }
    }
}
impl From<navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            color: Some(value.color),
            clamp_to_ground: Some(value.clamp_to_ground),
            use_ground_normals: Some(value.use_ground_normals),
            height: Some(value.height),
            extruded_height: value.extruded_height,
            wireframe: Some(value.wireframe),
            reflectivity: Some(value.reflectivity),
            roughness: Some(value.roughness),
            __internal__: value.internal.map(|v| v.into()),

            per_position_height: Some(value.per_position_height),
            opacity: Some(value.opacity),
            transparent: Some(value.transparent),

            surface_show: Some(value.surface_show),
            outline_show: Some(value.outline_show),
            outline_color: Some(value.outline_color),
            outline_width: Some(value.outline_width),
            water: Some(value.water),
            water_normal_url: value.water_normal_url.clone(),
            water_scale_normal: Some(value.water_scale_normal),
            water_speed: Some(value.water_speed),
            shininess: Some(value.shininess),
            specular_strength: Some(value.specular_strength),
            apply_water_normal: Some(value.apply_water_normal),
            specular: Some(value.specular),
            ior: Some(value.ior),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub min_max_heights: Vec<f64>,
}

impl From<PolygonInternalMaterial> for navara_material::PolygonInternalMaterial {
    fn from(val: PolygonInternalMaterial) -> Self {
        navara_material::PolygonInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}
impl From<&navara_material::PolygonInternalMaterial> for PolygonInternalMaterial {
    fn from(val: &navara_material::PolygonInternalMaterial) -> Self {
        PolygonInternalMaterial {
            min_max_heights: val.min_max_heights.clone(),
        }
    }
}
impl From<navara_material::PolygonInternalMaterial> for PolygonInternalMaterial {
    fn from(val: navara_material::PolygonInternalMaterial) -> Self {
        PolygonInternalMaterial {
            min_max_heights: val.min_max_heights,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub size: Option<f32>,
    pub height: Option<f32>,
    pub max_sse: Option<f32>,
    pub clamp_to_ground: Option<bool>,
    pub should_rotate_in_default: Option<bool>,
    pub color: Option<u32>,
    pub metalness: Option<f32>,
    /// Reflectivity for post-process.
    pub roughness: Option<f32>,
    /// Reflectivity for post-process or env map.
    pub reflectivity: Option<f32>,
    /// Apply a water material on the polygon. It might slow down the loading of the mesh.
    pub water: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub water_normal_url: Option<String>,
    /// Scale water normal. Decreasing this value will make the water surface rough.
    pub water_scale_normal: Option<f32>,
    /// Water wave speed.
    pub water_speed: Option<f32>,
    pub shininess: Option<f32>,
    pub specular_strength: Option<f32>,
    pub apply_water_normal: Option<bool>,
    /// Enabling this value allows using `shininess` and `specular_strength`.
    pub specular: Option<bool>,
    pub ior: Option<f32>,
    // animation
    #[wasm_bindgen(getter_with_clone)]
    pub animation_active_clip: Option<String>,
    pub animation_speed: Option<f32>,
    // Point size for point clouds data.
    pub point_size: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<ModelInternalMaterial>,
}

impl From<ModelMaterial> for navara_material::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        let default = navara_material::ModelMaterial::default();
        navara_material::ModelMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            url: val.url.unwrap_or(default.url),
            size: val.size.unwrap_or(default.size),
            height: val.height.unwrap_or(default.height),
            max_sse: val.max_sse.unwrap_or(default.max_sse),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            should_rotate_in_default: val
                .should_rotate_in_default
                .unwrap_or(default.should_rotate_in_default),
            color: val.color.unwrap_or(default.color),
            metalness: val.metalness.unwrap_or(default.metalness),
            roughness: val.roughness.unwrap_or(default.roughness),
            reflectivity: val.reflectivity.unwrap_or(default.reflectivity),
            water: val.water.unwrap_or(default.water),
            water_normal_url: val.water_normal_url,
            water_scale_normal: val.water_scale_normal.unwrap_or(default.water_scale_normal),
            water_speed: val.water_speed.unwrap_or(default.water_speed),
            shininess: val.shininess.unwrap_or(default.shininess),
            specular_strength: val.specular_strength.unwrap_or(default.specular_strength),
            apply_water_normal: val.apply_water_normal.unwrap_or(default.apply_water_normal),
            specular: val.specular.unwrap_or(default.specular),
            ior: val.ior.unwrap_or(default.ior),
            // animation
            animation_active_clip: val.animation_active_clip,
            animation_speed: val.animation_speed,
            point_size: val.point_size.unwrap_or(default.point_size),
            internal: val.__internal__.clone().map(|v| v.into()),
        }
    }
}

impl<'a> From<&'a navara_material::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_material::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            url: Some(value.url.clone()),
            size: Some(value.size),
            height: Some(value.height),
            max_sse: Some(value.max_sse),
            clamp_to_ground: Some(value.clamp_to_ground),
            should_rotate_in_default: Some(value.should_rotate_in_default),
            color: Some(value.color),
            metalness: Some(value.metalness),
            roughness: Some(value.roughness),
            reflectivity: Some(value.reflectivity),
            water: Some(value.water),
            water_normal_url: value.water_normal_url.clone(),
            water_scale_normal: Some(value.water_scale_normal),
            water_speed: Some(value.water_speed),
            shininess: Some(value.shininess),
            specular_strength: Some(value.specular_strength),
            apply_water_normal: Some(value.apply_water_normal),
            specular: Some(value.specular),
            ior: Some(value.ior),
            // animation
            animation_active_clip: value.animation_active_clip.clone(),
            animation_speed: value.animation_speed,
            point_size: Some(value.point_size),
            __internal__: value.internal.clone().as_ref().map(|v| v.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub point_cloud: bool,
    #[wasm_bindgen(getter_with_clone)]
    pub draco_compressed: bool,
}

impl<'a> From<&'a navara_material::ModelInternalMaterial> for ModelInternalMaterial {
    fn from(value: &'a navara_material::ModelInternalMaterial) -> ModelInternalMaterial {
        ModelInternalMaterial {
            point_cloud: value.point_cloud,
            draco_compressed: value.draco_compressed,
        }
    }
}

impl From<ModelInternalMaterial> for navara_material::ModelInternalMaterial {
    fn from(value: ModelInternalMaterial) -> navara_material::ModelInternalMaterial {
        navara_material::ModelInternalMaterial {
            point_cloud: value.point_cloud,
            draco_compressed: value.draco_compressed,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
    pub tms: Option<bool>,
}

impl From<RasterTileMaterial> for navara_material::RasterTileMaterial {
    fn from(val: RasterTileMaterial) -> Self {
        let default = navara_material::RasterTileMaterial::default();
        navara_material::RasterTileMaterial {
            show: val.show.unwrap_or(default.show),
            color: val.color.unwrap_or(default.color),
            opacity: val.opacity.unwrap_or(default.opacity),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
            tms: val.tms.unwrap_or(default.tms),
        }
    }
}
impl<'a> From<&'a navara_material::RasterTileMaterial> for RasterTileMaterial {
    fn from(value: &'a navara_material::RasterTileMaterial) -> RasterTileMaterial {
        RasterTileMaterial {
            show: Some(value.show),
            color: Some(value.color),
            opacity: Some(value.opacity),
            max_zoom: Some(value.max_zoom),
            min_zoom: Some(value.min_zoom),
            tms: Some(value.tms),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileInternalMaterial {
    #[wasm_bindgen(getter_with_clone)]
    pub shows: Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub colors: Vec<u32>,
    #[wasm_bindgen(getter_with_clone)]
    pub opacities: Vec<f32>,
    texture_fragments: Option<Vec<Option<TextureFragment>>>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,

    // Elevation Heatmap fields
    #[wasm_bindgen(getter_with_clone)]
    pub is_elevation_heatmaps: Vec<u8>,
    // Shared elevation heatmap configuration (all heatmap layers use the same settings)
    pub elevation_min_height: f64,
    pub elevation_max_height: f64,
    pub elevation_r_scaler: f64,
    pub elevation_g_scaler: f64,
    pub elevation_b_scaler: f64,
    pub elevation_boundary: f64,
    pub elevation_max_offset: f64,
    pub elevation_min_offset: f64,
    pub elevation_epsilon: f64,
    pub elevation_offset: f64,

    pub logarithmic: bool,
    pub log_boundary: f64,
}

#[wasm_bindgen]
impl RasterTileInternalMaterial {
    pub fn texture_fragments(&self) -> Option<Vec<JsValue>> {
        self.texture_fragments.as_ref().map(|ts| {
            ts.iter()
                .map(|t| t.clone().map(|t| t.into()).unwrap_or(JsValue::null()))
                .collect()
        })
    }
}

impl<'a> From<&'a navara_material::RasterTileInternalMaterial> for RasterTileInternalMaterial {
    fn from(m: &'a navara_material::RasterTileInternalMaterial) -> Self {
        Self {
            shows: m.shows.iter().map(|s| s.to_u8()).collect(),
            colors: m.colors.clone(),
            opacities: m.opacities.clone(),
            texture_fragments: m.texture_fragments.as_ref().map(|ts| {
                ts.iter()
                    .map(|t| {
                        t.map(|t| TextureFragment {
                            ind: t.index(),
                            gen: t.generation(),
                        })
                    })
                    .collect()
            }),
            cast_shadow: m.cast_shadow,
            receive_shadow: m.receive_shadow,

            // Elevation Heatmap fields
            is_elevation_heatmaps: m.is_elevation_heatmaps.iter().map(|b| b.to_u8()).collect(),
            elevation_min_height: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.min_height)
                .unwrap_or(0.0),
            elevation_max_height: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.max_height)
                .unwrap_or(1000.0),
            elevation_r_scaler: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.r_scaler)
                .unwrap_or(0.0),
            elevation_g_scaler: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.g_scaler)
                .unwrap_or(0.0),
            elevation_b_scaler: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.b_scaler)
                .unwrap_or(0.0),
            elevation_boundary: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.boundary)
                .unwrap_or(0.0),
            elevation_max_offset: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.max_offset)
                .unwrap_or(0.0),
            elevation_min_offset: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.min_offset)
                .unwrap_or(0.0),
            elevation_epsilon: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.epsilon)
                .unwrap_or(1.0),
            elevation_offset: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.elevation_decoder.offset)
                .unwrap_or(0.0),

            logarithmic: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.logarithmic)
                .unwrap_or(false),
            log_boundary: m
                .elevation_heatmap_config
                .as_ref()
                .map(|c| c.log_boundary)
                .unwrap_or(10.0),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorTileMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub max_zoom: Option<usize>,
    /// `Globe.max_sse` would be used to a material that uses `clamp_to_ground`.
    pub max_sse: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub layers: Option<Vec<String>>,
    pub overscaled_max_zoom: Option<usize>,
}

impl From<VectorTileMaterial> for navara_material::VectorTileMaterial {
    fn from(val: VectorTileMaterial) -> Self {
        let default = navara_material::VectorTileMaterial::default();
        navara_material::VectorTileMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            max_sse: val.max_sse.unwrap_or(default.max_sse),
            layers: val.layers.clone(),
            overscaled_max_zoom: val
                .overscaled_max_zoom
                .unwrap_or(default.overscaled_max_zoom),
        }
    }
}
impl<'a> From<&'a navara_material::VectorTileMaterial> for VectorTileMaterial {
    fn from(value: &'a navara_material::VectorTileMaterial) -> VectorTileMaterial {
        VectorTileMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            max_zoom: Some(value.max_zoom),
            max_sse: Some(value.max_sse),
            layers: value.layers.clone(),
            overscaled_max_zoom: Some(value.overscaled_max_zoom),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTerrainMaterial {
    pub show: Option<bool>,
    pub cast_shadow: Option<bool>,
    pub receive_shadow: Option<bool>,
    pub segments: Option<usize>,
    pub max_zoom: Option<usize>,
    pub min_zoom: Option<usize>,
    pub elevation_decoder: Option<ElevationDecoder>,
    pub tile_size: Option<u32>,
}

impl From<RasterTerrainMaterial> for navara_material::RasterTerrainMaterial {
    fn from(val: RasterTerrainMaterial) -> Self {
        let default = navara_material::RasterTerrainMaterial::default();
        navara_material::RasterTerrainMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            segments: val.segments.unwrap_or(default.segments),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
            tile_size: val.tile_size.unwrap_or(default.tile_size),
            elevation_decoder: val
                .elevation_decoder
                .unwrap_or(default.elevation_decoder.into())
                .into(),
        }
    }
}

impl<'a> From<&'a navara_material::RasterTerrainMaterial> for RasterTerrainMaterial {
    fn from(value: &'a navara_material::RasterTerrainMaterial) -> RasterTerrainMaterial {
        RasterTerrainMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            segments: Some(value.segments),
            max_zoom: Some(value.max_zoom),
            min_zoom: Some(value.min_zoom),
            elevation_decoder: Some(ElevationDecoder {
                r_scaler: value.elevation_decoder.r_scaler,
                g_scaler: value.elevation_decoder.g_scaler,
                b_scaler: value.elevation_decoder.b_scaler,
                offset: value.elevation_decoder.offset,
                max_offset: value.elevation_decoder.max_offset,
                min_offset: value.elevation_decoder.min_offset,
                boundary: value.elevation_decoder.boundary,
                epsilon: value.elevation_decoder.epsilon,
            }),
            tile_size: Some(value.tile_size),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElevationHeatmapMaterial {
    pub max_height: Option<f64>,
    pub min_height: Option<f64>,
    pub elevation_decoder: Option<ElevationDecoder>,
    pub logarithmic: bool,
    pub log_boundary: f64,
}
