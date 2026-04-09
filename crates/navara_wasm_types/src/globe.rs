use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// WASM wrapper for Globe resource.
///
/// This provides a JavaScript-friendly interface for accessing and modifying
/// globe configuration properties.
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Globe {
    /// Screen-space error threshold for level of detail (LOD) calculations. Initialization only.
    #[wasm_bindgen(js_name = maxSse)]
    pub max_sse: f32,

    /// Number of segments for mesh tessellation. Initialization only.
    pub segments: f32,

    /// Base color for the globe surface (RGB as u32).
    pub color: u32,

    /// Whether to hide underground geometry. Disabling this value might cause unexpected behavior when using effect layer.
    #[wasm_bindgen(js_name = hideUnderground)]
    pub hide_underground: bool,

    /// Whether to use normals. Initialization only.
    #[wasm_bindgen(js_name = useNormal)]
    pub should_compute_normal_from_vertex: bool,

    /// Whether materials should be transparent.
    /// Note that blending works only for resource layer.
    pub transparent: bool,

    /// Global opacity for materials (0.0 to 1.0).
    pub opacity: f32,

    /// Whether to render materials in wireframe mode.
    pub wireframe: bool,

    /// Color map lookup table for elevation heatmap rendering.
    /// Flattened RGB array: [r0,g0,b0, r1,g1,b1, ...].
    #[wasm_bindgen(js_name = elevationColormap, getter_with_clone)]
    pub elevation_colormap: Vec<f32>,
}

#[wasm_bindgen]
impl Globe {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        max_sse: f32,
        segments: f32,
        color: u32,
        hide_underground: bool,
        should_compute_normal_from_vertex: bool,
        transparent: bool,
        opacity: f32,
        wireframe: bool,
        elevation_colormap: Vec<f32>,
    ) -> Self {
        Self {
            max_sse,
            segments,
            color,
            hide_underground,
            should_compute_normal_from_vertex,
            transparent,
            opacity,
            wireframe,
            elevation_colormap,
        }
    }
}

impl From<&navara_globe::Globe> for Globe {
    fn from(val: &navara_globe::Globe) -> Self {
        Globe {
            max_sse: val.max_sse,
            segments: val.segments as f32,
            color: val.color,
            hide_underground: val.hide_underground,
            should_compute_normal_from_vertex: val.should_compute_normal_from_vertex,
            transparent: val.transparent,
            opacity: val.opacity,
            wireframe: val.wireframe,
            elevation_colormap: val.elevation_colormap.clone(),
        }
    }
}

impl From<navara_globe::Globe> for Globe {
    fn from(val: navara_globe::Globe) -> Self {
        (&val).into()
    }
}

impl From<&Globe> for navara_globe::Globe {
    fn from(val: &Globe) -> Self {
        navara_globe::Globe {
            max_sse: val.max_sse,
            segments: val.segments as usize,
            color: val.color,
            hide_underground: val.hide_underground,
            should_compute_normal_from_vertex: val.should_compute_normal_from_vertex,
            transparent: val.transparent,
            opacity: val.opacity,
            wireframe: val.wireframe,
            elevation_colormap: val.elevation_colormap.clone(),
        }
    }
}

impl From<Globe> for navara_globe::Globe {
    fn from(val: Globe) -> Self {
        (&val).into()
    }
}
