use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{Angle, Meters, CRS, LLE, WGS84_32};
use navara_geometry::{
    create_polygon_geometry, Hierarchy, PolygonGeometryOptions, PolygonResource,
    TransferableFloatAttribute,
};
use navara_layer::PolygonMaterial;
use navara_math::Transform;

use crate::render::{RenderInformation, RenderableFeature, TransferablePolygonGeometry};

use super::{PolygonGeometry, PolygonMarker};

fn to_transferable_geometry(
    buf: &mut ResMut<BufferStore>,
    geo: navara_geometry::PolygonGeometry,
) -> TransferablePolygonGeometry {
    let position = buf.new_f32(geo.attributes.position.data);
    let normal = geo.attributes.normal.map(|n| (buf.new_f32(n.data), n.size));
    let indices = buf.new_u32(geo.indices);

    TransferablePolygonGeometry {
        position: TransferableFloatAttribute {
            data: position,
            size: geo.attributes.position.size,
        },
        normal: normal.map(|(normal, size)| TransferableFloatAttribute { data: normal, size }),
        indices,
    }
}

pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    polygon: Query<(Entity, &PolygonGeometry, &PolygonMaterial), Added<PolygonGeometry>>,
    mut polygon_resource: ResMut<PolygonResource>,
) {
    for (entity, geometry, material) in &polygon {
        let hierarchy = match geometry.crs {
            CRS::Geographic => {
                let mut hierarchy = Hierarchy::default();
                for c in &geometry.hierarchy.outer_ring {
                    let lng = c.x;
                    let lat = c.y;
                    let height = c.z;

                    hierarchy.outer_ring.push(
                        LLE {
                            lng: Angle::new(lng),
                            lat: Angle::new(lat),
                            height: Meters::new(height + material.height),
                        }
                        .rad()
                        .to_xyz(WGS84_32)
                        .into(),
                    );
                }
                for c in &geometry.hierarchy.holes {
                    let lng = c.x;
                    let lat = c.y;
                    let height = c.z;

                    hierarchy.holes.push(
                        LLE {
                            lng: Angle::new(lng),
                            lat: Angle::new(lat),
                            height: Meters::new(height + material.height),
                        }
                        .rad()
                        .to_xyz(WGS84_32)
                        .into(),
                    );
                }
                hierarchy
            }
            CRS::Geocentric => unimplemented!(),
            CRS::ESPG { code: _ } => unimplemented!(),
        };

        if let Some(geometry) = create_polygon_geometry(
            PolygonGeometryOptions {
                hierarchy,
                clamp_to_ground: material.clamp_to_ground,
                extruded_height: material.extruded_height.unwrap_or_default(),
                ..Default::default()
            },
            &mut polygon_resource,
        ) {
            // TODO: Don't forget removing the stored data from BufferStore when the feature is removed.
            let mut material = material.clone();
            // Disable clamping to ground when the extruded height is specified.
            material.clamp_to_ground = material.extruded_height.is_none();
            commands.spawn((
                PolygonMarker,
                RenderableFeature::Polygon {
                    material: material.clone(),
                    geometry: to_transferable_geometry(&mut buf, geometry),
                    transform: Transform::default(),
                    feature_id: entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                    },
                },
            ));
        }
    }
}
