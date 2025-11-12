use navara_core::{Extent, Radians, CRS, WGS84_64};
use navara_geometry::{create_polyline_geometry, PolylineGeometryOptions};
use navara_material::PolylineMaterial;
use navara_math::Vec3;

pub fn construct_polyline_feature(
    material: &PolylineMaterial,
    coords: Vec<f64>,
    crs: &CRS,
) -> Option<(Extent<f64, Radians>, navara_geometry::PolylineGeometry)> {
    let mut latlngs = vec![];
    let mut positions = vec![];
    for i in 0..coords.len() / 3 {
        let i = i * 3;
        let vec3 = Vec3::new(coords[i], coords[i + 1], coords[i + 2]);
        latlngs.push(crs.to_lng_lat(WGS84_64, vec3));
        positions.push(crs.to_lle(WGS84_64, vec3, material.height));
    }

    let extent = Extent::from_points(&latlngs);

    create_polyline_geometry(
        WGS84_64,
        PolylineGeometryOptions {
            positions,
            clamp_to_ground: material.clamp_to_ground,
            ..Default::default()
        },
    )
    .map(|g| (extent, g))
}
