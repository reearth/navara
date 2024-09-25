// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Core/GroundPolylineGeometry.js#L33-L44
// Initial heights for constructing the wall.
// Keeping WALL_INITIAL_MIN_HEIGHT near the ellipsoid surface helps
// prevent precision problems with planes in the shader.
// Putting the start point of a plane at ApproximateTerrainHeights._defaultMinTerrainHeight,
// which is a highly conservative bound, usually puts the plane origin several thousands
// of meters away from the actual terrain, causing floating point problems when checking
// fragments on terrain against the plane.
// Ellipsoid height is generally much closer.
// The initial max height is arbitrary.
// Both heights are corrected using ApproximateTerrainHeights for computing the actual volume geometry.
pub(super) const WALL_INITIAL_MIN_HEIGHT: f32 = 0.;
pub(super) const WALL_INITIAL_MAX_HEIGHT: f32 = 1000.;

// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Core/GroundPolylineGeometry.js#L1011
pub(super) const REFERENCE_INDICES: [u32; 36] = [
    0, 2, 1, 0, 3, 2, // right
    0, 7, 3, 0, 4, 7, // start
    0, 5, 4, 0, 1, 5, // bottom
    5, 7, 4, 5, 6, 7, // left
    5, 2, 6, 5, 1, 2, // end
    3, 6, 2, 3, 7, 6, // top
];
