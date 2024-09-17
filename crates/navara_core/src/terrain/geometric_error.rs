use crate::{Ellipsoid, One, TileXYZ, Two};
use navara_math::FloatType;
use radians::Float;

// Ref: https://github.com/CesiumGS/cesium/blob/58ea653fa90af13432e378892a303b7c7f9f4e47/packages/engine/Source/Core/EllipsoidTerrainProvider.js#L38
pub fn get_ellipsoid_terrain_level_zero_maximum_geometric_error(
    ellipsoid: &Ellipsoid<FloatType>,
    height_map_width: FloatType,
) -> FloatType {
    get_estimated_level_zero_geometric_error_for_a_heightmap::<FloatType>(
        ellipsoid,
        height_map_width,
        TileXYZ { x: 0, y: 0, z: 0 }.n() as FloatType,
        0.25,
    )
}

pub fn get_level_maximum_geometric_error(
    level: usize,
    maximum_geometric_error: FloatType,
) -> FloatType {
    maximum_geometric_error / (1 << level) as FloatType
}

// Ref: https://github.com/CesiumGS/cesium/blob/58ea653fa90af13432e378892a303b7c7f9f4e47/packages/engine/Source/Core/TerrainProvider.js#L362
pub fn get_estimated_level_zero_geometric_error_for_a_heightmap<F: Float + One<F> + Two<F>>(
    ellipsoid: &Ellipsoid<F>,
    tile_image_width: F,
    number_of_tiles_at_level_zero: F,
    heightmap_terrain_quality: F,
) -> F {
    (ellipsoid.a * F::two() * F::PI * heightmap_terrain_quality)
        / (tile_image_width * number_of_tiles_at_level_zero)
}
