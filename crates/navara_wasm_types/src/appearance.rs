use navara_wasm_utils::ToU8;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::{ElevationDecoder, TextureFragment, Vec2, Vec3 as WasmVec3};
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointMaterial {
    pub show: Option<bool>,
    /// size in pixels/meters (units are determined by `sizeInMeters`).
    pub size: Option<f32>,
    pub color: Option<u32>,
    /// anchor point of the sprite, range is (-0.5, -0.5) to (0.5, 0.5).
    /// Default is (0.0, 0.0) which means the center of the sprite.
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    #[wasm_bindgen(js_name = sizeInMeters)]
    #[serde(rename = "sizeInMeters")]
    /// Whether the size is specified in meters. If false, the size is in pixels. Default is true.
    pub size_in_meters: Option<bool>,
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
    // SelectiveEffect
    /// IDs of selective effects to apply (e.g., "bloom", "outline")
    #[wasm_bindgen(getter_with_clone, js_name = effectIds)]
    #[serde(rename = "effectIds")]
    pub effect_ids: Option<Vec<String>>,
    /// Emissive glow intensity (default: 0.3 when Bloom enabled)
    #[wasm_bindgen(js_name = emissiveIntensity)]
    #[serde(rename = "emissiveIntensity")]
    pub emissive_intensity: Option<f32>,
    /// Emissive glow color in 0xRRGGBB format
    #[wasm_bindgen(js_name = emissiveColor)]
    #[serde(rename = "emissiveColor")]
    pub emissive_color: Option<u32>,
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
            size_in_meters: val.size_in_meters.unwrap_or(default.size_in_meters),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            offset_depth: val.offset_depth.unwrap_or(default.offset_depth),
            transparent: val.transparent.unwrap_or(default.transparent),
            effect_ids: val.effect_ids.or(default.effect_ids),
            emissive_intensity: val.emissive_intensity.or(default.emissive_intensity),
            emissive_color: val.emissive_color.or(default.emissive_color),
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
            size_in_meters: Some(value.size_in_meters),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            offset_depth: Some(value.offset_depth),
            transparent: Some(value.transparent),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
        }
    }
}

impl PointMaterial {
    pub fn merge(&self, other: &navara_material::PointMaterial) -> navara_material::PointMaterial {
        navara_material::PointMaterial {
            show: self.show.unwrap_or(other.show),
            size: self.size.unwrap_or(other.size),
            color: self.color.unwrap_or(other.color),
            center: self.center.unwrap_or(other.center.into()).into(),
            height: self.height.unwrap_or(other.height),
            size_in_meters: self.size_in_meters.unwrap_or(other.size_in_meters),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            depth_test: self.depth_test.unwrap_or(other.depth_test),
            offset_depth: self.offset_depth.unwrap_or(other.offset_depth),
            transparent: self.transparent.unwrap_or(other.transparent),
            effect_ids: self.effect_ids.clone().or_else(|| other.effect_ids.clone()),
            emissive_intensity: self.emissive_intensity.or(other.emissive_intensity),
            emissive_color: self.emissive_color.or(other.emissive_color),
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
    /// size in pixels/meters (units are determined by `sizeInMeters`).
    pub size: Option<f32>,
    pub color: Option<u32>,
    /// anchor point of the sprite, range is (-0.5, -0.5) to (0.5, 0.5).
    /// Default is (0.0, 0.0) which means the center of the sprite.
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub url: Option<String>,
    #[wasm_bindgen(js_name = sizeInMeters)]
    #[serde(rename = "sizeInMeters")]
    /// Whether the size is specified in meters. If false, the size is in pixels. Default is true.
    pub size_in_meters: Option<bool>,
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
    // SelectiveEffect
    /// IDs of selective effects to apply (e.g., "bloom", "outline")
    #[wasm_bindgen(getter_with_clone, js_name = effectIds)]
    #[serde(rename = "effectIds")]
    pub effect_ids: Option<Vec<String>>,
    /// Emissive glow intensity (default: 0.3 when Bloom enabled)
    #[wasm_bindgen(js_name = emissiveIntensity)]
    #[serde(rename = "emissiveIntensity")]
    pub emissive_intensity: Option<f32>,
    /// Emissive glow color in 0xRRGGBB format
    #[wasm_bindgen(js_name = emissiveColor)]
    #[serde(rename = "emissiveColor")]
    pub emissive_color: Option<u32>,
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
            size_in_meters: val.size_in_meters.unwrap_or(default.size_in_meters),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            offset_depth: val.offset_depth.unwrap_or(default.offset_depth),
            transparent: val.transparent.unwrap_or(default.transparent),
            alpha_test: val.alpha_test.unwrap_or(default.alpha_test),
            effect_ids: val.effect_ids.or(default.effect_ids),
            emissive_intensity: val.emissive_intensity.or(default.emissive_intensity),
            emissive_color: val.emissive_color.or(default.emissive_color),
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
            size_in_meters: Some(value.size_in_meters),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            offset_depth: Some(value.offset_depth),
            transparent: Some(value.transparent),
            alpha_test: Some(value.alpha_test),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
        }
    }
}

impl BillboardMaterial {
    pub fn merge(
        &self,
        other: &navara_material::BillboardMaterial,
    ) -> navara_material::BillboardMaterial {
        navara_material::BillboardMaterial {
            show: self.show.unwrap_or(other.show),
            size: self.size.unwrap_or(other.size),
            color: self.color.unwrap_or(other.color),
            center: self.center.unwrap_or(other.center.into()).into(),
            height: self.height.unwrap_or(other.height),
            url: self.url.clone().unwrap_or(other.url.clone()),
            size_in_meters: self.size_in_meters.unwrap_or(other.size_in_meters),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            depth_test: self.depth_test.unwrap_or(other.depth_test),
            offset_depth: self.offset_depth.unwrap_or(other.offset_depth),
            transparent: self.transparent.unwrap_or(other.transparent),
            alpha_test: self.alpha_test.unwrap_or(other.alpha_test),
            effect_ids: self.effect_ids.clone().or_else(|| other.effect_ids.clone()),
            emissive_intensity: self.emissive_intensity.or(other.emissive_intensity),
            emissive_color: self.emissive_color.or(other.emissive_color),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextMaterial {
    pub show: Option<bool>,
    /// size in pixels/meters (units are determined by `sizeInMeters`).
    pub size: Option<f32>,
    pub color: Option<u32>,
    pub center: Option<Vec2>,
    pub height: Option<f32>,
    /// Whether the size is specified in meters. If false, the size is in pixels. Default is true.
    #[wasm_bindgen(js_name = sizeInMeters)]
    #[serde(rename = "sizeInMeters")]
    pub size_in_meters: Option<bool>,
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
    /// **Experimental*:
    /// Specify URL for font file. Supported files are ttf, otf and woff. Default is `Roboto`.
    /// Please note that this API might be replaced with another API in the future, since it loads a large font file at once.
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
    // TODO: support cornerRadius and padding later
    // #[wasm_bindgen(js_name = cornerRadius)]
    // #[serde(rename = "cornerRadius")]
    // pub corner_radius: Option<f32>,
    // pub padding: Option<Vec2>,
    // outline
    // TODO: support outlineBlur and outlineOffset later.
    /// Outline blur radius in CSS pixels. Defaults to `0.0`.
    // #[wasm_bindgen(js_name = outlineBlur)]
    // #[serde(rename = "outlineBlur")]
    // pub outline_blur: Option<f32>,
    #[wasm_bindgen(js_name = outlineColor)]
    #[serde(rename = "outlineColor")]
    pub outline_color: Option<u32>, // outlineColor Defalut:black
    // TODO: support outlineOffset later.
    /// Pixel offset `[x, y]` in CSS pixels. Defaults to `(0.0, 0.0)`.
    // #[wasm_bindgen(js_name = outlineOffset)]
    // #[serde(rename = "outlineOffset")]
    // pub outline_offset: Option<Vec2>,
    #[wasm_bindgen(js_name = outlineOpacity)]
    #[serde(rename = "outlineOpacity")]
    pub outline_opacity: Option<f32>, // outlineOpacity Default:1
    /// Outline thickness measured in CSS pixels. Defaults to `0.0`.
    #[wasm_bindgen(js_name = outlineWidth)]
    #[serde(rename = "outlineWidth")]
    pub outline_width: Option<f32>,
    /// Language code for text shaping (e.g., "en", "ja", "ar"). Used for proper text rendering.
    #[wasm_bindgen(getter_with_clone)]
    pub lang: Option<String>,
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
            size_in_meters: val.size_in_meters.unwrap_or(default.size_in_meters),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            depth_test: val.depth_test.unwrap_or(default.depth_test),
            offset_depth: val.offset_depth.unwrap_or(default.offset_depth),
            text: val.text.unwrap_or(default.text),
            font: val.font.unwrap_or(default.font),
            background_color: val.background_color,
            border_color: val.border_color.unwrap_or(default.border_color),
            border_width: val.border_width.unwrap_or(default.border_width),
            // corner_radius: val.corner_radius.unwrap_or(default.corner_radius),
            // padding: val.padding.unwrap_or(default.padding.into()).into(),
            // outline_blur: val.outline_blur.unwrap_or(default.outline_blur),
            outline_color: val.outline_color.unwrap_or(default.outline_color),
            // outline_offset: val
            //     .outline_offset
            //     .unwrap_or(default.outline_offset.into())
            //     .into(),
            outline_opacity: val.outline_opacity.unwrap_or(default.outline_opacity),
            outline_width: val.outline_width.unwrap_or(default.outline_width),
            lang: val.lang.unwrap_or(default.lang),
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
            size_in_meters: Some(value.size_in_meters),
            clamp_to_ground: Some(value.clamp_to_ground),
            depth_test: Some(value.depth_test),
            offset_depth: Some(value.offset_depth),
            text: Some(value.text.clone()),
            font: Some(value.font.clone()),
            background_color: value.background_color,
            border_color: Some(value.border_color),
            border_width: Some(value.border_width),
            // corner_radius: Some(value.corner_radius),
            // padding: Some(value.padding.into()),
            // outline_blur: Some(value.outline_blur),
            outline_color: Some(value.outline_color),
            // outline_offset: Some(value.outline_offset.into()),
            outline_opacity: Some(value.outline_opacity),
            outline_width: Some(value.outline_width),
            lang: Some(value.lang.clone()),
        }
    }
}

impl TextMaterial {
    pub fn merge(&self, other: &navara_material::TextMaterial) -> navara_material::TextMaterial {
        navara_material::TextMaterial {
            show: self.show.unwrap_or(other.show),
            size: self.size.unwrap_or(other.size),
            color: self.color.unwrap_or(other.color),
            center: self.center.unwrap_or(other.center.into()).into(),
            height: self.height.unwrap_or(other.height),
            size_in_meters: self.size_in_meters.unwrap_or(other.size_in_meters),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            depth_test: self.depth_test.unwrap_or(other.depth_test),
            offset_depth: self.offset_depth.unwrap_or(other.offset_depth),
            text: self.text.clone().unwrap_or(other.text.clone()),
            font: self.font.clone().unwrap_or(other.font.clone()),
            background_color: self.background_color.or(other.background_color),
            border_color: self.border_color.unwrap_or(other.border_color),
            border_width: self.border_width.unwrap_or(other.border_width),
            // corner_radius: self.corner_radius.unwrap_or(other.corner_radius),
            // padding: self.padding.unwrap_or(other.padding.into()).into(),
            // outline_blur: self.outline_blur.unwrap_or(other.outline_blur),
            outline_color: self.outline_color.unwrap_or(other.outline_color),
            // outline_offset: self
            //     .outline_offset
            //     .unwrap_or(other.outline_offset.into())
            //     .into(),
            outline_opacity: self.outline_opacity.unwrap_or(other.outline_opacity),
            outline_width: self.outline_width.unwrap_or(other.outline_width),
            lang: self.lang.clone().unwrap_or(other.lang.clone()),
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
    /// Maximum line width in pixels, clamping the rendered width regardless of zoom level.
    /// Smaller values are cheaper to render as they reduce fragment shader overdraw.
    #[wasm_bindgen(js_name = maxWidth)]
    #[serde(rename = "maxWidth")]
    pub max_width: Option<f32>,
    #[wasm_bindgen(js_name = clampToGround)]
    #[serde(rename = "clampToGround")]
    pub clamp_to_ground: Option<bool>,
    /// Splits the polyline into XYZ vector tiles for rendering, even when the
    /// data source is not an MVT layer. This can improve performance for large
    /// polylines.
    ///
    /// Enabling `clamp_to_ground` implicitly forces `tiled` to `true`.
    #[wasm_bindgen(js_name = tiled)]
    #[serde(rename = "tiled")]
    pub tiled: Option<bool>,
    pub height: Option<f32>,
    #[wasm_bindgen(getter_with_clone)]
    pub __internal__: Option<PolylineInternalMaterial>,
    // SelectiveEffect
    /// IDs of selective effects to apply (e.g., "bloom", "outline")
    #[wasm_bindgen(getter_with_clone, js_name = effectIds)]
    #[serde(rename = "effectIds")]
    pub effect_ids: Option<Vec<String>>,
    /// Emissive glow intensity (default: 0.3 when Bloom enabled)
    #[wasm_bindgen(js_name = emissiveIntensity)]
    #[serde(rename = "emissiveIntensity")]
    pub emissive_intensity: Option<f32>,
    /// Emissive glow color in 0xRRGGBB format
    #[wasm_bindgen(js_name = emissiveColor)]
    #[serde(rename = "emissiveColor")]
    pub emissive_color: Option<u32>,
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
        tiled: Option<bool>,
        height: Option<f32>,
        width: Option<f32>,
        max_width: Option<f32>,
        __internal__: Option<PolylineInternalMaterial>,
    ) -> Self {
        Self {
            show,
            cast_shadow,
            receive_shadow,
            color,
            clamp_to_ground,
            tiled,
            height,
            width,
            max_width,
            __internal__,
            effect_ids: None,
            emissive_intensity: None,
            emissive_color: None,
        }
    }
}

impl PolylineMaterial {
    pub fn merge(
        &self,
        other: &navara_material::PolylineMaterial,
    ) -> navara_material::PolylineMaterial {
        navara_material::PolylineMaterial {
            show: self.show.unwrap_or(other.show),
            cast_shadow: self.cast_shadow.unwrap_or(other.cast_shadow),
            receive_shadow: self.receive_shadow.unwrap_or(other.receive_shadow),
            color: self.color.unwrap_or(other.color),
            width: self.width.unwrap_or(other.width),
            max_width: self.max_width.unwrap_or(other.max_width),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            tiled: self.tiled.unwrap_or(other.tiled),
            height: self.height.unwrap_or(other.height),
            internal: self
                .__internal__
                .as_ref()
                .map(|v| v.to_owned().into())
                .or_else(|| other.internal.clone()),
            effect_ids: self.effect_ids.clone().or_else(|| other.effect_ids.clone()),
            emissive_intensity: self.emissive_intensity.or(other.emissive_intensity),
            emissive_color: self.emissive_color.or(other.emissive_color),
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
            max_width: val.max_width.unwrap_or(default.max_width),
            clamp_to_ground: val.clamp_to_ground.unwrap_or(default.clamp_to_ground),
            tiled: val.tiled.unwrap_or(default.tiled),
            height: val.height.unwrap_or(default.height),
            internal: val.__internal__.map(|v| v.into()),
            effect_ids: val.effect_ids.or(default.effect_ids),
            emissive_intensity: val.emissive_intensity.or(default.emissive_intensity),
            emissive_color: val.emissive_color.or(default.emissive_color),
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
            max_width: Some(value.max_width),
            clamp_to_ground: Some(value.clamp_to_ground),
            tiled: Some(value.tiled),
            height: Some(value.height),
            __internal__: value.internal.as_ref().map(|v| v.into()),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
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
            max_width: Some(value.max_width),
            clamp_to_ground: Some(value.clamp_to_ground),
            tiled: Some(value.tiled),
            height: Some(value.height),
            __internal__: value.internal.map(|v| v.into()),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
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
    /// Splits the polygon into XYZ vector tiles for rendering, even when the
    /// data source is not an MVT layer. This can improve performance for large
    /// polygons.
    ///
    /// Enabling `clamp_to_ground` implicitly forces `tiled` to `true`.
    /// Outline rendering is not supported when `tiled` is enabled.
    #[wasm_bindgen(js_name = tiled)]
    #[serde(rename = "tiled")]
    pub tiled: Option<bool>,
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
    /// Whether to compute outline geometry. Only effective at initial load time.
    /// When not set, inferred from `outlineShow`.
    pub outline: Option<bool>,
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
    // SelectiveEffect
    /// IDs of selective effects to apply (e.g., "bloom", "outline")
    #[wasm_bindgen(getter_with_clone, js_name = effectIds)]
    #[serde(rename = "effectIds")]
    pub effect_ids: Option<Vec<String>>,
    /// Emissive glow intensity (default: 0.3 when Bloom enabled)
    #[wasm_bindgen(js_name = emissiveIntensity)]
    #[serde(rename = "emissiveIntensity")]
    pub emissive_intensity: Option<f32>,
    /// Emissive glow color in 0xRRGGBB format
    #[wasm_bindgen(js_name = emissiveColor)]
    #[serde(rename = "emissiveColor")]
    pub emissive_color: Option<u32>,
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
        tiled: Option<bool>,
        height: Option<f32>,
        extruded_height: Option<f32>,
        wireframe: Option<bool>,
        outline: Option<bool>,
        per_position_height: Option<bool>,
        __internal__: Option<PolygonInternalMaterial>,
    ) -> Self {
        Self {
            show,
            cast_shadow,
            receive_shadow,
            color,
            clamp_to_ground,
            tiled,
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
            outline,
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
            effect_ids: None,
            emissive_intensity: None,
            emissive_color: None,
        }
    }
}

impl PolygonMaterial {
    pub fn merge(
        &self,
        other: &navara_material::PolygonMaterial,
    ) -> navara_material::PolygonMaterial {
        navara_material::PolygonMaterial {
            show: self.show.unwrap_or(other.show),
            cast_shadow: self.cast_shadow.unwrap_or(other.cast_shadow),
            receive_shadow: self.receive_shadow.unwrap_or(other.receive_shadow),
            color: self.color.unwrap_or(other.color),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            tiled: self.tiled.unwrap_or(other.tiled),
            height: self.height.unwrap_or(other.height),
            extruded_height: self.extruded_height.or(other.extruded_height),
            wireframe: self.wireframe.unwrap_or(other.wireframe),
            reflectivity: self.reflectivity.unwrap_or(other.reflectivity),
            roughness: self.roughness.unwrap_or(other.roughness),
            internal: self
                .__internal__
                .as_ref()
                .map(|v| v.to_owned().into())
                .or_else(|| other.internal.clone()),

            per_position_height: self
                .per_position_height
                .unwrap_or(other.per_position_height),
            opacity: self.opacity.unwrap_or(other.opacity),
            transparent: self.transparent.unwrap_or(other.transparent),

            surface_show: self.surface_show.unwrap_or(other.surface_show),
            outline: self.outline.unwrap_or(other.outline),
            outline_show: self.outline_show.unwrap_or(other.outline_show),
            outline_color: self.outline_color.unwrap_or(other.outline_color),
            outline_width: self.outline_width.unwrap_or(other.outline_width),
            water: self.water.unwrap_or(other.water),
            water_scale_normal: self.water_scale_normal.unwrap_or(other.water_scale_normal),
            water_speed: self.water_speed.unwrap_or(other.water_speed),
            shininess: self.shininess.unwrap_or(other.shininess),
            specular_strength: self.specular_strength.unwrap_or(other.specular_strength),
            apply_water_normal: self.apply_water_normal.unwrap_or(other.apply_water_normal),
            specular: self.specular.unwrap_or(other.specular),
            ior: self.ior.unwrap_or(other.ior),
            effect_ids: self.effect_ids.clone().or_else(|| other.effect_ids.clone()),
            emissive_intensity: self.emissive_intensity.or(other.emissive_intensity),
            emissive_color: self.emissive_color.or(other.emissive_color),
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
            tiled: val.tiled.unwrap_or(default.tiled),
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
            outline: val
                .outline
                .unwrap_or_else(|| val.outline_show.unwrap_or(default.outline)),
            outline_show: val.outline_show.unwrap_or(default.outline_show),
            outline_color: val.outline_color.unwrap_or(default.outline_color),
            outline_width: val.outline_width.unwrap_or(default.outline_width),
            water: val.water.unwrap_or(default.water),
            water_scale_normal: val.water_scale_normal.unwrap_or(default.water_scale_normal),
            water_speed: val.water_speed.unwrap_or(default.water_speed),
            shininess: val.shininess.unwrap_or(default.shininess),
            specular_strength: val.specular_strength.unwrap_or(default.specular_strength),
            apply_water_normal: val.apply_water_normal.unwrap_or(default.apply_water_normal),
            specular: val.specular.unwrap_or(default.specular),
            ior: val.ior.unwrap_or(default.ior),
            effect_ids: val.effect_ids.or(default.effect_ids),
            emissive_intensity: val.emissive_intensity.or(default.emissive_intensity),
            emissive_color: val.emissive_color.or(default.emissive_color),
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
            tiled: Some(value.tiled),
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
            outline: Some(value.outline),
            outline_show: Some(value.outline_show),
            outline_color: Some(value.outline_color),
            outline_width: Some(value.outline_width),
            water: Some(value.water),
            water_scale_normal: Some(value.water_scale_normal),
            water_speed: Some(value.water_speed),
            shininess: Some(value.shininess),
            specular_strength: Some(value.specular_strength),
            apply_water_normal: Some(value.apply_water_normal),
            specular: Some(value.specular),
            ior: Some(value.ior),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
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
            tiled: Some(value.tiled),
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
            outline: Some(value.outline),
            outline_show: Some(value.outline_show),
            outline_color: Some(value.outline_color),
            outline_width: Some(value.outline_width),
            water: Some(value.water),
            water_scale_normal: Some(value.water_scale_normal),
            water_speed: Some(value.water_speed),
            shininess: Some(value.shininess),
            specular_strength: Some(value.specular_strength),
            apply_water_normal: Some(value.apply_water_normal),
            specular: Some(value.specular),
            ior: Some(value.ior),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
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
    // SelectiveEffect
    /// IDs of selective effects to apply (e.g., "bloom", "outline")
    #[wasm_bindgen(getter_with_clone, js_name = effectIds)]
    #[serde(rename = "effectIds")]
    pub effect_ids: Option<Vec<String>>,
    /// Emissive glow intensity (default: 0.3 when Bloom enabled)
    #[wasm_bindgen(js_name = emissiveIntensity)]
    #[serde(rename = "emissiveIntensity")]
    pub emissive_intensity: Option<f32>,
    /// Emissive glow color in 0xRRGGBB format
    #[wasm_bindgen(js_name = emissiveColor)]
    #[serde(rename = "emissiveColor")]
    pub emissive_color: Option<u32>,
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
            show_bounding_box: val.show_bounding_box.unwrap_or(default.show_bounding_box),
            internal: val.__internal__.clone().map(|v| v.into()),
            effect_ids: val.effect_ids.or(default.effect_ids),
            emissive_intensity: val.emissive_intensity.or(default.emissive_intensity),
            emissive_color: val.emissive_color.or(default.emissive_color),
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
            show_bounding_box: Some(value.show_bounding_box),
            __internal__: value.internal.clone().as_ref().map(|v| v.into()),
            effect_ids: value.effect_ids.clone(),
            emissive_intensity: value.emissive_intensity,
            emissive_color: value.emissive_color,
        }
    }
}

impl ModelMaterial {
    pub fn merge(&self, other: &navara_material::ModelMaterial) -> navara_material::ModelMaterial {
        navara_material::ModelMaterial {
            show: self.show.unwrap_or(other.show),
            cast_shadow: self.cast_shadow.unwrap_or(other.cast_shadow),
            receive_shadow: self.receive_shadow.unwrap_or(other.receive_shadow),
            url: self.url.clone().unwrap_or_else(|| other.url.clone()),
            size: self.size.unwrap_or(other.size),
            height: self.height.unwrap_or(other.height),
            max_sse: self.max_sse.unwrap_or(other.max_sse),
            clamp_to_ground: self.clamp_to_ground.unwrap_or(other.clamp_to_ground),
            should_rotate_in_default: self
                .should_rotate_in_default
                .unwrap_or(other.should_rotate_in_default),
            color: self.color.unwrap_or(other.color),
            metalness: self.metalness.unwrap_or(other.metalness),
            roughness: self.roughness.unwrap_or(other.roughness),
            reflectivity: self.reflectivity.unwrap_or(other.reflectivity),
            water: self.water.unwrap_or(other.water),
            water_scale_normal: self.water_scale_normal.unwrap_or(other.water_scale_normal),
            water_speed: self.water_speed.unwrap_or(other.water_speed),
            shininess: self.shininess.unwrap_or(other.shininess),
            specular_strength: self.specular_strength.unwrap_or(other.specular_strength),
            apply_water_normal: self.apply_water_normal.unwrap_or(other.apply_water_normal),
            specular: self.specular.unwrap_or(other.specular),
            ior: self.ior.unwrap_or(other.ior),
            // animation
            animation_active_clip: self
                .animation_active_clip
                .clone()
                .or_else(|| other.animation_active_clip.clone()),
            animation_speed: self.animation_speed.or(other.animation_speed),
            point_size: self.point_size.unwrap_or(other.point_size),
            show_bounding_box: self.show_bounding_box.unwrap_or(other.show_bounding_box),
            internal: other.internal.clone(),
            effect_ids: self.effect_ids.clone().or_else(|| other.effect_ids.clone()),
            emissive_intensity: self.emissive_intensity.or(other.emissive_intensity),
            emissive_color: self.emissive_color.or(other.emissive_color),
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
        let default = navara_material::RasterTileMaterial::default();
        navara_material::RasterTileMaterial {
            show: val.show.unwrap_or(default.show),
            color: val.color.unwrap_or(default.color),
            opacity: val.opacity.unwrap_or(default.opacity),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
            tms: val.tms.unwrap_or(default.tms),
            show_bounding_box: val.show_bounding_box.unwrap_or(default.show_bounding_box),
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
            show_bounding_box: Some(value.show_bounding_box),
        }
    }
}

impl RasterTileMaterial {
    pub fn merge(
        &self,
        other: &navara_material::RasterTileMaterial,
    ) -> navara_material::RasterTileMaterial {
        navara_material::RasterTileMaterial {
            show: self.show.unwrap_or(other.show),
            color: self.color.unwrap_or(other.color),
            opacity: self.opacity.unwrap_or(other.opacity),
            max_zoom: self.max_zoom.unwrap_or(other.max_zoom),
            min_zoom: self.min_zoom.unwrap_or(other.min_zoom),
            tms: self.tms.unwrap_or(other.tms),
            show_bounding_box: self.show_bounding_box.unwrap_or(other.show_bounding_box),
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
                            ind: t.index().index(),
                            r#gen: t.generation().to_bits(),
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

impl VectorTileMaterial {
    pub fn merge(
        &self,
        other: &navara_material::VectorTileMaterial,
    ) -> navara_material::VectorTileMaterial {
        navara_material::VectorTileMaterial {
            show: self.show.unwrap_or(other.show),
            cast_shadow: self.cast_shadow.unwrap_or(other.cast_shadow),
            receive_shadow: self.receive_shadow.unwrap_or(other.receive_shadow),
            max_zoom: self.max_zoom.unwrap_or(other.max_zoom),
            max_sse: self.max_sse.unwrap_or(other.max_sse),
            layers: self.layers.clone().or_else(|| other.layers.clone()),
            overscaled_max_zoom: self
                .overscaled_max_zoom
                .unwrap_or(other.overscaled_max_zoom),
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
        let default = navara_material::RasterTerrainMaterial::default();
        navara_material::RasterTerrainMaterial {
            show: val.show.unwrap_or(default.show),
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            show_bounding_box: val.show_bounding_box.unwrap_or(default.show_bounding_box),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            overscaled_max_zoom: val
                .overscaled_max_zoom
                .unwrap_or(default.overscaled_max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
            tile_size: val.tile_size.unwrap_or(default.tile_size),
            elevation_decoder: val
                .elevation_decoder
                .unwrap_or(default.elevation_decoder.into())
                .into(),
            skirt: val.skirt.unwrap_or(default.skirt),
            skirt_exaggeration: val.skirt_exaggeration.unwrap_or(default.skirt_exaggeration),
        }
    }
}

impl<'a> From<&'a navara_material::RasterTerrainMaterial> for RasterTerrainMaterial {
    fn from(value: &'a navara_material::RasterTerrainMaterial) -> RasterTerrainMaterial {
        RasterTerrainMaterial {
            show: Some(value.show),
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            show_bounding_box: Some(value.show_bounding_box),
            max_zoom: Some(value.max_zoom),
            overscaled_max_zoom: Some(value.overscaled_max_zoom),
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
            skirt: Some(value.skirt),
            skirt_exaggeration: Some(value.skirt_exaggeration),
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
            cast_shadow: val.cast_shadow.unwrap_or(default.cast_shadow),
            receive_shadow: val.receive_shadow.unwrap_or(default.receive_shadow),
            show_bounding_box: val.show_bounding_box.unwrap_or(default.show_bounding_box),
            max_zoom: val.max_zoom.unwrap_or(default.max_zoom),
            min_zoom: val.min_zoom.unwrap_or(default.min_zoom),
        }
    }
}

impl<'a> From<&'a navara_material::EllipsoidTerrainMaterial> for EllipsoidTerrainMaterial {
    fn from(value: &'a navara_material::EllipsoidTerrainMaterial) -> EllipsoidTerrainMaterial {
        EllipsoidTerrainMaterial {
            cast_shadow: Some(value.cast_shadow),
            receive_shadow: Some(value.receive_shadow),
            show_bounding_box: Some(value.show_bounding_box),
            max_zoom: Some(value.max_zoom),
            min_zoom: Some(value.min_zoom),
        }
    }
}
