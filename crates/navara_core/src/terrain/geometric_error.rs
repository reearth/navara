use crate::{Ellipsoid, TileXYZ};
use navara_math::{FloatType, One, Two};
use radians::Float;

// Ref: https://github.com/CesiumGS/cesium/blob/58ea653fa90af13432e378892a303b7c7f9f4e47/packages/engine/Source/Core/EllipsoidTerrainProvider.js#L38
pub fn get_ellipsoid_terrain_level_zero_maximum_geometric_error(
    ellipsoid: &Ellipsoid<FloatType>,
    height_map_width: FloatType,
) -> FloatType {
    get_ellipsoid_terrain_level_zero_maximum_geometric_error_with_root_tiles(
        ellipsoid,
        height_map_width,
        TileXYZ { x: 0, y: 0, z: 0 }.n(),
    )
}

/// Scheme-aware level-zero geometric error: pass the tiling scheme's number of level-zero
/// tiles in X (Cesium's `tilingScheme.getNumberOfXTilesAtLevel(0)` — 2 for Geographic, 1 for
/// WebMercator). A Geographic root spans half the longitude of a WebMercator root, so its
/// error is halved here; that makes a Geographic terrain tile subdivide one level coarser to
/// reach the same on-ground error as WebMercator, keeping their LOD (and the draped WM tile
/// zoom derived from the terrain tile's longitude span) consistent across schemes.
pub fn get_ellipsoid_terrain_level_zero_maximum_geometric_error_with_root_tiles(
    ellipsoid: &Ellipsoid<FloatType>,
    height_map_width: FloatType,
    number_of_root_tiles_x: usize,
) -> FloatType {
    get_estimated_level_zero_geometric_error_for_a_heightmap::<FloatType>(
        ellipsoid,
        height_map_width,
        number_of_root_tiles_x as FloatType,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::WGS84_64;

    #[test]
    fn geographic_level_zero_error_is_half_of_web_mercator() {
        // Geographic has 2 level-zero tiles in X, WebMercator 1 → the Geographic error is
        // halved, which is what makes it subdivide one level coarser (Cesium parity).
        let wm = get_ellipsoid_terrain_level_zero_maximum_geometric_error_with_root_tiles(
            &WGS84_64, 65.0, 1,
        );
        let geo = get_ellipsoid_terrain_level_zero_maximum_geometric_error_with_root_tiles(
            &WGS84_64, 65.0, 2,
        );
        assert!((geo - wm / 2.0).abs() < 1e-9);

        // The scheme-blind wrapper stays equal to the 1-root (WebMercator) case.
        assert_eq!(
            get_ellipsoid_terrain_level_zero_maximum_geometric_error(&WGS84_64, 65.0),
            wm,
        );
    }
}
