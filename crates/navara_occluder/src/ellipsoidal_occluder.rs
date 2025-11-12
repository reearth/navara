use bevy_ecs::component::Component;
use navara_core::Ellipsoid;
use navara_math::{FloatType, Vec3};

/// This is used to occlude a point by horizon occlusion.
/// This is based on Cesium's implementation.
/// Ref
///   - https://cesium.com/blog/2013/04/25/horizon-culling/
///   - https://cesium.com/blog/2013/05/09/computing-the-horizon-occlusion-point/
#[derive(Default, Component)]
pub struct EllipsoidalOccluder {
    pub camera_position_in_scaled_space: Vec3,
    pub distance_to_ellipsoid_surface_squared: FloatType,
}

impl EllipsoidalOccluder {
    pub fn new(camera_position: &Vec3, ellipsoid: Ellipsoid<FloatType>) -> Self {
        let mut this = Self::default();
        this.update(camera_position, ellipsoid);
        this
    }

    pub fn update(&mut self, camera_position: &Vec3, ellipsoid: Ellipsoid<FloatType>) {
        self.camera_position_in_scaled_space = Vec3::from_array(
            ellipsoid.transform_position_to_scaled_space(camera_position.to_array()),
        );
        self.distance_to_ellipsoid_surface_squared =
            self.camera_position_in_scaled_space.length_squared() - 1.;
    }

    /// Ref: https://github.com/CesiumGS/cesium/blob/16674c161b161755c9143c2940a062042cecaefa/packages/engine/Source/Core/EllipsoidalOccluder.js#L197
    // FIXME: Support the terrain under the tile.
    pub fn compute_horizontal_culling_point(
        &self,
        ellipsoid: &Ellipsoid<FloatType>,
        direction_to_point: Vec3,
        positions: Vec<Vec3>,
    ) -> Option<Vec3> {
        compute_horizon_culling_point_from_positions(ellipsoid, direction_to_point, positions)
    }

    pub fn is_scaled_space_point_visible(&self, occludee_scaled_space_position: Vec3) -> bool {
        is_scaled_space_point_visible(
            occludee_scaled_space_position,
            self.camera_position_in_scaled_space,
            self.distance_to_ellipsoid_surface_squared,
        )
    }
}

// The detils of this function is: https://cesium.com/blog/2013/05/09/computing-the-horizon-occlusion-point/
// Ref: https://github.com/CesiumGS/cesium/blob/16674c161b161755c9143c2940a062042cecaefa/packages/engine/Source/Core/EllipsoidalOccluder.js#L383
fn compute_horizon_culling_point_from_positions(
    ellipsoid: &Ellipsoid<FloatType>,
    direction_to_point: Vec3,
    positions: Vec<Vec3>,
) -> Option<Vec3> {
    let scaled_space_direction_to_point =
        compute_scaled_space_direction_to_point(ellipsoid, direction_to_point);

    let mut max_mag: FloatType = 0.;
    for position in positions {
        let mag = compute_magnitude(ellipsoid, position, scaled_space_direction_to_point);
        if mag < 0. {
            return None;
        }
        max_mag = max_mag.max(mag);
    }

    magnitude_to_point(scaled_space_direction_to_point, max_mag)
}

fn compute_scaled_space_direction_to_point(
    ellipsoid: &Ellipsoid<FloatType>,
    direction_to_point: Vec3,
) -> Vec3 {
    if direction_to_point == Vec3::ZERO {
        return direction_to_point;
    }
    Vec3::from_array(ellipsoid.transform_position_to_scaled_space(direction_to_point.to_array()))
        .normalize()
}

fn compute_magnitude(
    ellipsoid: &Ellipsoid<FloatType>,
    position: Vec3,
    scaled_space_direction_to_point: Vec3,
) -> FloatType {
    let scaled_space_position =
        Vec3::from_array(ellipsoid.transform_position_to_scaled_space(position.to_array()));
    let mag_squared = scaled_space_position.length_squared();
    let mag = mag_squared.sqrt();
    let direction = scaled_space_position / mag;

    // For the purpose of the computation of the max, points below the ellipsoid are consider to be on it instead.
    let suppressed_mag_squared = mag_squared.max(1.);
    let suppressed_mag = mag.max(1.);

    let cos_a = direction.dot(scaled_space_direction_to_point);
    let sin_a = direction.cross(scaled_space_direction_to_point).length();
    let cos_b = 1. / suppressed_mag;
    let sin_b = (suppressed_mag_squared - 1.).sqrt() * cos_b;

    1. / (cos_a * cos_b - sin_a * sin_b)
}

fn magnitude_to_point(scaled_space_direction_to_point: Vec3, max_mag: FloatType) -> Option<Vec3> {
    // The horizon culling point is undefined if there were no positions from which to compute it,
    // the directionToPoint is pointing opposite all of the positions,  or if we computed NaN or infinity.
    if max_mag <= 0.0 || max_mag.is_infinite() {
        return None;
    }

    Some(scaled_space_direction_to_point * max_mag)
}

fn is_scaled_space_point_visible(
    occludee_scaled_space_position: Vec3,
    camera_position_in_scaled_space: Vec3,
    distance_to_ellipsoid_surface_squared: FloatType,
) -> bool {
    // See https://cesium.com/blog/2013/04/25/horizon-culling/
    let cv = camera_position_in_scaled_space;
    let vh_magnitude_squared = distance_to_ellipsoid_surface_squared;
    let vt = occludee_scaled_space_position - cv;
    let vt_dot_vc = -vt.dot(cv);
    // If vh_magnitude_squared < 0 then we are below the surface of the ellipsoid and
    // in this case, set the culling plane to be on V.
    let is_occluded = if vh_magnitude_squared < 0. {
        vt_dot_vc > 0.
    } else {
        vt_dot_vc > vh_magnitude_squared
            && (vt_dot_vc * vt_dot_vc) / vt.length_squared() > vh_magnitude_squared
    };
    !is_occluded
}

#[cfg(test)]
mod test {

    use approx::assert_abs_diff_eq;
    use navara_core::{WGS84_64, WGS84_A_64};
    use navara_math::{AbsDiffEqVec3, Vec3, EPSILON5};
    use navara_mock::camera::update_camera_transform;

    use super::EllipsoidalOccluder;

    #[test]
    fn it_should_return_some_or_none() {
        let (camera_pos, _camera_lle) = update_camera_transform(WGS84_A_64 * 2.);
        let occluder = EllipsoidalOccluder::new(&camera_pos, WGS84_64);

        let center = Vec3::new(WGS84_A_64 / 2., WGS84_A_64 / 2., WGS84_A_64);
        assert_abs_diff_eq!(
            AbsDiffEqVec3(
                occluder
                    .compute_horizontal_culling_point(
                        &WGS84_64,
                        center,
                        vec![Vec3::new(center.x + 100., center.y, center.z - 100.)]
                    )
                    .unwrap()
            ),
            AbsDiffEqVec3(Vec3::new(0.5000035, 0.5000035, 1.003371)),
            epsilon = Vec3::new(EPSILON5, EPSILON5, EPSILON5)
        );
        debug_assert!(occluder
            .compute_horizontal_culling_point(
                &WGS84_64,
                center,
                vec![Vec3::new(-center.x, -center.y, -center.z)]
            )
            .is_none());
    }

    #[test]
    fn it_should_be_occluded() {
        let (camera_pos, _camera_lle) = update_camera_transform(WGS84_A_64 * 1.5);
        let occluder = EllipsoidalOccluder::new(&camera_pos, WGS84_64);

        let center = Vec3::new(WGS84_A_64 / 2., WGS84_A_64 / 2., -WGS84_A_64);
        let occludee_point = occluder
            .compute_horizontal_culling_point(
                &WGS84_64,
                center,
                vec![Vec3::new(center.x + 100., center.y, center.z - 100.)],
            )
            .unwrap();
        debug_assert!(occluder.is_scaled_space_point_visible(occludee_point));

        let center = Vec3::new(WGS84_A_64 / 2., 0., -WGS84_A_64);
        let occludee_point = occluder
            .compute_horizontal_culling_point(
                &WGS84_64,
                center,
                vec![Vec3::new(center.x - 100., center.y, center.z + 100.)],
            )
            .unwrap();
        debug_assert!(!occluder.is_scaled_space_point_visible(occludee_point));
    }
}
