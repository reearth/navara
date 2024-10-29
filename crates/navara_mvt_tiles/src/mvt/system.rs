use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::{point, polygon::PolygonGeometry};
use navara_layer::{MvtLayer, LayerId};
use navara_geometry::Hierarchy;
use navara_material::{Appearance, PolygonMaterial};
use navara_math::{Quat, Transform, FloatType, Vec3, std_float::consts::PI};
use navara_parser::mvt;
use geo_types::{Geometry, MultiPolygon, LineString, Coord, MultiPoint, MultiLineString};
use regex::Regex;
use bevy_log::info;

use super::requester::MvtDataRequesterMarker;

#[derive(Debug)]
struct PosConverter{
    x0: u64,
    y0: u64,
    size: u64,
}

impl PosConverter{
    pub fn new(url: &str, extent: u32) -> Self {
        let mut converter = Self {
            x0: 0, y0: 0, size: 0
        };

        if let Some((x,y,z)) = converter.get_tile_pos_from_url(url){
            converter.x0 = (extent as u64) * (x as u64);
            converter.y0 = (extent as u64) * (y as u64);
            converter.size = (extent as u64) * 2_u64.pow(z);
        }

        converter
    }

    pub fn project_points(&mut self, points: &Vec<Coord<f32>>) -> Vec<Vec3>{
        let scale_x = 360.0 / self.size as f32;
        let scale_y = 2.0 / self.size as f32;
        let x0 = self.x0 as f32;
        let y0 = self.y0 as f32;

        let mut ret = Vec::new();

        for pt in points {
            let x = (pt.x as f32 + x0) * scale_x - 180.0;

            let exp_value = f32::exp((1.0 - (pt.y as f32 + y0) * scale_y) * PI);
            let y = 360.0 / PI * (f32::atan(exp_value)) - 90.0;
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
    buf: ResMut<BufferStore>,
    requesters: Query<(&MvtDataRequesterMarker, &DataRequester), Changed<DataRequester>>,
    mvt_layers: Query<(Entity, &MvtLayer)>,
) {
    for (marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match mvt_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };

        if let Some(mvt_bin) = buf.get_u8(&req.handle){
            if let Ok(reader) = mvt::MvtReader::new((*mvt_bin).to_vec()) {
                if let Ok(layer_names) = reader.get_layer_names(){
                    for (index, _name) in layer_names.iter().enumerate() {
                        let extent = reader.get_extent(index);
                        let mut converter = PosConverter::new(layer.data.as_ref().unwrap().url.as_str(), extent);
                        if converter.size == 0 {
                            continue;
                        }
                        if let Ok(features) = reader.get_features(index){
                            for feature in features{
                                let geom = feature.get_geometry();
                                match geom {
                                    Geometry::MultiPolygon(v) => {
                                        let MultiPolygon(plgs) = v;
                                        info!("polygon: {}", plgs.len());

                                        if let Appearance::Polygon(appearance) = &layer.appearances[0] {
                                            for polygon in plgs {
                                                let LineString(outer) = polygon.exterior();
                                                let outer_vec = converter.project_points(outer);
                                                // TODO: holes are not support yet
                                                // let holes = polygon.interiors();
                                                // info!("holes.len {}", holes.len());
    
                                                // if outer_vec.len() < 50 {
                                                //     continue;
                                                // }
    
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
                                    },
                                    Geometry::MultiPoint(v) => {
                                        let MultiPoint(points) = v;
                                        info!("points: {:?}", points);

                                        if let Appearance::Point(appearance) = &layer.appearances[0] {
                                        }
                                    },
                                    Geometry::MultiLineString(v) => {
                                        let MultiLineString(lines) = v;
                                        info!("lines: {:?}", lines);

                                        if let Appearance::Polyline(appearance) = &layer.appearances[0] {
                                        }
                                    },
                                    _ => {}
                                }
                            }

                        }
                    }                    
                } 
            }
        }
    }
}
