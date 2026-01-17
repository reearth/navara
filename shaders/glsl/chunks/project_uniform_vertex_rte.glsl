// RTE (Relative-To-Eye) Projection for Uniforms
//
// This chunk performs the projection transformation for RTE-encoded positions
// passed as uniforms (e.g., for Sprites or single-point geometries).
// It uses modelViewMatrixRTE (rotation only) instead of modelViewMatrix (including translation),
// because 'transformed' is already camera-relative from RTE computation.
//
// Difference from project_vertex_rte.glsl:
// - Designed for uniform-based RTE (used with rte_uniform_vertex.glsl)
// - Same logic but intended for single-vertex geometries
//
// This should be used after RTE position decoding has been performed
// (i.e., after including rte_uniform_vertex.glsl).
//
// The 'transformed' and 'absTransformed' variables should already exist
// from RTE computation before this chunk is used.

// Use modelViewMatrixRTE (rotation only) instead of modelViewMatrix
// because 'transformed' is already camera-relative from RTE computation
mvPosition = modelViewMatrixRTE * vec4(transformed, 1.0);
