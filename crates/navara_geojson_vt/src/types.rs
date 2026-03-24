use std::sync::Arc;

/// Axis-aligned bounding box in normalized [0,1] coordinates.
#[derive(Debug, Clone, Copy)]
pub struct BBox {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

impl BBox {
    pub fn new() -> Self {
        Self {
            min_x: f64::INFINITY,
            min_y: f64::INFINITY,
            max_x: f64::NEG_INFINITY,
            max_y: f64::NEG_INFINITY,
        }
    }

    pub fn extend(&mut self, x: f64, y: f64) {
        self.min_x = self.min_x.min(x);
        self.min_y = self.min_y.min(y);
        self.max_x = self.max_x.max(x);
        self.max_y = self.max_y.max(y);
    }
}

impl Default for BBox {
    fn default() -> Self {
        Self::new()
    }
}

/// A ring of coordinates stored as flat [x, y, z, x, y, z, ...].
///
/// The z-coordinate stores simplification importance values (set by Douglas-Peucker).
#[derive(Debug, Clone)]
pub struct Ring {
    pub coords: Vec<f64>,
    /// Signed area (positive = exterior, negative = hole).
    pub area: f64,
    /// Accumulated distance along the ring (for simplification).
    pub dist: f64,
    /// Geometry size: absolute area for polygon rings, total distance for line rings.
    /// Preserved through clipping for the small-geometry skip check.
    pub size: f64,
}

impl Ring {
    pub fn new() -> Self {
        Self {
            coords: Vec::new(),
            area: 0.0,
            dist: 0.0,
            size: 0.0,
        }
    }

    pub fn len(&self) -> usize {
        self.coords.len() / 3
    }

    pub fn is_empty(&self) -> bool {
        self.coords.is_empty()
    }
}

impl Default for Ring {
    fn default() -> Self {
        Self::new()
    }
}

/// Internal geometry types with coordinates normalized to [0,1].
#[derive(Debug, Clone)]
pub enum InternalGeometry {
    Point([f64; 3]),
    MultiPoint(Vec<f64>),
    LineString(Ring),
    MultiLineString(Vec<Ring>),
    Polygon(Vec<Ring>),
    MultiPolygon(Vec<Vec<Ring>>),
}

/// A GeoJSON feature with coordinates projected to [0,1] space.
#[derive(Debug, Clone)]
pub struct InternalFeature {
    pub geometry: InternalGeometry,
    pub bbox: BBox,
    pub properties: Arc<serde_json::Value>,
    pub source_index: usize,
}

/// Geometry types for output tiles with coordinates in tile-local space.
#[derive(Debug, Clone)]
pub enum TileGeometry {
    Points(Vec<[f64; 2]>),
    Lines(Vec<Vec<[f64; 2]>>),
    Polygons(Vec<Vec<Vec<[f64; 2]>>>),
}

/// A feature in an output tile.
#[derive(Debug, Clone)]
pub struct TileFeature {
    pub geometry: TileGeometry,
    pub properties: Arc<serde_json::Value>,
}

/// An output tile containing features for a specific tile coordinate.
#[derive(Debug, Clone)]
pub struct Tile {
    pub features: Vec<TileFeature>,
    pub z: u32,
    pub x: u32,
    pub y: u32,
    /// Total number of input points (before simplification filtering).
    pub num_points: u32,
    /// Number of points kept after simplification filtering.
    pub num_simplified: u32,
}
