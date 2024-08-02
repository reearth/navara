use bevy_ecs::{bundle::Bundle, component::Component};
use navara_core::{Aabb, Plane};
use navara_math::{Quat, Transform, Vec3};

#[derive(Component)]
pub struct CameraMarker;

#[derive(Bundle)]
pub struct CameraBundle {
    pub marker: CameraMarker,
    pub transform: Transform,
}

#[derive(Debug, Component)]
pub struct CameraFrustum {
    pub near: f32,
    pub far: f32,
    pub fov: f32,
    pub fov_y: f32,
    pub aspect_ratio: f32,
    pub sse_denominator: f32,
    pub planes: [Plane; 6],
}

impl CameraFrustum {
    pub fn new(transform: &Transform, near: f32, far: f32, fov: f32, aspect_ratio: f32) -> Self {
        let mut this = Self {
            near,
            far,
            fov,
            fov_y: 0.,
            sse_denominator: 0.,
            aspect_ratio,
            planes: [Default::default(); 6],
        };

        this.update_sse_denominator();
        this.update_planes(transform);

        this
    }

    pub fn update_sse_denominator(&mut self) {
        let fov_y = if self.aspect_ratio <= 1. {
            self.fov
        } else {
            ((self.fov * 0.5).tan() / self.aspect_ratio).atan() * 2.
        };
        self.fov_y = fov_y;
        self.sse_denominator = 2. * (fov_y * 0.5).tan();
    }

    pub fn update_planes(&mut self, transform: &Transform) {
        let half_v_side = self.far * (self.fov * 0.5).tan();
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

    pub fn interseciton_with_aabb(&self, aabb: &Aabb) -> bool {
        for plane in self.planes {
            if !aabb.is_on_or_forward_plane(&plane) {
                return false;
            }
        }

        true
    }
}

#[derive(Debug, Clone, Copy, Component)]
pub struct Orbit {
    pub r: f32,
    pub quat: Quat,
    pub tilt: f32,
}

impl Orbit {
    pub fn to_vec3(self) -> Vec3 {
        self.quat * Vec3::new(0.0, self.r, 0.0)
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

        let frustum = CameraFrustum::new(&camera, 0.1, 1000., Angle::new(50.).rad().val(), 1.);
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

        let frustum = CameraFrustum::new(&camera, 0.1, 1000., Angle::new(50.).rad().val(), 1.);

        let aabb = Aabb::from_points(Vec3::new(-10., -1., 10.), Vec3::new(10., 1., 30.));
        debug_assert!(frustum.interseciton_with_aabb(&aabb));

        let aabb = Aabb::from_points(Vec3::new(10., 10., 100.), Vec3::new(20., 20., 100.));
        debug_assert!(frustum.interseciton_with_aabb(&aabb));

        let aabb = Aabb::from_points(
            Vec3::new(-1000., -1000., -1000.),
            Vec3::new(1000., 1000., -9.8),
        );
        debug_assert!(frustum.interseciton_with_aabb(&aabb));

        // Out of top
        let aabb = Aabb::from_points(Vec3::new(100., 100., 10.), Vec3::new(120., 120., 10.));
        debug_assert!(!frustum.interseciton_with_aabb(&aabb));

        // Out of bottom
        let aabb = Aabb::from_points(Vec3::new(-100., -100., 10.), Vec3::new(-120., -120., 10.));
        debug_assert!(!frustum.interseciton_with_aabb(&aabb));
    }
}
