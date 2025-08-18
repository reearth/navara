use bevy_ecs::component::Component;
use navara_core::{adjust_angle_for_lerp, lerp, Aabb, Plane, CRS, WGS84_32, WGS84_B_32};
use navara_math::{
    negative_pi_to_pi, EqualEpsilon, FloatType, Mat3, Quat, Transform, Vec3, EPSILON10,
};

use crate::{
    helpers::{get_heading, get_pitch, get_roll},
    CameraOrientation,
};

#[derive(Component)]
pub struct CameraMarker;

// TODO: Support orthogonal camera.
/// Frustum for perspective camera.
#[derive(Component, Debug)]
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

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum CameraStatusType {
    Change,
    LookAt,
    Rotate,

    MoveStart,
    Moving,
    MoveEnd,
}

#[derive(Component, Clone, Default)]
pub struct CameraStatus {
    pub(super) initialized: bool,
    pub status: Vec<CameraStatusType>,
}

#[derive(Component)]
pub struct CameraController {
    pub enabled: bool,
    pub enable_spin: bool,
    pub enable_zoom: bool,
    pub enable_tilt: bool,
    pub enable_look: bool,
    pub enable_translate: bool,
    pub minimum_zoom_distance: FloatType,
    pub maximum_zoom_distance: FloatType,
    pub spin_speed: FloatType,
    pub rotate_speed: FloatType,
    pub zoom_speed: FloatType,
    pub spin_duration: f32,
    pub zoom_duration: f32,
    pub translate_duration: f32,
    pub inertia: FloatType,
}

impl Default for CameraController {
    fn default() -> Self {
        Self {
            enabled: true,
            enable_spin: true,
            enable_zoom: true,
            enable_tilt: true,
            enable_look: true,
            enable_translate: true,
            minimum_zoom_distance: WGS84_B_32,
            maximum_zoom_distance: WGS84_B_32 * 10.0,
            spin_speed: 2.0,
            rotate_speed: 1.,
            zoom_speed: 0.6,
            spin_duration: 500.,
            zoom_duration: 100.,
            translate_duration: 500.,
            inertia: 0.5,
        }
    }
}

#[derive(Component)]
pub struct CameraInertia {
    pub spin: Vec3,
    pub spin_time: f32,
    pub translate: Vec3,
    pub translate_time: f32,
    pub zoom: FloatType,
    pub zoom_time: f32,
    pub pan: Vec3,
}

impl Default for CameraInertia {
    fn default() -> Self {
        Self {
            spin: Vec3::ZERO,
            spin_time: 500.,
            translate: Vec3::ZERO,
            translate_time: 500.,
            zoom: 0.,
            zoom_time: 100.,
            pan: Vec3::ZERO,
        }
    }
}

impl CameraInertia {
    pub fn spin(&mut self, v: Vec3) {
        self.spin = v;
        self.spin_time = 0.;
        self.zoom = 0.;
        self.translate = Vec3::ZERO;
    }

    pub fn zoom(&mut self, v: f32) {
        self.zoom = v;
        self.zoom_time = 0.;
        self.spin = Vec3::ZERO;
        self.translate = Vec3::ZERO;
    }

    pub fn translate(&mut self, v: Vec3) {
        self.translate = v;
        self.translate_time = 0.;
        self.spin = Vec3::ZERO;
        self.zoom = 0.;
    }

    pub fn stop_all(&mut self, controller: &CameraController) {
        self.spin = Vec3::ZERO;
        self.zoom = 0.;
        self.translate = Vec3::ZERO;

        self.spin_time = controller.spin_duration;
        self.translate_time = controller.translate_duration;
        self.zoom_time = controller.zoom_duration;
    }
}

#[derive(Component, Clone)]
pub struct Orbit {
    pub horizon_quat: Quat,
    pub vertical_quat: Quat,
    pub default_world_quat: Option<Quat>,
    pub world_quat: Quat,
    pub tilt_quat: Quat,
    pub pivot: Vec3,
    pub horizontal_rotation_axis: Vec3,
    pub vertical_rotation_axis: Vec3,
    pub local_up: Vec3,
    pub tilt_horizontal_rotation_axis: Vec3,
    pub local_forward: Vec3,
    pub local_position: Vec3,
    pub tilting: bool,
}

impl Default for Orbit {
    fn default() -> Self {
        let controller = CameraController::default();
        let r = controller.minimum_zoom_distance * 3.;

        Self {
            horizon_quat: Quat::IDENTITY,
            vertical_quat: Quat::IDENTITY,
            world_quat: Quat::from_mat3(&Mat3::from_cols(Vec3::NEG_X, Vec3::NEG_Y, Vec3::Z)),
            tilt_quat: Quat::IDENTITY,
            default_world_quat: None,
            local_up: Vec3::Z,
            tilt_horizontal_rotation_axis: Vec3::Z,
            local_position: Vec3::NEG_Y * r,
            local_forward: Vec3::Y,
            vertical_rotation_axis: Vec3::NEG_X,
            horizontal_rotation_axis: Vec3::Z,
            pivot: Vec3::ZERO,
            tilting: false,
        }
    }
}

impl Orbit {
    pub fn get_default_world_quat(&mut self) -> Quat {
        match self.default_world_quat.take() {
            Some(d) => d,
            None => self.world_quat,
        }
    }

    pub fn set_quat(&mut self, transform: &Transform, world: Quat, center: Vec3, tilt: bool) {
        self.horizon_quat = Quat::IDENTITY;
        self.vertical_quat = Quat::IDENTITY;
        self.world_quat = world;
        self.tilting = tilt;

        if tilt {
            self.tilt_quat = world;
        }

        self.pivot = center;

        let position = transform.transform_point(Vec3::ZERO);

        let inverse = self.world_quat.inverse();

        let direction = position - center;

        self.local_forward = if tilt {
            inverse * -direction.normalize_or_zero()
        } else {
            inverse * transform.forward().as_vec3()
        };

        self.local_position = inverse * direction;

        if tilt {
            self.local_up = Vec3::Z;
            self.horizontal_rotation_axis = Vec3::Z;

            if self.local_up.dot(self.local_forward).abs() >= 0.99999 {
                self.local_up = inverse * transform.up().as_vec3();
                self.vertical_rotation_axis = self.local_forward.cross(self.local_up);
            } else {
                self.vertical_rotation_axis = inverse * transform.right().as_vec3();
            };

            return;
        } else {
            self.vertical_rotation_axis = inverse * transform.right().as_vec3();
        }

        if self.tilt_quat == Quat::IDENTITY {
            return;
        }

        self.horizontal_rotation_axis = inverse * self.tilt_horizontal_rotation_axis;
        self.local_up = self
            .vertical_rotation_axis
            .cross(self.local_forward)
            .normalize();

        let orthogonal_forward = self
            .horizontal_rotation_axis
            .cross(self.vertical_rotation_axis)
            .normalize();
        let forwards_dot = orthogonal_forward.dot(self.local_forward);
        if forwards_dot < 0. {
            self.horizontal_rotation_axis *= -1.;
        }
    }

    pub fn update_horizontal_rotation_axis_on_tilt(&mut self, transform: &Transform) {
        if !self.tilting {
            return;
        }

        let z_base = Vec3::Z;
        let z_cam = transform.up().as_vec3();

        // Get difference between camera z axis and base z axis.
        let axis = z_base.cross(z_cam);
        let axis_len2 = axis.length_squared();

        // Calculate an angle.
        let dot = z_base.dot(z_cam).clamp(-1.0, 1.0);
        let angle = axis_len2.sqrt().atan2(dot);

        // Make a quaternion to rotate around.
        let normalized_axis = axis / axis_len2.sqrt();
        let q = Quat::from_axis_angle(normalized_axis, angle);

        self.tilt_horizontal_rotation_axis = q * z_base;
    }
}

#[derive(Default, Debug)]
pub struct FlightOptions {
    pub lon: FloatType,
    pub lat: FloatType,
    pub height: FloatType,
    pub heading: FloatType,
    pub pitch: FloatType,
    pub roll: FloatType,
}

#[derive(Component, Default)]
pub struct CameraFlight {
    pub start_options: FlightOptions,
    pub end_options: FlightOptions,

    pub time: FloatType,
    pub duration: FloatType,
    pub max_height: FloatType,
    height_function: Option<Box<dyn Fn(FloatType) -> FloatType + Send + Sync + 'static>>,
}

impl CameraFlight {
    pub fn fly_to(
        &mut self,
        transform: &Transform,
        frustum: &CameraFrustum,
        pos: &Vec3,
        orient: &CameraOrientation,
        duration: &Option<FloatType>,
        max_height: &Option<FloatType>,
    ) -> bool {
        let lle = CRS::Geocentric.to_lle(WGS84_32, transform.translation, 0.0);
        let start = lle.deg();

        self.set_start_options(
            start.lng.val(),
            start.lat.val(),
            start.height.val(),
            get_heading(transform),
            get_pitch(transform),
            get_roll(transform),
        );

        self.set_end_options(
            pos.x,
            pos.y,
            pos.z,
            orient.get_heading(),
            orient.get_pitch(),
            orient.get_roll(),
        );

        self.start_fly(duration, max_height, frustum, transform)
    }

    fn set_start_options(
        &mut self,
        lon: FloatType,
        lat: FloatType,
        height: FloatType,
        heading: FloatType,
        pitch: FloatType,
        roll: FloatType,
    ) {
        self.start_options.lon = lon;
        self.start_options.lat = lat;
        self.start_options.height = height;
        self.start_options.heading = heading;
        self.start_options.pitch = pitch;
        self.start_options.roll = roll;
    }

    fn set_end_options(
        &mut self,
        lon: FloatType,
        lat: FloatType,
        height: FloatType,
        heading: FloatType,
        pitch: FloatType,
        roll: FloatType,
    ) {
        self.end_options.lon = lon;
        self.end_options.lat = lat;
        self.end_options.height = height;
        self.end_options.heading = heading;
        self.end_options.pitch = pitch;
        self.end_options.roll = roll;
    }

    fn options_changed(&mut self) -> bool {
        let start_heading = negative_pi_to_pi(self.start_options.heading);
        let end_heading = negative_pi_to_pi(self.end_options.heading);
        let start_pitch = negative_pi_to_pi(self.start_options.pitch);
        let end_pitch = negative_pi_to_pi(self.end_options.pitch);
        let start_roll = negative_pi_to_pi(self.start_options.roll);
        let end_roll = negative_pi_to_pi(self.end_options.roll);

        if !start_heading.equal_diff_epsilon(end_heading, EPSILON10) {
            return true;
        }

        if !start_pitch.equal_diff_epsilon(end_pitch, EPSILON10) {
            return true;
        }

        if !start_roll.equal_diff_epsilon(end_roll, EPSILON10) {
            return true;
        }

        if !self
            .start_options
            .lon
            .equal_diff_epsilon(self.end_options.lon, EPSILON10)
        {
            return true;
        }

        if !self
            .start_options
            .lat
            .equal_diff_epsilon(self.end_options.lat, EPSILON10)
        {
            return true;
        }

        if !self
            .start_options
            .height
            .equal_diff_epsilon(self.end_options.height, EPSILON10)
        {
            return true;
        }

        false
    }

    fn start_fly(
        &mut self,
        duration: &Option<FloatType>,
        max_height: &Option<FloatType>,
        frustum: &CameraFrustum,
        transform: &Transform,
    ) -> bool {
        if !self.options_changed() {
            return false;
        }

        self.start_options.heading =
            adjust_angle_for_lerp(self.start_options.heading, self.end_options.heading);
        self.start_options.roll =
            adjust_angle_for_lerp(self.start_options.roll, self.end_options.roll);

        self.time = 0.;
        self.duration = duration.unwrap_or(500.);
        if let Some(h) = max_height {
            self.max_height = *h;
        } else {
            self.max_height = self.get_altitude(transform, frustum);
        }

        self.height_function = Some(Self::create_height_function(
            self.start_options.height,
            self.end_options.height,
            self.max_height,
        ));

        true
    }

    pub fn is_flying(&self) -> bool {
        self.time < self.duration
    }

    pub fn update(&mut self, delta_time: FloatType) -> Option<(Vec3, CameraOrientation)> {
        if self.is_flying() {
            self.time += delta_time;
            if self.time > self.duration {
                self.time = self.duration;
            }

            if let Some(f) = &self.height_function {
                let t = self.time / self.duration;
                let height = f(t);

                let lon = lerp(self.start_options.lon, self.end_options.lon, t);
                let lat = lerp(self.start_options.lat, self.end_options.lat, t);
                let heading = lerp(self.start_options.heading, self.end_options.heading, t);
                let pitch = lerp(self.start_options.pitch, self.end_options.pitch, t);
                let roll = lerp(self.start_options.roll, self.end_options.roll, t);

                let position = Vec3::new(lon, lat, height);
                let orientation = CameraOrientation {
                    pitch: Some(pitch),
                    heading: Some(heading),
                    roll: Some(roll),
                };

                return Some((position, orientation));
            }
        }

        None
    }

    // ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/CameraFlightPath.js#L22
    fn get_altitude(&self, transform: &Transform, frustum: &CameraFrustum) -> FloatType {
        let cam_start = transform.translation;
        let cam_end = CRS::Geographic.to_vec3(
            WGS84_32,
            Vec3::new(
                self.end_options.lon,
                self.end_options.lat,
                self.end_options.height,
            ),
            0.0,
        );
        let diff = cam_end - cam_start;

        let up = transform.up().as_vec3();
        let right = transform.right().as_vec3();

        let dx = (up * diff.dot(up)).length();
        let dy = (right * diff.dot(right)).length();

        let tan_theta = (0.5 * frustum.fov).tan();
        let near = frustum.near;
        let top = near * tan_theta;
        let right = frustum.aspect_ratio * top;

        let controller = CameraController::default();
        (dx * near / right)
            .max(dy * near / top)
            .min(controller.maximum_zoom_distance)
    }

    // ref: https://github.com/CesiumGS/cesium/blob/fb314464d211abf51649b17151137db7a403502a/packages/engine/Source/Scene/CameraFlightPath.js#L75
    fn create_height_function(
        start_height: FloatType,
        end_height: FloatType,
        option_altitude: FloatType,
    ) -> Box<dyn Fn(FloatType) -> FloatType + Send + Sync + 'static> {
        let altitude = option_altitude;
        let max_height = start_height.max(end_height);

        if max_height < altitude {
            let power = 4.0;
            let factor = 1000.0;

            let s = -((altitude - start_height) * factor).powf(1.0 / power);
            let e = ((altitude - end_height) * factor).powf(1.0 / power);

            Box::new(move |t: FloatType| {
                let x = t * (e - s) + s;
                -x.powf(power) / factor + altitude
            })
        } else {
            Box::new(move |t: FloatType| start_height * (1.0 - t) + end_height * t)
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
