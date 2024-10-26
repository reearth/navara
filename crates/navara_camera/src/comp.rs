use bevy_ecs::component::Component;
use navara_core::{Aabb, Angle, Plane, EARTH_RADIUS_F32};
use navara_math::{FloatType, Mat4, Quat, Transform, Vec3};

#[derive(Component)]
pub struct CameraMarker;

#[derive(Component)]
pub struct CameraFrustum {
    pub near: FloatType,
    pub far: FloatType,
    pub fov: FloatType,
    pub fov_y: FloatType,
    pub aspect_ratio: FloatType,
    pub sse_denominator: FloatType,
    pub planes: [Plane; 6],
}

impl CameraFrustum {
    pub fn new(
        transform: &Transform,
        near: FloatType,
        far: FloatType,
        fov: FloatType,
        aspect_ratio: FloatType,
    ) -> Self {
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

    pub fn intersection_with_aabb(&self, aabb: &Aabb) -> bool {
        for plane in self.planes.iter() {
            if !aabb.is_on_or_forward_plane(plane) {
                return false;
            }
        }
        true
    }
}

// CameraFrustum
// pub enum CameraFrustum {
//     Perspective(PerspectiveFrustum),
//     Orthographic(OrthographicFrustum),
// }

// pub struct PerspectiveFrustum {
//     pub fov: FloatType,
//     pub aspect_ratio: FloatType,
//     pub near: FloatType,
//     pub far: FloatType,
//     pub xoffset: FloatType,
//     pub yoffset: FloatType,
// }

// pub struct OrthographicFrustum {
//     pub width: FloatType,
//     pub aspect_ratio: FloatType, 
//     pub near: FloatType,
//     pub far: FloatType,
// }

// impl CameraFrustum {
//     pub fn compute_culling_volume(
//         &self,
//         position: Vec3,
//         direction: Vec3,
//         up: Vec3,
//     ) -> CullingVolume {
//         match self {
//             CameraFrustum::Perspective(frustum) => {
//                 frustum.compute_culling_volume(position, direction, up)
//             }
//             CameraFrustum::Orthographic(frustum) => {
//                 frustum.compute_culling_volume(position, direction, up)
//             }
//         }
//     }

//     pub fn get_pixel_dimensions(
//         &self,
//         draw_width: u32,
//         draw_height: u32,
//         distance: FloatType,
//         pixel_ratio: FloatType,
//         result: Option<Vec2>,
//     ) -> Vec2 {
//         match self {
//             CameraFrustum::Perspective(frustum) => {
//                 frustum.get_pixel_dimensions(
//                     draw_width,
//                     draw_height,
//                     distance,
//                     pixel_ratio,
//                     result,
//                 )
//             }
//             CameraFrustum::Orthographic(frustum) => {
//                 frustum.get_pixel_dimensions(
//                     draw_width,
//                     draw_height, 
//                     distance,
//                     pixel_ratio,
//                     result,
//                 )
//             }
//         }
//     }
// }

#[derive(Component)]
pub struct Camera {
    pub transform: Transform,
    pub frustum: CameraFrustum,
    pub default_move_amount: FloatType,
    pub default_look_amount: FloatType,
    pub default_rotate_amount: FloatType,
    pub default_zoom_amount: FloatType,
    pub maximum_zoom_factor: FloatType,
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            transform: Transform::default(),
            frustum: CameraFrustum::new(
                &Transform::default(),
                0.1,
                1000.0,
                Angle::new(50.0).rad().val(),
                1.0,
            ),
            default_move_amount: 1.0,
            default_look_amount: 0.01,
            default_rotate_amount: 0.01,
            default_zoom_amount: 1.0,
            maximum_zoom_factor: 1.5,
        }
    }
}

impl Camera {
    pub fn new(position: Vec3, target: Vec3, up: Vec3) -> (Self, Transform) {
        let mut camera = Self::default();
        let transform = Transform::from_translation(position).looking_at(target, up);
        camera.update_frustum(&transform);
        (camera, transform)
    }

    pub fn update_frustum(&mut self, transform: &Transform) {
        self.frustum.update_sse_denominator();
        self.frustum.update_planes(transform);
    }

    pub fn position(&self) -> Vec3 {
        self.transform.translation
    }

    pub fn direction(&self) -> Vec3 {
        *-self.transform.forward()
    }

    pub fn up(&self) -> Vec3 {
        *self.transform.up()
    }

    pub fn right(&self) -> Vec3 {
        *self.transform.right()
    }

    pub fn view_matrix(transform: &Transform) -> Mat4 {
        transform.compute_matrix().inverse()
    }
}

#[derive(Component)]
pub struct CameraController {
    pub enabled: bool,
    pub enable_rotate: bool,
    pub enable_translate: bool,
    pub enable_zoom: bool,
    pub enable_tilt: bool,
    pub enable_look: bool,
    pub minimum_zoom_distance: FloatType,
    pub maximum_zoom_distance: FloatType,
    pub spin_speed: FloatType,
    pub rotate_speed: FloatType,
    pub zoom_speed: FloatType,
    pub translate_speed: FloatType,
    pub inertia: FloatType,
}

impl Default for CameraController {
    fn default() -> Self {
        Self {
            enabled: true,
            enable_rotate: true,
            enable_translate: true,
            enable_zoom: true,
            enable_tilt: true,
            enable_look: true,
            minimum_zoom_distance: EARTH_RADIUS_F32 * 1.0,
            maximum_zoom_distance: EARTH_RADIUS_F32 * 10.0,
            spin_speed: 0.1,
            rotate_speed: 0.5,
            zoom_speed: 800.0,
            translate_speed: 0.01,
            inertia: 0.9,
        }
    }
}

#[derive(Component, Default)]
pub struct CameraInertia {
    pub spin: Vec3,
    pub translate: Vec3,
    pub zoom: FloatType,
    pub pan: Vec3,
}

#[derive(Component, Default)]
pub struct Orbit {
    pub r: FloatType,
    pub quat: Quat,
    pub tilt: FloatType,
    pub pivot: Vec3,
}

impl Orbit {
    pub fn new(distance: FloatType) -> Self {
        Self {
            r: distance,
            quat: Quat::IDENTITY,
            tilt: 0.0,
            pivot: Vec3::ZERO,
        }
    }

    pub fn to_vec3(&self) -> Vec3 {
        self.quat * Quat::from_rotation_x(self.tilt) * Vec3::new(0.0, 0.0, self.r)
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

