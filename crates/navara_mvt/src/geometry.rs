use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon};
use navara_buffer_store::BufferStore;
use navara_core::{TileXYZ, CRS};
use navara_feature_component::{
    batch::BatchId, batch::BatchTable, billboard::BillboardGeometry, id::FeatureId,
    point::PointGeometry, polygon::PolygonGeometry, polyline::PolylineGeometry,
    BatchedFeatureMarker,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_parser::mvt;

use crate::pos_converter::PosConverter;

#[derive(Clone, Copy)]
pub(crate) enum ConstructedGeometryType {
    Point,
    Polyline,
    Polygon,
}

pub(crate) struct ConstructedGeometry {
    pub feature_ids: Vec<Entity>,
    pub geometry_type: ConstructedGeometryType,
}

// TODO: Store the coordinates into BufferStore.
// TODO: Move this process to worker.
pub fn construct_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    mvt_bin: &[u8],
    layer_id: &str,
    xyz: TileXYZ,
    appearances: &[Appearance],
) -> Option<Vec<ConstructedGeometry>> {
    let mut result = vec![];

    let reader = mvt::MvtReader::new((*mvt_bin).to_vec()).ok()?;
    let layer_names = reader.get_layer_names().ok()?;

    // TODO: Allow to specify a layer name.
    for (index, _name) in layer_names.iter().enumerate() {
        let extent = reader.get_extent(index);
        let mut converter = PosConverter::new(xyz, extent);
        let features = match reader.get_features(index) {
            Ok(f) => f,
            Err(_) => continue,
        };

        // Assume a feature has only one type of geometry.
        let mut geometry_type = Option::None;

        let mut feature_ids = vec![];

        for feature in features {
            let geom = feature.get_geometry();

            let mut op_batch_id = None;
            if let Some(prop) = &feature.properties {
                op_batch_id = batch_table.add_hash_map(prop);
            }

            if op_batch_id.is_none() {
                continue;
            }
            let batch_id = op_batch_id.unwrap();

            handle_geometry(
                commands,
                buf,
                &mut feature_ids,
                &mut geometry_type,
                layer_id,
                geom,
                &mut converter,
                &batch_id,
                appearances,
            );
        }

        if feature_ids.is_empty() {
            continue;
        }

        result.push(ConstructedGeometry {
            feature_ids,
            geometry_type: geometry_type.unwrap(),
        });
    }

    Some(result)
}

#[allow(clippy::too_many_arguments)]
fn handle_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    geometry_type: &mut Option<ConstructedGeometryType>,
    layer_id: &str,
    geom: &Geometry<f32>,
    converter: &mut PosConverter,
    batch_id: &u32,
    appearances: &[Appearance],
) {
    match geom {
        Geometry::MultiPolygon(v) => {
            *geometry_type = Some(ConstructedGeometryType::Polygon);

            let MultiPolygon(plgs) = v;

            let appearance = match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            {
                Some(Appearance::Polygon(a)) => a,
                _ => return,
            };

            construct_polygons_geometry(
                commands,
                buf,
                feature_ids,
                layer_id,
                plgs,
                converter,
                appearance,
                batch_id,
            );
        }
        Geometry::Polygon(v) => {
            *geometry_type = Some(ConstructedGeometryType::Polygon);

            let appearance = match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            {
                Some(Appearance::Polygon(a)) => a,
                _ => return,
            };

            construct_polygon_geometry(
                commands,
                buf,
                feature_ids,
                layer_id,
                v,
                converter,
                appearance,
                batch_id,
            );
        }
        Geometry::MultiPoint(v) => {
            *geometry_type = Some(ConstructedGeometryType::Point);

            let MultiPoint(points) = v;

            for one_appr in appearances {
                match one_appr {
                    Appearance::Point(appearance) => {
                        construct_points_geometry(
                            commands,
                            feature_ids,
                            layer_id,
                            points,
                            converter,
                            appearance,
                            |x, y| PointGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_id,
                        );
                        break;
                    }
                    Appearance::Billboard(appearance) => {
                        construct_points_geometry(
                            commands,
                            feature_ids,
                            layer_id,
                            points,
                            converter,
                            appearance,
                            |x, y| BillboardGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_id,
                        );
                        break;
                    }
                    _ => {}
                };
            }
        }
        Geometry::Point(point) => {
            *geometry_type = Some(ConstructedGeometryType::Point);

            for one_appr in appearances {
                match one_appr {
                    Appearance::Point(appearance) => {
                        construct_point_geometry(
                            commands,
                            feature_ids,
                            layer_id,
                            point,
                            converter,
                            appearance,
                            &|x, y| PointGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_id,
                        );
                        break;
                    }
                    Appearance::Billboard(appearance) => {
                        construct_point_geometry(
                            commands,
                            feature_ids,
                            layer_id,
                            point,
                            converter,
                            appearance,
                            &|x, y| BillboardGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_id,
                        );
                        break;
                    }
                    _ => {}
                };
            }
        }
        Geometry::MultiLineString(v) => {
            *geometry_type = Some(ConstructedGeometryType::Polyline);

            let MultiLineString(lines) = v;

            for one_appr in appearances {
                if let Appearance::Polyline(appearance) = one_appr {
                    construct_lines_geometry(
                        commands,
                        buf,
                        feature_ids,
                        layer_id,
                        lines,
                        converter,
                        appearance,
                        batch_id,
                    );
                    break;
                }
            }
        }
        Geometry::LineString(line) => {
            *geometry_type = Some(ConstructedGeometryType::Polyline);

            for one_appr in appearances {
                if let Appearance::Polyline(appearance) = one_appr {
                    construct_line_geometry(
                        commands,
                        buf,
                        feature_ids,
                        layer_id,
                        line,
                        converter,
                        appearance,
                        batch_id,
                    );
                    break;
                }
            }
        }
        Geometry::GeometryCollection(geoms) => {
            for geom in &geoms.0 {
                handle_geometry(
                    commands,
                    buf,
                    feature_ids,
                    geometry_type,
                    layer_id,
                    geom,
                    converter,
                    batch_id,
                    appearances,
                );
            }
        }
        _ => {}
    };
}

#[allow(clippy::too_many_arguments)]
fn construct_points_geometry<A: Component + Clone, G: Component, F>(
    commands: &mut Commands,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    points: &[Point<f32>],
    converter: &mut PosConverter,
    appearance: &A,
    geometry: F,
    batch_id: &u32,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    for point in points {
        construct_point_geometry(
            commands,
            feature_ids,
            layer_id,
            point,
            converter,
            appearance,
            &geometry,
            batch_id,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_point_geometry<A: Component + Clone, G: Component, F>(
    commands: &mut Commands,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    point: &Point<f32>,
    converter: &mut PosConverter,
    appearance: &A,
    geometry: &F,
    batch_id: &u32,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    let Point(pt) = point;
    let (x, y) = converter.project_point(pt);

    let e = commands
        .spawn((
            LayerId(layer_id.to_owned()),
            BatchId(*batch_id),
            FeatureId::default(),
            geometry(x, y),
            appearance.clone(),
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_lines_geometry<A: Component + Clone>(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    lines: &[LineString<f32>],
    converter: &mut PosConverter,
    appearance: &A,
    batch_id: &u32,
) -> usize {
    let mut count = 0;
    for line in lines {
        construct_line_geometry(
            commands,
            buf,
            feature_ids,
            layer_id,
            line,
            converter,
            appearance,
            batch_id,
        );
        count += line.0.len();
    }

    count
}

#[allow(clippy::too_many_arguments)]
fn construct_line_geometry<A: Component + Clone>(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    line: &LineString<f32>,
    converter: &mut PosConverter,
    appearance: &A,
    batch_id: &u32,
) {
    let LineString(points) = line;
    let geo_points = converter.project_points(points);

    let e = commands
        .spawn((
            LayerId(layer_id.to_owned()),
            BatchedFeatureMarker,
            PolylineGeometry::with_buf(buf, geo_points, CRS::Geographic),
            appearance.clone(),
            BatchId(*batch_id),
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_polygons_geometry<A: Component + Clone>(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    polygons: &[Polygon<f32>],
    converter: &mut PosConverter,
    appearance: &A,
    batch_id: &u32,
) {
    for polygon in polygons {
        construct_polygon_geometry(
            commands,
            buf,
            feature_ids,
            layer_id,
            polygon,
            converter,
            appearance,
            batch_id,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_polygon_geometry<A: Component + Clone>(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    layer_id: &str,
    polygon: &Polygon<f32>,
    converter: &mut PosConverter,
    appearance: &A,
    batch_id: &u32,
) {
    let LineString(outer) = polygon.exterior();
    let outer_vec = converter.project_points(outer);

    let interiors = polygon.interiors();
    let mut holes: Vec<Hierarchy> = Vec::new();

    // In the MVT spec, it is mentioned that the outer ring of a polygon is clockwise,
    // which is based on the origin being at the top-left.
    for LineString(hole) in interiors {
        holes.push(Hierarchy {
            outer_ring: converter.project_points(hole),
            holes: None,
            expected_winding_order: WindingOrder::CounterClockwise,
        });
    }

    let entity = commands.spawn((
        LayerId(layer_id.to_owned()),
        BatchedFeatureMarker,
        PolygonGeometry {
            hierarchy: Hierarchy {
                outer_ring: outer_vec,
                holes: Some(holes),
                expected_winding_order: WindingOrder::Clockwise,
            }
            .transfer(buf),
            crs: CRS::Geographic,
        },
        appearance.clone(),
        BatchId(*batch_id),
    ));

    feature_ids.push(entity.id());
}
