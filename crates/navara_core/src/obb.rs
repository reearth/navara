use crate::Aabb;
use navara_math::Vec3;

/// Oriented Bounding Box (OBB) implementation for 3D Tiles
///
/// The OBB is defined by 12 numbers in a right-handed 3-axis (x, y, z) Cartesian coordinate system:
/// - Elements 0-2: center position (x, y, z)
/// - Elements 3-5: x-axis direction and half-length
/// - Elements 6-8: y-axis direction and half-length  
/// - Elements 9-11: z-axis direction and half-length
#[derive(Debug, Clone)]
pub struct Obb {
    pub center: Vec3,
    pub x_axis: Vec3,
    pub y_axis: Vec3,
    pub z_axis: Vec3,
}

impl Obb {
    pub fn from_points(ps: &[f32; 12]) -> Self {
        let center = Vec3::new(ps[0], ps[1], ps[2]);
        let x_axis = Vec3::new(ps[3], ps[4], ps[5]);
        let y_axis = Vec3::new(ps[6], ps[7], ps[8]);
        let z_axis = Vec3::new(ps[9], ps[10], ps[11]);

        Self {
            center,
            x_axis,
            y_axis,
            z_axis,
        }
    }

    pub fn into_aabb(self) -> Aabb {
        let corners = [
            self.center + self.x_axis + self.y_axis + self.z_axis,
            self.center + self.x_axis + self.y_axis - self.z_axis,
            self.center + self.x_axis - self.y_axis + self.z_axis,
            self.center + self.x_axis - self.y_axis - self.z_axis,
            self.center - self.x_axis + self.y_axis + self.z_axis,
            self.center - self.x_axis + self.y_axis - self.z_axis,
            self.center - self.x_axis - self.y_axis + self.z_axis,
            self.center - self.x_axis - self.y_axis - self.z_axis,
        ];

        let mut min = corners[0];
        let mut max = corners[0];

        for corner in &corners[1..] {
            min.x = min.x.min(corner.x);
            min.y = min.y.min(corner.y);
            min.z = min.z.min(corner.z);

            max.x = max.x.max(corner.x);
            max.y = max.y.max(corner.y);
            max.z = max.z.max(corner.z);
        }

        let center = (max + min) * 0.5;
        let extents = max - center;

        Aabb { center, extents }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_obb_from_points_and_to_aabb() {
        let obb_data = [
            0.0, 0.0, 10.0, 100.0, 0.0, 0.0, 0.0, 100.0, 0.0, 0.0, 0.0, 10.0,
        ];

        let obb = Obb::from_points(&obb_data);

        println!("OBB center: {:?}", obb.center);
        println!("OBB x_axis: {:?}", obb.x_axis);
        println!("OBB y_axis: {:?}", obb.y_axis);
        println!("OBB z_axis: {:?}", obb.z_axis);

        assert_eq!(obb.center, Vec3::new(0.0, 0.0, 10.0));
        assert_eq!(obb.x_axis, Vec3::new(100.0, 0.0, 0.0));
        assert_eq!(obb.y_axis, Vec3::new(0.0, 100.0, 0.0));
        assert_eq!(obb.z_axis, Vec3::new(0.0, 0.0, 10.0));

        let aabb = obb.clone().into_aabb();

        println!("AABB center: {:?}", aabb.center);
        println!("AABB extents: {:?}", aabb.extents);

        assert_eq!(aabb.center, Vec3::new(0.0, 0.0, 10.0));
        assert_eq!(aabb.extents, Vec3::new(100.0, 100.0, 10.0));
    }
}
