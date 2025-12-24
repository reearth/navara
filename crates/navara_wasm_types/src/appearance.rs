use navara_wasm_utils::ToU8;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{ElevationDecoder, TextureFragment, Vec2, Vec3 as WasmVec3};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: Option<bool>,
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    #[wasm_bindgen(js_name = scaleByDistance)]
    #[serde(rename = "scaleByDistance")]
    pub scale_by_distance: Option<bool>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = depthTest)]
    #[serde(rename = "depthTest")]
    pub depth_test: Option<bool>,
    /// Avoid overlapping with the globe surface.
    #[wasm_bindgen(js_name = offsetDepth)]
    #[serde(rename = "offsetDepth")]
    pub offset_depth: Option<bool>,
    pub transparent: Option<bool>,
}

impl From<PointMaterial> for navara_material::PointMaterial {
    fn from(val: PointMaterial) -> Self {
        navara_material::PointMaterial {
            show: val.show,
            size: val.size,
            color: val.color,
            center: val.center.map(Into::into),
            height: val.height,
            scale_by_distance: val.scale_by_distance,
            clamp_to_ground: val.clamp_to_ground,
            depth_test: val.depth_test,
            offset_depth: val.offset_depth,
            transparent: val.transparent,
        }
    }
}
impl<'a> From<&'a navara_material::PointMaterial> for PointMaterial {
    fn from(value: &'a navara_material::PointMaterial) -> PointMaterial {
        PointMaterial {
            show: value.show,
            size: value.size,
            color: value.color,
            center: value.center.map(Into::into),
            height: value.height,
            scale_by_distance: value.scale_by_distance,
            clamp_to_ground: value.clamp_to_ground,
            depth_test: value.depth_test,
            offset_depth: value.offset_depth,
            transparent: value.transparent,
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
    #[wasm_bindgen(js_name = scaleByDistance)]
    #[serde(rename = "scaleByDistance")]
    pub scale_by_distance: Option<bool>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = depthTest)]
    #[serde(rename = "depthTest")]
    pub depth_test: Option<bool>,
    /// Avoid overlapping with the globe surface.
    #[wasm_bindgen(js_name = offsetDepth)]
    #[serde(rename = "offsetDepth")]
    pub offset_depth: Option<bool>,
    pub transparent: Option<bool>,
    #[wasm_bindgen(js_name = alphaTest)]
    #[serde(rename = "alphaTest")]
    pub alpha_test: Option<f32>,
}

impl From<BillboardMaterial> for navara_material::BillboardMaterial {
    fn from(val: BillboardMaterial) -> Self {
        navara_material::BillboardMaterial {
            show: val.show,
            size: val.size,
            color: val.color,
            center: val.center.map(Into::into),
            height: val.height,
            url: val.url,
            scale_by_distance: val.scale_by_distance,
            clamp_to_ground: val.clamp_to_ground,
            depth_test: val.depth_test,
            offset_depth: val.offset_depth,
            transparent: val.transparent,
            alpha_test: val.alpha_test,
        }
    }
}
impl<'a> From<&'a navara_material::BillboardMaterial> for BillboardMaterial {
    fn from(value: &'a navara_material::BillboardMaterial) -> BillboardMaterial {
        BillboardMaterial {
            show: value.show,
            size: value.size,
            color: value.color,
            center: value.center.map(Into::into),
            height: value.height,
            url: value.url.clone(),
            scale_by_distance: value.scale_by_distance,
            clamp_to_ground: value.clamp_to_ground,
            depth_test: value.depth_test,
            offset_depth: value.offset_depth,
            transparent: value.transparent,
            alpha_test: value.alpha_test,
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
    #[wasm_bindgen(js_name = scaleByDistance)]
    #[serde(rename = "scaleByDistance")]
    pub scale_by_distance: Option<bool>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = depthTest)]
    #[serde(rename = "depthTest")]
    pub depth_test: Option<bool>,
    /// Avoid overlapping with the globe surface.
    #[wasm_bindgen(js_name = offsetDepth)]
    #[serde(rename = "offsetDepth")]
    pub offset_depth: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub text: Option<String>,
    /// Specify URL for font file. Supported files are ttf, otf and woff. Default is `Roboto`.
    #[wasm_bindgen(getter_with_clone)]
    pub font: Option<String>,
    #[wasm_bindgen(js_name = backgroundColor)]
    #[serde(rename = "backgroundColor")]
    pub background_color: Option<u32>,
    #[wasm_bindgen(js_name = borderColor)]
    #[serde(rename = "borderColor")]
    pub border_color: Option<u32>,
    #[wasm_bindgen(js_name = borderWidth)]
    #[serde(rename = "borderWidth")]
    pub border_width: Option<f32>,
    #[wasm_bindgen(js_name = cornerRadius)]
    #[serde(rename = "cornerRadius")]
    pub corner_radius: Option<f32>,
    pub padding: Option<Vec2>,
    // outline
    /// Outline blur radius in CSS pixels. Defaults to `0.0`.
    #[wasm_bindgen(js_name = outlineBlur)]
    #[serde(rename = "outlineBlur")]
    pub outline_blur: Option<f32>,
    #[wasm_bindgen(js_name = outlineColor)]
    #[serde(rename = "outlineColor")]
    pub outline_color: Option<u32>, // outlineColor Defalut:black
    /// Pixel offset `[x, y]` in CSS pixels. Defaults to `(0.0, 0.0)`.
    #[wasm_bindgen(js_name = outlineOffset)]
    #[serde(rename = "outlineOffset")]
    pub outline_offset: Option<Vec2>,
    #[wasm_bindgen(js_name = outlineOpacity)]
    #[serde(rename = "outlineOpacity")]
    pub outline_opacity: Option<f32>, // outlineOpacity Default:1
    /// Outline thickness measured in CSS pixels. Defaults to `0.0`.
    #[wasm_bindgen(js_name = outlineWidth)]
    #[serde(rename = "outlineWidth")]
    pub outline_width: Option<f32>,
}

impl From<TextMaterial> for navara_material::TextMaterial {
    fn from(val: TextMaterial) -> Self {
        navara_material::TextMaterial {
            show: val.show,
            size: val.size,
            color: val.color,
            center: val.center.map(Into::into),
            height: val.height,
            scale_by_distance: val.scale_by_distance,
            clamp_to_ground: val.clamp_to_ground,
            depth_test: val.depth_test,
            offset_depth: val.offset_depth,
            text: val.text,
            font: val.font,
            background_color: val.background_color,
            border_color: val.border_color,
            border_width: val.border_width,
            corner_radius: val.corner_radius,
            padding: val.padding.map(Into::into),
            outline_blur: val.outline_blur,
            outline_color: val.outline_color,
            outline_offset: val
                .outline_offset
                .map(Into::into)
                ,
            outline_opacity: val.outline_opacity,
            outline_width: val.outline_width,
        }
    }
}
impl<'a> From<&'a navara_material::TextMaterial> for TextMaterial {
    fn from(value: &'a navara_material::TextMaterial) -> TextMaterial {
        TextMaterial {
            show: value.show,
            size: value.size,
            color: value.color,
            center: value.center.map(Into::into),
            height: value.height,
            scale_by_distance: value.scale_by_distance,
            clamp_to_ground: value.clamp_to_ground,
            depth_test: value.depth_test,
            offset_depth: value.offset_depth,
            text: value.text.clone(),
            font: value.font.clone(),
            background_color: value.background_color,
            border_color: value.border_color,
            border_width: value.border_width,
            corner_radius: value.corner_radius,
            padding: value.padding.map(Into::into),
            outline_blur: value.outline_blur,
            outline_color: value.outline_color,
            outline_offset: value.outline_offset.map(Into::into),
            outline_opacity: value.outline_opacity,
            outline_width: value.outline_width,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    pub color: Option<u32>,
    pub width: Option<f32>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = useGroundNormals)]
    #[serde(rename = "useGroundNormals")]
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
        navara_material::PolylineMaterial {
            show: val.show,
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            color: val.color,
            width: val.width,
            clamp_to_ground: val.clamp_to_ground,
            use_ground_normals: val.use_ground_normals,
            height: val.height,
            internal: val.__internal__.map(|v| v.into()),
        }
    }
}
impl<'a> From<&'a navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: &'a navara_material::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            color: value.color,
            width: value.width,
            clamp_to_ground: value.clamp_to_ground,
            use_ground_normals: value.use_ground_normals,
            height: value.height,
            __internal__: value.internal.as_ref().map(|v| v.into()),
        }
    }
}

impl From<navara_material::PolylineMaterial> for PolylineMaterial {
    fn from(value: navara_material::PolylineMaterial) -> PolylineMaterial {
        PolylineMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            color: value.color,
            width: value.width,
            clamp_to_ground: value.clamp_to_ground,
            use_ground_normals: value.use_ground_normals,
            height: value.height,
            __internal__: value.internal.map(|v| v.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolylineInternalMaterial {
    #[wasm_bindgen(getter_with_clone, js_name = minMaxHeights)]
    #[serde(rename = "minMaxHeights")]
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
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    pub color: Option<u32>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = useGroundNormals)]
    #[serde(rename = "useGroundNormals")]
    pub use_ground_normals: Option<bool>,
    pub height: Option<f32>,
    #[wasm_bindgen(js_name = extrudedHeight)]
    #[serde(rename = "extrudedHeight")]
    pub extruded_height: Option<f32>,
    pub wireframe: Option<bool>,
    /// Reflectivity for post-process or env map.
    pub reflectivity: Option<f32>,
    /// Reflectivity for post-process.
    pub roughness: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolygonInternalMaterial>,

    /// Whether or not the height is obtained from the data. If false, the height is constant.
    #[wasm_bindgen(js_name = perPositionHeight)]
    #[serde(rename = "perPositionHeight")]
    pub per_position_height: Option<bool>,
    /// Need to enable `transparent`.
    pub opacity: Option<f32>,
    /// Enable `opacity`. It might cause unexpected behavior when you use an effect layer.
    pub transparent: Option<bool>,

    /// Currently, this property is supported only in GeoJSON.
    #[wasm_bindgen(js_name = surfaceShow)]
    #[serde(rename = "surfaceShow")]
    pub surface_show: Option<bool>,
    /// Currently, this property is supported only in GeoJSON.
    #[wasm_bindgen(js_name = outlineShow)]
    #[serde(rename = "outlineShow")]
    pub outline_show: Option<bool>,
    /// Currently, this property is supported only in GeoJSON.
    #[wasm_bindgen(js_name = outlineColor)]
    #[serde(rename = "outlineColor")]
    pub outline_color: Option<u32>,
    /// Currently, this property is supported only in GeoJSON.
    #[wasm_bindgen(js_name = outlineWidth)]
    #[serde(rename = "outlineWidth")]
    pub outline_width: Option<f32>,

    /// Apply a water material on the polygon. It might slow down the loading of the mesh.
    pub water: Option<bool>,
    /// Scale water normal. Decreasing this value will make the water surface rough.
    #[wasm_bindgen(js_name = waterScaleNormal)]
    #[serde(rename = "waterScaleNormal")]
    pub water_scale_normal: Option<f32>,
    /// Water wave speed.
    #[wasm_bindgen(js_name = waterSpeed)]
    #[serde(rename = "waterSpeed")]
    pub water_speed: Option<f32>,
    pub shininess: Option<f32>,
    #[wasm_bindgen(js_name = specularStrength)]
    #[serde(rename = "specularStrength")]
    pub specular_strength: Option<f32>,
    #[wasm_bindgen(js_name = applyWaterNormal)]
    #[serde(rename = "applyWaterNormal")]
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
        navara_material::PolygonMaterial {
            show: val.show,
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            color: val.color,
            clamp_to_ground: val.clamp_to_ground,
            use_ground_normals: val.use_ground_normals,
            height: val.height,
            extruded_height: val.extruded_height,
            wireframe: val.wireframe,
            reflectivity: val.reflectivity,
            roughness: val.roughness,
            internal: val.__internal__.map(|v| v.into()),

            per_position_height: val
                .per_position_height
                ,
            opacity: val.opacity,
            transparent: val.transparent,

            surface_show: val.surface_show,
            outline_show: val.outline_show,
            outline_color: val.outline_color,
            outline_width: val.outline_width,
            water: val.water,
            water_scale_normal: val.water_scale_normal,
            water_speed: val.water_speed,
            shininess: val.shininess,
            specular_strength: val.specular_strength,
            apply_water_normal: val.apply_water_normal,
            specular: val.specular,
            ior: val.ior,
        }
    }
}
impl<'a> From<&'a navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: &'a navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            color: value.color,
            clamp_to_ground: value.clamp_to_ground,
            use_ground_normals: value.use_ground_normals,
            height: value.height,
            extruded_height: value.extruded_height,
            wireframe: value.wireframe,
            reflectivity: value.reflectivity,
            roughness: value.roughness,
            __internal__: value.internal.as_ref().map(|v| v.into()),

            per_position_height: value.per_position_height,
            opacity: value.opacity,
            transparent: value.transparent,

            surface_show: value.surface_show,
            outline_show: value.outline_show,
            outline_color: value.outline_color,
            outline_width: value.outline_width,
            water: value.water,
            water_scale_normal: value.water_scale_normal,
            water_speed: value.water_speed,
            shininess: value.shininess,
            specular_strength: value.specular_strength,
            apply_water_normal: value.apply_water_normal,
            specular: value.specular,
            ior: value.ior,
        }
    }
}
impl From<navara_material::PolygonMaterial> for PolygonMaterial {
    fn from(value: navara_material::PolygonMaterial) -> PolygonMaterial {
        PolygonMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            color: value.color,
            clamp_to_ground: value.clamp_to_ground,
            use_ground_normals: value.use_ground_normals,
            height: value.height,
            extruded_height: value.extruded_height,
            wireframe: value.wireframe,
            reflectivity: value.reflectivity,
            roughness: value.roughness,
            __internal__: value.internal.map(|v| v.into()),

            per_position_height: value.per_position_height,
            opacity: value.opacity,
            transparent: value.transparent,

            surface_show: value.surface_show,
            outline_show: value.outline_show,
            outline_color: value.outline_color,
            outline_width: value.outline_width,
            water: value.water,
            water_scale_normal: value.water_scale_normal,
            water_speed: value.water_speed,
            shininess: value.shininess,
            specular_strength: value.specular_strength,
            apply_water_normal: value.apply_water_normal,
            specular: value.specular,
            ior: value.ior,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonInternalMaterial {
    #[wasm_bindgen(getter_with_clone, js_name = minMaxHeights)]
    #[serde(rename = "minMaxHeights")]
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
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    pub size: Option<f32>,
    pub height: Option<f32>,
    #[wasm_bindgen(js_name = maxSse)]
    #[serde(rename = "maxSse")]
    pub max_sse: Option<f32>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    #[wasm_bindgen(js_name = shouldRotateInDefault)]
    #[serde(rename = "shouldRotateInDefault")]
    pub should_rotate_in_default: Option<bool>,
    pub color: Option<u32>,
    pub metalness: Option<f32>,
    /// Reflectivity for post-process.
    pub roughness: Option<f32>,
    /// Reflectivity for post-process or env map.
    pub reflectivity: Option<f32>,
    /// Apply a water material on the polygon. It might slow down the loading of the mesh.
    pub water: Option<bool>,
    /// Scale water normal. Decreasing this value will make the water surface rough.
    #[wasm_bindgen(js_name = waterScaleNormal)]
    #[serde(rename = "waterScaleNormal")]
    pub water_scale_normal: Option<f32>,
    /// Water wave speed.
    #[wasm_bindgen(js_name = waterSpeed)]
    #[serde(rename = "waterSpeed")]
    pub water_speed: Option<f32>,
    pub shininess: Option<f32>,
    #[wasm_bindgen(js_name = specularStrength)]
    #[serde(rename = "specularStrength")]
    pub specular_strength: Option<f32>,
    #[wasm_bindgen(js_name = applyWaterNormal)]
    #[serde(rename = "applyWaterNormal")]
    pub apply_water_normal: Option<bool>,
    /// Enabling this value allows using `shininess` and `specular_strength`.
    pub specular: Option<bool>,
    pub ior: Option<f32>,
    // animation
    #[wasm_bindgen(getter_with_clone, js_name = animationActiveClip)]
    #[serde(rename = "animationActiveClip")]
    pub animation_active_clip: Option<String>,
    #[wasm_bindgen(js_name = animationSpeed)]
    #[serde(rename = "animationSpeed")]
    pub animation_speed: Option<f32>,
    // Point size for point clouds data.
    #[wasm_bindgen(js_name = pointSize)]
    #[serde(rename = "pointSize")]
    pub point_size: Option<f32>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<ModelInternalMaterial>,
}

impl From<ModelMaterial> for navara_material::ModelMaterial {
    fn from(val: ModelMaterial) -> Self {
        navara_material::ModelMaterial {
            show: val.show,
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            url: val.url,
            size: val.size,
            height: val.height,
            max_sse: val.max_sse,
            clamp_to_ground: val.clamp_to_ground,
            should_rotate_in_default: val
                .should_rotate_in_default
                ,
            color: val.color,
            metalness: val.metalness,
            roughness: val.roughness,
            reflectivity: val.reflectivity,
            water: val.water,
            water_scale_normal: val.water_scale_normal,
            water_speed: val.water_speed,
            shininess: val.shininess,
            specular_strength: val.specular_strength,
            apply_water_normal: val.apply_water_normal,
            specular: val.specular,
            ior: val.ior,
            // animation
            animation_active_clip: val.animation_active_clip,
            animation_speed: val.animation_speed,
            point_size: val.point_size,
            show_bounding_box: val.show_bounding_box,
            internal: val.__internal__.clone().map(|v| v.into()),
        }
    }
}

impl<'a> From<&'a navara_material::ModelMaterial> for ModelMaterial {
    fn from(value: &'a navara_material::ModelMaterial) -> ModelMaterial {
        ModelMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            url: value.url.clone(),
            size: value.size,
            height: value.height,
            max_sse: value.max_sse,
            clamp_to_ground: value.clamp_to_ground,
            should_rotate_in_default: value.should_rotate_in_default,
            color: value.color,
            metalness: value.metalness,
            roughness: value.roughness,
            reflectivity: value.reflectivity,
            water: value.water,
            water_scale_normal: value.water_scale_normal,
            water_speed: value.water_speed,
            shininess: value.shininess,
            specular_strength: value.specular_strength,
            apply_water_normal: value.apply_water_normal,
            specular: value.specular,
            ior: value.ior,
            // animation
            animation_active_clip: value.animation_active_clip.clone(),
            animation_speed: value.animation_speed,
            point_size: value.point_size,
            show_bounding_box: value.show_bounding_box,
            __internal__: value.internal.clone().as_ref().map(|v| v.into()),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInternalMaterial {
    #[wasm_bindgen(getter_with_clone, js_name = pointCloud)]
    #[serde(rename = "pointCloud")]
    pub point_cloud: bool,
    #[wasm_bindgen(getter_with_clone, js_name = dracoCompressed)]
    #[serde(rename = "dracoCompressed")]
    pub draco_compressed: bool,
    #[wasm_bindgen(getter_with_clone, js_name = pointCloudGeodeticNormal)]
    #[serde(rename = "pointCloudGeodeticNormal")]
    pub point_cloud_geodetic_normal: WasmVec3,
}

impl<'a> From<&'a navara_material::ModelInternalMaterial> for ModelInternalMaterial {
    fn from(value: &'a navara_material::ModelInternalMaterial) -> ModelInternalMaterial {
        ModelInternalMaterial {
            point_cloud: value.point_cloud,
            draco_compressed: value.draco_compressed,
            point_cloud_geodetic_normal: value.point_cloud_geodetic_normal.into(),
        }
    }
}

impl From<ModelInternalMaterial> for navara_material::ModelInternalMaterial {
    fn from(value: ModelInternalMaterial) -> navara_material::ModelInternalMaterial {
        navara_material::ModelInternalMaterial {
            point_cloud: value.point_cloud,
            draco_compressed: value.draco_compressed,
            point_cloud_geodetic_normal: value.point_cloud_geodetic_normal.into(),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTileMaterial {
    pub show: Option<bool>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    pub tms: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
}

impl From<RasterTileMaterial> for navara_material::RasterTileMaterial {
    fn from(val: RasterTileMaterial) -> Self {
        navara_material::RasterTileMaterial {
            show: val.show,
            color: val.color,
            opacity: val.opacity,
            max_zoom: val.max_zoom,
            min_zoom: val.min_zoom,
            tms: val.tms,
            show_bounding_box: val.show_bounding_box,
        }
    }
}
impl<'a> From<&'a navara_material::RasterTileMaterial> for RasterTileMaterial {
    fn from(value: &'a navara_material::RasterTileMaterial) -> RasterTileMaterial {
        RasterTileMaterial {
            show: value.show,
            color: value.color,
            opacity: value.opacity,
            max_zoom: value.max_zoom,
            min_zoom: value.min_zoom,
            tms: value.tms,
            show_bounding_box: value.show_bounding_box,
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
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,

    // Elevation Heatmap fields
    #[wasm_bindgen(getter_with_clone, js_name = isElevationHeatmaps)]
    #[serde(rename = "isElevationHeatmaps")]
    pub is_elevation_heatmaps: Vec<u8>,
    // Shared elevation heatmap configuration (all heatmap layers use the same settings)
    #[wasm_bindgen(js_name = elevationMinHeight)]
    #[serde(rename = "elevationMinHeight")]
    pub elevation_min_height: f64,
    #[wasm_bindgen(js_name = elevationMaxHeight)]
    #[serde(rename = "elevationMaxHeight")]
    pub elevation_max_height: f64,
    #[wasm_bindgen(js_name = elevationRScaler)]
    #[serde(rename = "elevationRScaler")]
    pub elevation_r_scaler: f64,
    #[wasm_bindgen(js_name = elevationGScaler)]
    #[serde(rename = "elevationGScaler")]
    pub elevation_g_scaler: f64,
    #[wasm_bindgen(js_name = elevationBScaler)]
    #[serde(rename = "elevationBScaler")]
    pub elevation_b_scaler: f64,
    #[wasm_bindgen(js_name = elevationBoundary)]
    #[serde(rename = "elevationBoundary")]
    pub elevation_boundary: f64,
    #[wasm_bindgen(js_name = elevationMaxOffset)]
    #[serde(rename = "elevationMaxOffset")]
    pub elevation_max_offset: f64,
    #[wasm_bindgen(js_name = elevationMinOffset)]
    #[serde(rename = "elevationMinOffset")]
    pub elevation_min_offset: f64,
    #[wasm_bindgen(js_name = elevationEpsilon)]
    #[serde(rename = "elevationEpsilon")]
    pub elevation_epsilon: f64,
    #[wasm_bindgen(js_name = elevationOffset)]
    #[serde(rename = "elevationOffset")]
    pub elevation_offset: f64,

    pub logarithmic: bool,
    #[wasm_bindgen(js_name = logBoundary)]
    #[serde(rename = "logBoundary")]
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
            show_bounding_box: m.show_bounding_box,

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
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    /// `Globe.max_sse` would be used to a material that uses `clamp_to_ground`.
    #[wasm_bindgen(js_name = maxSse)]
    #[serde(rename = "maxSse")]
    pub max_sse: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub layers: Option<Vec<String>>,
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
}

impl From<VectorTileMaterial> for navara_material::VectorTileMaterial {
    fn from(val: VectorTileMaterial) -> Self {
        navara_material::VectorTileMaterial {
            show: val.show,
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            max_zoom: val.max_zoom,
            max_sse: val.max_sse,
            layers: val.layers.clone(),
            overscaled_max_zoom: val
                .overscaled_max_zoom
                ,
        }
    }
}
impl<'a> From<&'a navara_material::VectorTileMaterial> for VectorTileMaterial {
    fn from(value: &'a navara_material::VectorTileMaterial) -> VectorTileMaterial {
        VectorTileMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            max_zoom: value.max_zoom,
            max_sse: value.max_sse,
            layers: value.layers.clone(),
            overscaled_max_zoom: value.overscaled_max_zoom,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RasterTerrainMaterial {
    pub show: Option<bool>,
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    /// The terrain is upsampled until it reaches `overscaled_max_zoom`.
    #[wasm_bindgen(js_name = overscaledMaxZoom)]
    #[serde(rename = "overscaledMaxZoom")]
    pub overscaled_max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    #[wasm_bindgen(js_name = tileSize)]
    #[serde(rename = "tileSize")]
    pub tile_size: Option<u32>,
    /// Whether to render skirts along tile boundaries to hide gaps.
    /// You should disable `skirt` if you want to visualize an underground model.
    pub skirt: Option<bool>,
    /// Multiplier for the automatically calculated skirt height.
    /// A value of 1.0 uses the default calculated height.
    #[wasm_bindgen(js_name = skirtExaggeration)]
    #[serde(rename = "skirtExaggeration")]
    pub skirt_exaggeration: Option<f32>,
}

impl From<RasterTerrainMaterial> for navara_material::RasterTerrainMaterial {
    fn from(val: RasterTerrainMaterial) -> Self {
        navara_material::RasterTerrainMaterial {
            show: val.show,
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            show_bounding_box: val.show_bounding_box,
            max_zoom: val.max_zoom,
            overscaled_max_zoom: val
                .overscaled_max_zoom
                ,
            min_zoom: val.min_zoom,
            tile_size: val.tile_size,
            elevation_decoder: val
                .elevation_decoder
                .map(Into::into)
                ,
            skirt: val.skirt,
            skirt_exaggeration: val.skirt_exaggeration,
        }
    }
}

impl<'a> From<&'a navara_material::RasterTerrainMaterial> for RasterTerrainMaterial {
    fn from(value: &'a navara_material::RasterTerrainMaterial) -> RasterTerrainMaterial {
        RasterTerrainMaterial {
            show: value.show,
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            show_bounding_box: value.show_bounding_box,
            max_zoom: value.max_zoom,
            overscaled_max_zoom: value.overscaled_max_zoom,
            min_zoom: value.min_zoom,
            elevation_decoder: value.elevation_decoder.map(Into::into),
            tile_size: value.tile_size,
            skirt: value.skirt,
            skirt_exaggeration: value.skirt_exaggeration,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElevationHeatmapMaterial {
    #[wasm_bindgen(js_name = maxHeight)]
    #[serde(rename = "maxHeight")]
    pub max_height: Option<f64>,
    #[wasm_bindgen(js_name = minHeight)]
    #[serde(rename = "minHeight")]
    pub min_height: Option<f64>,
    #[wasm_bindgen(js_name = elevationDecoder)]
    #[serde(rename = "elevationDecoder")]
    pub elevation_decoder: Option<ElevationDecoder>,
    pub logarithmic: bool,
    #[wasm_bindgen(js_name = logBoundary)]
    #[serde(rename = "logBoundary")]
    pub log_boundary: f64,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EllipsoidTerrainMaterial {
    #[wasm_bindgen(js_name = castShadow)]
    #[serde(rename = "castShadow")]
    pub cast_shadow: Option<bool>,
    #[wasm_bindgen(js_name = receiveShadow)]
    #[serde(rename = "receiveShadow")]
    pub receive_shadow: Option<bool>,
    #[wasm_bindgen(js_name = showBoundingBox)]
    #[serde(rename = "showBoundingBox")]
    pub show_bounding_box: Option<bool>,
    #[wasm_bindgen(js_name = maxZoom)]
    #[serde(rename = "maxZoom")]
    pub max_zoom: Option<usize>,
    #[wasm_bindgen(js_name = minZoom)]
    #[serde(rename = "minZoom")]
    pub min_zoom: Option<usize>,
}

impl From<EllipsoidTerrainMaterial> for navara_material::EllipsoidTerrainMaterial {
    fn from(val: EllipsoidTerrainMaterial) -> Self {
        let default = navara_material::EllipsoidTerrainMaterial::default();
        navara_material::EllipsoidTerrainMaterial {
            cast_shadow: val.cast_shadow,
            receive_shadow: val.receive_shadow,
            show_bounding_box: val.show_bounding_box,
            max_zoom: val.max_zoom,
            min_zoom: val.min_zoom,
        }
    }
}

impl<'a> From<&'a navara_material::EllipsoidTerrainMaterial> for EllipsoidTerrainMaterial {
    fn from(value: &'a navara_material::EllipsoidTerrainMaterial) -> EllipsoidTerrainMaterial {
        EllipsoidTerrainMaterial {
            cast_shadow: value.cast_shadow,
            receive_shadow: value.receive_shadow,
            show_bounding_box: value.show_bounding_box,
            max_zoom: value.max_zoom,
            min_zoom: value.min_zoom,
        }
    }
}
