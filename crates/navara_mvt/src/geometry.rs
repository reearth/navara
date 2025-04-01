use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon};
use navara_buffer_store::BufferStore;
use navara_core::{TileXYZ, CRS};
use navara_feature_component::{
    batch::{
        BatchId, BatchIndex, BatchTable, FeatureBatchId, GlobalBatchIdAndSelections,
        IdPropertySelections, IdPropertyTable,
    },
    billboard::BillboardGeometry,
    id::FeatureId,
    point::PointGeometry,
    polygon::PolygonGeometry,
    polyline::PolylineGeometry,
    BatchedFeatureMarker, LODFeatureMarker,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::{FloatType, Vec2, Vec3};
use navara_parser::mvt;

use crate::{component::MVTFeatureMarker, pos_converter::PosConverter};

#[derive(Clone, Copy)]
pub(crate) enum ConstructedGeometryType {
    Point,
    Polyline,
    Polygon,
}

pub(crate) struct ConstructedGeometry {
    pub feature_ids: Vec<Entity>,
    pub geometry_type: ConstructedGeometryType,
    pub feature_batch_id: Option<FeatureBatchId>,
    pub global_batch_id_and_selections: Option<GlobalBatchIdAndSelections>,
}

// TODO: Store the coordinates into BufferStore.
// TODO: Move this process to worker.
#[allow(clippy::too_many_arguments)]
pub fn construct_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    id_prop_table_res: &mut IdPropertyTable,
    buf: &mut BufferStore,
    mvt_bin: Vec<u8>,
    id_prop_sel_res: &IdPropertySelections,
    layer_id: &str,
    xyz: TileXYZ,
    appearances: &[Appearance],
    limit_layers: &Option<Vec<String>>,
) -> Option<Vec<ConstructedGeometry>> {
    let mut result = vec![];

    let reader = mvt::MvtReader::new(mvt_bin).ok()?;
    let layer_names = reader.get_layer_names().ok()?;

    for (index, name) in layer_names.iter().enumerate() {
        let extent = reader.get_extent(index);
        let mut converter = PosConverter::new(xyz, extent);
        let features = match reader.get_features(index) {
            Ok(f) => f,
            Err(_) => continue,
        };

        if let Some(ll) = limit_layers {
            if !ll.contains(name) {
                continue;
            }
        }

        // Assume a feature has only one type of geometry.
        let mut geometry_type = Option::None;

        let mut feature_ids = vec![];

        let feature_batch_id = batch_table.init_values().unwrap_or(0);
        let mut global_batch_id_and_selections: Vec<u32> = vec![];

        for feature in features {
            let geom = feature.get_geometry();
            let props = feature
                .properties
                .as_ref()
                .and_then(|props| serde_json::to_value(props).ok())
                .unwrap_or(serde_json::Value::Null);
            let id_prop = get_id_property(geom, appearances);

            let batch_idx = BatchIndex((global_batch_id_and_selections.len() / 2) as u32);

            let batch_id = match geom {
                // For point
                // This should be unnecessary once point instancing is supported
                Geometry::Point(_) | Geometry::MultiPoint(_) => {
                    let batch_id = batch_table
                        .init_values_with_id_props(id_prop, props, id_prop_table_res)
                        .unwrap_or(0);
                    Some(BatchId(Vec2::new(
                        batch_id as FloatType,
                        batch_table.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                    )))
                }
                _ => {
                    let batch_id = batch_table
                        .add_id_prop(id_prop, &props, id_prop_table_res)
                        .unwrap_or(0);

                    batch_table.add_values(batch_id, props);

                    global_batch_id_and_selections.push(batch_id);
                    global_batch_id_and_selections
                        .push(batch_table.get_selection(&batch_id, id_prop_sel_res));

                    None
                }
            };

            handle_geometry(
                commands,
                buf,
                &mut feature_ids,
                &mut geometry_type,
                layer_id,
                geom,
                &mut converter,
                batch_id.as_ref(),
                // For batched feature
                &batch_idx,
                appearances,
            );
        }

        if feature_ids.is_empty() {
            continue;
        }

        let is_not_point_geometry = !(geometry_type.is_none()
            || matches!(geometry_type, Some(ConstructedGeometryType::Point)));

        result.push(ConstructedGeometry {
            feature_ids,
            geometry_type: geometry_type.unwrap(),
            feature_batch_id: is_not_point_geometry.then_some(FeatureBatchId(feature_batch_id)),
            global_batch_id_and_selections: is_not_point_geometry
                .then(|| GlobalBatchIdAndSelections(buf.new_u32(global_batch_id_and_selections))),
        });
    }

    Some(result)
}

fn get_id_property(geom: &Geometry<f32>, appearances: &[Appearance]) -> Option<String> {
    match geom {
        Geometry::MultiPolygon(_) | Geometry::Polygon(_) => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            {
                Some(Appearance::Polygon(a)) => {
                    return Some(a.id_property.clone());
                }
                _ => {
                    return None;
                }
            };
        }
        Geometry::MultiPoint(_) | Geometry::Point(_) => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Point(_)))
            {
                Some(Appearance::Point(a)) => {
                    return Some(a.id_property.clone());
                }
                _ => {
                    return None;
                }
            };
        }
        Geometry::MultiLineString(_) | Geometry::LineString(_) => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))
            {
                Some(Appearance::Polyline(a)) => {
                    return Some(a.id_property.clone());
                }
                _ => {
                    return None;
                }
            };
        }
        Geometry::GeometryCollection(geoms) => {
            for geom in &geoms.0 {
                if let Some(id) = get_id_property(geom, appearances) {
                    return Some(id);
                }
            }
        }
        _ => {}
    };

    None
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
    batch_id: Option<&BatchId>,
    batch_index: &BatchIndex,
    appearances: &[Appearance],
) {
    match geom {
        Geometry::MultiPolygon(v) => {
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polygon(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polygon);

            let MultiPolygon(plgs) = v;

            construct_polygons_geometry(commands, buf, feature_ids, plgs, batch_index, converter);
        }
        Geometry::Polygon(v) => {
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polygon(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polygon);

            construct_polygon_geometry(commands, buf, feature_ids, v, batch_index, converter);
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
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polyline(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polyline);

            let MultiLineString(lines) = v;

            construct_lines_geometry(commands, buf, feature_ids, lines, batch_index, converter);
        }
        Geometry::LineString(line) => {
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polyline(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polyline);

            construct_line_geometry(commands, buf, feature_ids, line, batch_index, converter);
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
                    batch_index,
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
    batch_id: Option<&BatchId>,
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
    batch_id: Option<&BatchId>,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    let Point(pt) = point;
    let (x, y) = converter.project_point(pt);

    let e = commands
        .spawn((
            LayerId(layer_id.to_owned()),
            BatchId(batch_id.unwrap().0),
            FeatureId::default(),
            geometry(x, y),
            appearance.clone(),
            // TODO: It can be removed if points is instanced or batched.
            LODFeatureMarker,
            // TODO: It can be removed if points is instanced or batched.
            MVTFeatureMarker,
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_lines_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    lines: &[LineString<f32>],
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
) -> usize {
    let mut count = 0;
    for line in lines {
        construct_line_geometry(commands, buf, feature_ids, line, batch_index, converter);
        count += line.0.len();
    }

    count
}

#[allow(clippy::too_many_arguments)]
fn construct_line_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    line: &LineString<f32>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
) {
    let LineString(points) = line;
    let geo_points = converter.project_points(points);

    if geo_points.is_empty() {
        return;
    }

    let e = commands
        .spawn((
            BatchedFeatureMarker,
            PolylineGeometry::with_buf(buf, geo_points, CRS::Geographic),
            BatchIndex(batch_index.0),
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_polygons_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    polygons: &[Polygon<f32>],
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
) {
    for polygon in polygons {
        construct_polygon_geometry(commands, buf, feature_ids, polygon, batch_index, converter);
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_polygon_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    polygon: &Polygon<f32>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
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

    if outer_vec.is_empty() {
        return;
    }

    let entity = commands.spawn((
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
        BatchIndex(batch_index.0),
    ));

    feature_ids.push(entity.id());
}
