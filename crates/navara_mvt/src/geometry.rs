use bevy_ecs::{entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point};
use navara_core::CRS;
use navara_feature::{
    point::PointGeometry,
    polygon::{BatchId, PolygonGeometry},
    polyline::PolylineGeometry,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_parser::mvt;

use crate::pos_converter::PosConverter;

// TODO: Move this process to worker.
pub fn construct_geometry(
    commands: &mut Commands,
    mvt_bin: &[u8],
    layer_id: &str,
    url: &str,
    appearances: &[Appearance],
) -> Option<Vec<Entity>> {
    let mut polygon_idx = 0;
    let mut feature_ids = vec![];

    let reader = mvt::MvtReader::new((*mvt_bin).to_vec()).ok()?;
    let layer_names = reader.get_layer_names().ok()?;

    for (index, _name) in layer_names.iter().enumerate() {
        let extent = reader.get_extent(index);
        let mut converter = PosConverter::new(url, extent);
        let features = match reader.get_features(index) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for feature in features {
            let geom = feature.get_geometry();
            match geom {
                Geometry::MultiPolygon(v) => {
                    let MultiPolygon(plgs) = v;

                    let appearance = match appearances
                        .iter()
                        .find(|a| matches!(a, Appearance::Polygon(_)))
                    {
                        Some(Appearance::Polygon(a)) => a,
                        _ => continue,
                    };

                    // TODO: Merge these geometries into one
                    for polygon in plgs {
                        let LineString(outer) = polygon.exterior();
                        let outer_vec = converter.project_points(outer);

                        let interiors = polygon.interiors();
                        let mut holes: Vec<Hierarchy> = Vec::new();

                        // In the MVT spec, it is mentioned that the outer ring of a polygon is clockwise,
                        // which is based on the origin being at the top-left.
                        // However, after converting to geographic coordinates, it is actually counterclockwise.
                        for LineString(hole) in interiors {
                            holes.push(Hierarchy {
                                outer_ring: converter.project_points(hole),
                                holes: None,
                                expected_winding_order: WindingOrder::CounterClockwise,
                            });
                        }

                        let entity = commands.spawn((
                            LayerId(layer_id.to_owned()),
                            PolygonGeometry {
                                hierarchy: Hierarchy {
                                    outer_ring: outer_vec,
                                    holes: Some(holes),
                                    expected_winding_order: WindingOrder::Clockwise,
                                },
                                crs: CRS::Geographic,
                            },
                            appearance.clone(),
                            BatchId(polygon_idx),
                        ));

                        feature_ids.push(entity.id());

                        polygon_idx += 1;
                    }
                }
                Geometry::MultiPoint(v) => {
                    let MultiPoint(points) = v;

                    for one_appr in appearances {
                        if let Appearance::Point(appearance) = one_appr {
                            for point in points {
                                let Point(pt) = point;
                                let (x, y) = converter.project_point(pt);

                                commands.spawn((
                                    LayerId(layer_id.to_owned()),
                                    PointGeometry {
                                        coords: Vec3::new(x, y, 0.0 as FloatType),
                                        crs: CRS::Geographic,
                                    },
                                    appearance.clone(),
                                ));
                            }
                            break;
                        }
                    }
                }
                Geometry::MultiLineString(v) => {
                    let MultiLineString(lines) = v;

                    for one_appr in appearances {
                        if let Appearance::Polyline(appearance) = one_appr {
                            for line in lines {
                                let LineString(points) = line;
                                let geo_points = converter.project_points(points);

                                commands.spawn((
                                    LayerId(layer_id.to_owned()),
                                    PolylineGeometry {
                                        coords: geo_points,
                                        crs: CRS::Geographic,
                                    },
                                    appearance.clone(),
                                ));
                            }
                            break;
                        }
                    }
                }
                _ => {}
            }
        }
    }

    Some(feature_ids)
}
