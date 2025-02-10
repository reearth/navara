use bevy_ecs::component::Component;
use navara_core::{Aabb, Plane, WGS84_B_32};
use navara_math::{FloatType, Quat, Transform, Vec3};

#[derive(Component)]
pub struct CameraMarker;

// TODO: Support orthogonal camera.
/// Frustum for perspective camera.
#[derive(Component)]
pub struct CameraFrustum {
    pub near: FloatType,
    pub far: FloatType,
    pub fov: FloatType,
    pub fov_y: FloatType,
    pub aspect_ratio: FloatType,
    pub sse_denominator: FloatType,
    // This is used to expand the frustum for culling.
    pub fov_scale: FloatType,
    pub planes: [Plane; 6],
}

impl CameraFrustum {
    pub fn new(
        transform: &Transform,
        near: FloatType,
        far: FloatType,
        fov: FloatType,
        aspect_ratio: FloatType,
        fov_scale: FloatType,
    ) -> Self {
        let mut this = Self {
            near,
            far,
            fov,
            fov_y: 0.,
            sse_denominator: 0.,
            aspect_ratio,
            planes: [Default::default(); 6],
            fov_scale,
        };

        this.update_sse_denominator();
        this.update_planes(transform);

        this
    }

    pub fn update_sse_denominator(&mut self) {
        let fov = self.fov * (self.fov_scale * 0.9).max(1.);
        let fov_y = if self.aspect_ratio <= 1. {
            fov
        } else {
            ((fov * 0.5).tan() / self.aspect_ratio).atan() * 2.
        };
        self.fov_y = fov_y;
        self.sse_denominator = 2. * (fov_y * 0.5).tan();
    }

    pub fn update_planes(&mut self, transform: &Transform) {
        let fov = self.fov * self.fov_scale;
        let half_v_side = self.far * (fov * 0.5).tan();
        let half_h_side = half_v_side * self.aspect_ratio;
        let front_far = self.far * transform.forward();

        let forward = transform.forward();
        let right = transform.right();
        let up = transform.up();

        let near_center = transform.translation + forward * self.near;
        let far_center = transform.translation + front_far;

        self.planes = [
            // Near
            Plane::from_point_normal(near_center, forward.as_vec3()),
            // Far
            Plane::from_point_normal(far_center, -forward.as_vec3()),
            // Right
            Plane::from_point_normal(
                transform.translation,
                (front_far - right * half_h_side)
                    .cross(up.as_vec3())
                    .normalize(),
            ),
            // Left
            Plane::from_point_normal(
                transform.translation,
                up.cross(front_far + right * half_h_side).normalize(),
            ),
            // Top
            Plane::from_point_normal(
                transform.translation,
                right.cross(front_far - up * half_v_side).normalize(),
            ),
            // Bottom
            Plane::from_point_normal(
                transform.translation,
                (front_far + up * half_v_side)
                    .cross(right.as_vec3())
                    .normalize(),
            ),
        ];
    }

    pub fn intersection_with_aabb(&self, aabb: &Aabb) -> bool {
        for plane in self.planes.iter() {
            if !aabb.is_on_or_forward_plane(plane) {
                return false;
            }
        }
        true
    }
}

#[derive(Component)]
pub struct CameraController {
    pub enabled: bool,
    pub enable_spin: bool,
    pub enable_zoom: bool,
    pub enable_tilt: bool,
    pub enable_look: bool,
    pub minimum_zoom_distance: FloatType,
    pub maximum_zoom_distance: FloatType,
    pub spin_speed: FloatType,
    pub rotate_speed: FloatType,
    pub zoom_speed: FloatType,
    pub spin_duration: f32,
    pub zoom_duration: f32,
    pub inertia: FloatType,
    pub is_tilting: bool,
}

impl CameraController {
    pub fn reset_mode(&mut self) {
        self.is_tilting = false;
    }
}

impl Default for CameraController {
    fn default() -> Self {
        Self {
            enabled: true,
            enable_spin: true,
            enable_zoom: true,
            enable_tilt: true,
            enable_look: true,
            minimum_zoom_distance: WGS84_B_32,
            maximum_zoom_distance: WGS84_B_32 * 10.0,
            spin_speed: 2.0,
            rotate_speed: 1.,
            zoom_speed: 0.6,
            spin_duration: 500.,
            zoom_duration: 100.,
            inertia: 0.5,
            is_tilting: false,
        }
    }
}

#[derive(Component, Default)]
pub struct CameraInertia {
    pub spin: Vec3,
    pub spin_time: f32,
    pub translate: Vec3,
    pub zoom: FloatType,
    pub zoom_time: f32,
    pub pan: Vec3,
}

impl CameraInertia {
    pub fn spin(&mut self, v: Vec3) {
        self.spin = v;
        self.spin_time = 0.;
        self.zoom = 0.;
    }

    pub fn zoom(&mut self, v: f32) {
        self.zoom = v;
        self.zoom_time = 0.;
        self.spin = Vec3::ZERO;
    }
}

#[derive(Component, Default, Clone)]
pub struct Orbit {
    pub quat: Quat,
    pub world_quat: Quat,
    pub default_world_quat: Option<Quat>,
    pub pivot: Vec3,
    pub horizontal_axis: Vec3,
    pub vertical_axis: Vec3,
    pub local_up: Vec3,
    pub local_forward: Vec3,
    pub local_position: Vec3,
    pub should_tilt: bool,
}

impl Orbit {
    pub fn get_default_world_quat(&mut self) -> Quat {
        match self.default_world_quat.take() {
            Some(d) => d,
            None => self.world_quat,
        }
    }

    pub fn set_quat(
        &mut self,
        transform: &Transform,
        world: Quat,
        center: Vec3,
        tilt: bool,
        fixed_horizon_axis: Option<Vec3>,
    ) {
        self.quat = Quat::IDENTITY;
        self.world_quat = world;

        self.pivot = center;

        let position = transform.transform_point(Vec3::ZERO);

        let inverse = self.world_quat.inverse();

        let direction = position - center;

        self.local_up = inverse * transform.up().as_vec3();
        self.local_forward = if tilt {
            inverse * -direction.normalize_or_zero()
        } else {
            inverse * transform.forward().as_vec3()
        };
        self.local_position = inverse * direction;

        self.vertical_axis = inverse * transform.right().as_vec3();

        match fixed_horizon_axis {
            Some(a) => {
                self.horizontal_axis = a;
            }
            None => {
                self.horizontal_axis = self.local_up;
            }
        }
    }
}

#[cfg(test)]
mod test {
    use navara_core::{Aabb, Angle, Plane};
    use navara_math::{Transform, Vec3};

    use super::CameraFrustum;

    #[test]
    fn is_frustum_plane_correct() {
        let camera = Transform::from_xyz(0., 0., -10.);
        let camera = camera.looking_at(Vec3::new(0., 0., 0.), Vec3::Y);

        let frustum = CameraFrustum::new(&camera, 0.1, 1000., Angle::new(50.).rad().val(), 1., 1.);
        debug_assert_eq!(
            frustum.planes[0],
            Plane::from_point_normal(Vec3::new(0., 0., -9.9), Vec3::new(0., 0., 1.))
        );
        debug_assert_eq!(
            frustum.planes[1],
            Plane::from_point_normal(Vec3::new(0., 0., 990.), Vec3::new(0., 0., -1.))
        );
        debug_assert_eq!(
            frustum.planes[2],
            Plane::from_point_normal(
                Vec3::new(0., 0., -10.),
                Vec3::new(-0.90630776, 0.0, 0.42261827)
            )
        );
        debug_assert_eq!(
            frustum.planes[3],
            Plane::from_point_normal(
                Vec3::new(0., 0., -10.),
                Vec3::new(0.90630776, 0.0, 0.42261827)
            )
        );
        debug_assert_eq!(
            frustum.planes[4],
            Plane::from_point_normal(
                Vec3::new(0., 0., -10.),
                Vec3::new(0.0, 0.90630776, 0.42261827)
            )
        );
        debug_assert_eq!(
            frustum.planes[5],
            Plane::from_point_normal(
                Vec3::new(0., 0., -10.),
                Vec3::new(0.0, -0.90630776, 0.42261827)
            )
        );
    }

    #[test]
    fn frustum_should_intersect_with_aabb() {
        let camera = Transform::from_xyz(0., 0., -10.);
        let camera = camera.looking_at(Vec3::new(0., 0., 0.), Vec3::Y);

        let frustum = CameraFrustum::new(&camera, 0.1, 1000., Angle::new(50.).rad().val(), 1., 1.);

        let aabb = Aabb::from_vec3(&[Vec3::new(-10., -1., 10.), Vec3::new(10., 1., 30.)]);
        debug_assert!(frustum.intersection_with_aabb(&aabb));

        let aabb = Aabb::from_vec3(&[Vec3::new(10., 10., 100.), Vec3::new(20., 20., 100.)]);
        debug_assert!(frustum.intersection_with_aabb(&aabb));

        let aabb = Aabb::from_vec3(&[
            Vec3::new(-1000., -1000., -1000.),
            Vec3::new(1000., 1000., -9.8),
        ]);
        debug_assert!(frustum.intersection_with_aabb(&aabb));

        // Out of top
        let aabb = Aabb::from_vec3(&[Vec3::new(100., 100., 10.), Vec3::new(120., 120., 10.)]);
        debug_assert!(!frustum.intersection_with_aabb(&aabb));

        // Out of bottom
        let aabb = Aabb::from_vec3(&[Vec3::new(-100., -100., 10.), Vec3::new(-120., -120., 10.)]);
        debug_assert!(!frustum.intersection_with_aabb(&aabb));
    }
}
