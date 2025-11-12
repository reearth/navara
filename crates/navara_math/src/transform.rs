use bevy_ecs::component::Component;
use bevy_math::DMat3;

use crate::{FloatType, Mat4, Quat, Vec3};

/// A 3D transform with f64 precision, similar to bevy_transform::components::Transform but using f64
#[derive(Debug, Clone, Copy, PartialEq, Component)]
pub struct Transform {
    pub translation: Vec3,
    pub rotation: Quat,
    pub scale: Vec3,
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            translation: Vec3::ZERO,
            rotation: Quat::IDENTITY,
            scale: Vec3::ONE,
        }
    }
}

// Ref: https://github.com/bevyengine/bevy/blob/main/crates/bevy_transform/src/components/transform.rs
impl Transform {
    pub const IDENTITY: Self = Transform {
        translation: Vec3::ZERO,
        rotation: Quat::IDENTITY,
        scale: Vec3::ONE,
    };

    /// Extracts the translation, rotation, and scale from `matrix`. It must be a 3d affine
    /// transformation matrix.
    #[inline]
    pub fn from_matrix(world_from_local: Mat4) -> Self {
        let (scale, rotation, translation) = world_from_local.to_scale_rotation_translation();

        Transform {
            translation,
            rotation,
            scale,
        }
    }

    /// Creates a new transform with the given translation, rotation, and scale
    pub const fn from_translation_rotation_scale(
        translation: Vec3,
        rotation: Quat,
        scale: Vec3,
    ) -> Self {
        Self {
            translation,
            rotation,
            scale,
        }
    }

    /// Creates a new transform with the given translation
    pub const fn from_translation(translation: Vec3) -> Self {
        Self {
            translation,
            ..Self::IDENTITY
        }
    }

    /// Creates a new transform with the given rotation
    pub const fn from_rotation(rotation: Quat) -> Self {
        Self {
            rotation,
            ..Self::IDENTITY
        }
    }

    /// Creates a new transform with the given scale
    pub const fn from_scale(scale: Vec3) -> Self {
        Self {
            scale,
            ..Self::IDENTITY
        }
    }

    /// Creates a new transform with the given xyz translation
    pub const fn from_xyz(x: FloatType, y: FloatType, z: FloatType) -> Self {
        Self::from_translation(Vec3::new(x, y, z))
    }

    pub fn local_z(&self) -> Vec3 {
        // Quat * unit vector is length 1
        self.rotation * Vec3::Z
    }

    /// Returns the forward direction (negative Z axis in local space)
    pub fn forward(&self) -> Vec3 {
        -self.local_z()
    }

    /// Returns the back direction (positive Z axis in local space)
    pub fn back(&self) -> Vec3 {
        self.local_z()
    }

    /// Get the unit vector in the local `Y` direction.
    pub fn local_y(&self) -> Vec3 {
        // Quat * unit vector is length 1
        self.rotation * Vec3::Y
    }

    /// Equivalent to [`local_y()`][Transform::local_y]
    pub fn up(&self) -> Vec3 {
        self.local_y()
    }

    /// Equivalent to [`-local_y()`][Transform::local_y]
    pub fn down(&self) -> Vec3 {
        -self.local_y()
    }

    /// Get the unit vector in the local `X` direction.
    pub fn local_x(&self) -> Vec3 {
        // Quat * unit vector is length 1
        self.rotation * Vec3::X
    }

    /// Equivalent to [`-local_x()`][Transform::local_x()]
    pub fn left(&self) -> Vec3 {
        -self.local_x()
    }

    /// Equivalent to [`local_x()`][Transform::local_x()]
    pub fn right(&self) -> Vec3 {
        self.local_x()
    }

    /// Rotates this transform to look at the given target position
    /// The forward axis will point at `target`, and the up axis will be as close as possible to `up`
    pub fn looking_at(mut self, target: Vec3, up: Vec3) -> Self {
        self.look_at(target, up);
        self
    }

    /// Rotates this transform to look at the given target position (mutable version)
    pub fn look_at(&mut self, target: Vec3, up: Vec3) {
        let forward = (target - self.translation).normalize();
        self.look_to(forward, up);
    }

    /// Rotates this transform to look in the given direction
    /// The forward axis will point in `direction`, and the up axis will be as close as possible to `up`
    pub fn look_to(&mut self, direction: Vec3, up: Vec3) {
        let back = -direction;
        let right = up
            .cross(back)
            .try_normalize()
            .unwrap_or_else(|| up.any_orthonormal_vector());
        let up = back.cross(right);
        self.rotation = Quat::from_mat3(&DMat3::from_cols(right, up, back));
    }

    /// Transforms a point from local space to world space
    pub fn transform_point(&self, point: Vec3) -> Vec3 {
        self.translation + self.rotation * (self.scale * point)
    }

    /// Transforms a vector from local space to world space (ignoring translation)
    pub fn transform_vector(&self, vector: Vec3) -> Vec3 {
        self.rotation * (self.scale * vector)
    }

    /// Returns the local-to-world transformation matrix
    pub fn compute_matrix(&self) -> crate::Mat4 {
        crate::Mat4::from_scale_rotation_translation(self.scale, self.rotation, self.translation)
    }

    /// Multiplies two transforms together (composition)
    pub fn mul_transform(&self, other: Transform) -> Transform {
        let translation = self.transform_point(other.translation);
        let rotation = self.rotation * other.rotation;
        let scale = self.scale * other.scale;
        Transform {
            translation,
            rotation,
            scale,
        }
    }

    /// Returns this [`Transform`] with a new translation.
    pub const fn with_translation(mut self, translation: Vec3) -> Self {
        self.translation = translation;
        self
    }

    /// Returns this [`Transform`] with a new rotation.
    pub const fn with_rotation(mut self, rotation: Quat) -> Self {
        self.rotation = rotation;
        self
    }

    /// Returns this [`Transform`] with a new scale.
    pub const fn with_scale(mut self, scale: Vec3) -> Self {
        self.scale = scale;
        self
    }
}
