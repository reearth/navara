use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    system::{Commands, Query, Res, ResMut},
};

use geo_types::{Coord, Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point};
use navara_buffer_store::BufferStore;
use navara_core::{calc_transform, CRS};
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::{
    point::PointGeometry, polygon::PolygonGeometry, polygon::UpdatePolygon,
    polyline::PolylineGeometry, render::RenderableFeature,
};
use navara_geometry::Hierarchy;
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;
use navara_math::{std_float::consts::PI, FloatType, Vec3};
use navara_parser::mvt;
use regex::Regex;

use super::requester::MvtDataRequesterMarker;

#[derive(Debug)]
struct PosConverter {
    x0: f32,
    y0: f32,
    size: f32,
    scale_x: f32,
    scale_y: f32,
}

impl PosConverter {
    pub fn new(url: &str, extent: u32) -> Self {
        let mut converter = Self {
            x0: 0.0,
            y0: 0.0,
            size: 0.0,
            scale_x: 0.0,
            scale_y: 0.0,
        };

        if let Some((x, y, z)) = converter.get_tile_pos_from_url(url) {
            converter.x0 = (extent as f32) * (x as f32);
            converter.y0 = (extent as f32) * (y as f32);
            converter.size = (extent as f32) * (2_u64.pow(z) as f32);
            converter.scale_x = 360.0 / converter.size;
            converter.scale_y = 2.0 / converter.size;
        }

        converter
    }

    pub fn project_point(&mut self, pt: &Coord<f32>) -> (f32, f32) {
        let x = (pt.x + self.x0) * self.scale_x - 180.0;
        let exp_value = f32::exp((1.0 - (pt.y + self.y0) * self.scale_y) * PI);
        let y = 360.0 / PI * (f32::atan(exp_value)) - 90.0;

        (x, y)
    }

    pub fn project_points(&mut self, points: &Vec<Coord<f32>>) -> Vec<Vec3> {
        let mut ret = Vec::new();

        for pt in points {
            let (x, y) = self.project_point(pt);
            ret.push(Vec3::new(x as FloatType, y as FloatType, 0.0 as FloatType));
        }

        ret
    }

    fn get_tile_pos_from_url(&self, url: &str) -> Option<(u32, u32, u32)> {
        // Define a regular expression to match the three numbers in the URL
        let re = Regex::new(r"/(\d+)/(\d+)/(\d+)\.mvt$").unwrap();

        if let Some(captures) = re.captures(url) {
            // Parse and assign the three values to z, x, and y respectively
            let z: u32 = captures[1].parse().ok()?;
            let x: u32 = captures[2].parse().ok()?;
            let y: u32 = captures[3].parse().ok()?;

            // Return (x, y, z)
            Some((x, y, z))
        } else {
            None
        }
    }
}

pub fn request_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    for (e, layer) in &mvt_layers {
        commands.spawn((
            MvtDataRequesterMarker(e),
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Mvt,
            ),
        ));
    }
}

pub fn construct_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<(Entity, &MvtDataRequesterMarker, &DataRequester), Changed<DataRequester>>,
    mvt_layers: Query<(Entity, &MvtLayer)>,
) {
    for (e, marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match mvt_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };

        commands.entity(e).despawn();

        if let Some(mvt_bin) = buf.get_u8(&req.handle) {
            if let Ok(reader) = mvt::MvtReader::new((*mvt_bin).to_vec()) {
                if let Ok(layer_names) = reader.get_layer_names() {
                    for (index, _name) in layer_names.iter().enumerate() {
                        let extent = reader.get_extent(index);
                        let mut converter =
                            PosConverter::new(layer.data.as_ref().unwrap().url.as_str(), extent);
                        if converter.size == 0.0 {
                            continue;
                        }
                        if let Ok(features) = reader.get_features(index) {
                            for feature in features {
                                let geom = feature.get_geometry();
                                match geom {
                                    Geometry::MultiPolygon(v) => {
                                        let MultiPolygon(plgs) = v;

                                        if let Appearance::Polygon(appearance) =
                                            &layer.appearances[0]
                                        {
                                            for polygon in plgs {
                                                let LineString(outer) = polygon.exterior();
                                                let outer_vec = converter.project_points(outer);
                                                // TODO: holes are not support yet
                                                // let holes = polygon.interiors();
                                                // info!("holes.len {}", holes.len());

                                                if outer_vec.len() < 50 {
                                                    // A large number of polygons can cause the webpage to slow down,
                                                    // so for now, only draw some of the larger polygons.
                                                    continue;
                                                }

                                                commands.spawn((
                                                    LayerId(layer.layer_id.to_owned()),
                                                    PolygonGeometry {
                                                        hierarchy: Hierarchy {
                                                            outer_ring: outer_vec,
                                                            holes: std::vec::Vec::new(),
                                                        },
                                                        crs: CRS::Geographic,
                                                    },
                                                    appearance.clone(),
                                                ));
                                            }
                                        }
                                    }
                                    Geometry::MultiPoint(v) => {
                                        let MultiPoint(points) = v;

                                        if let Appearance::Point(appearance) = &layer.appearances[0]
                                        {
                                            for point in points {
                                                let Point(pt) = point;
                                                let (x, y) = converter.project_point(pt);

                                                commands.spawn((
                                                    LayerId(layer.layer_id.to_owned()),
                                                    PointGeometry {
                                                        coords: Vec3::new(x, y, 0.0),
                                                        crs: CRS::Geographic,
                                                    },
                                                    appearance.clone(),
                                                ));
                                            }
                                        }
                                    }
                                    Geometry::MultiLineString(v) => {
                                        let MultiLineString(lines) = v;

                                        if let Appearance::Polyline(appearance) =
                                            &layer.appearances[0]
                                        {
                                            for line in lines {
                                                let LineString(points) = line;
                                                let geo_points = converter.project_points(points);

                                                commands.spawn((
                                                    LayerId(layer.layer_id.to_owned()),
                                                    PolylineGeometry {
                                                        coords: geo_points,
                                                        crs: CRS::Geographic,
                                                    },
                                                    appearance.clone(),
                                                ));
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
        }

        buf.remove(&req.handle);
    }
}

pub fn update_mvt_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateMvtLayerMarker)>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                match &u.appearance {
                    Appearance::Point(pt) => {
                        if let RenderableFeature::Point {
                            coordinates,
                            crs,
                            material,
                            transform,
                            ..
                        } = f.as_mut()
                        {
                            let should_update_transform =
                                material.height != pt.height || material.size != pt.size;
                            *material = pt.clone();
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                    }
                    Appearance::Polyline(polyline) => {
                        if let RenderableFeature::Polyline { material, .. } = f.as_mut() {
                            *material = polyline.clone();
                        }
                    }
                    Appearance::Polygon(polygon) => {
                        if let RenderableFeature::Polygon { .. } = f.as_mut() {
                            commands.spawn(UpdatePolygon {
                                material: polygon.clone(),
                                feature_id: *id,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn delete_mvt_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteMvtLayerMarker)>,
    layers: Query<(Entity, &MvtLayer)>,
    mut features: Query<&mut RenderableFeature>,
    mut buf: ResMut<BufferStore>,
    entities_with_layerid: Query<(Entity, &LayerId)>,
) {
    for (e, d) in &deleted {
        let entities = layer_store.get(&d.0);
        if let Some(vec) = entities {
            // delete RenderableFeature and related Buffers
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    match &mut *feature {
                        RenderableFeature::Polyline { geometry, .. } => {
                            geometry.remove_from_buf(&mut buf);
                        }
                        RenderableFeature::Polygon { geometry, .. } => {
                            geometry.remove_from_buf(&mut buf);
                        }
                        _ => (),
                    }
                }

                commands.entity(*entity).despawn();
            }
        }

        // delete all entities with this layer id
        for (entity, l_id) in entities_with_layerid.iter() {
            if l_id.0 == d.0 {
                commands.entity(entity).despawn();
            }
        }

        // delete stored layer id
        layer_store.remove(&d.0);

        for (e, l) in &layers {
            if l.layer_id != d.0 {
                continue;
            }
            commands.entity(e).despawn();
        }

        commands.entity(e).despawn();
    }
}
