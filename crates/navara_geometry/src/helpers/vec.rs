use std::hash::Hash;

use itertools::Itertools;
use navara_core::{xyz_to_vec3, Ellipsoid, Meters, LLE};
use navara_math::{RawDVec3, Vec3};
use radians::Radians;

#[derive(Eq, PartialEq, Hash)]
pub struct SeparatedFloat {
    v: i32,
    f: i32,
}

pub trait UniqueWithDelta {
    fn x(&self) -> f32;
    fn y(&self) -> f32;
    fn z(&self) -> f32;
}

impl UniqueWithDelta for LLE<f32, Radians> {
    fn x(&self) -> f32 {
        self.lng.val()
    }
    fn y(&self) -> f32 {
        self.lat.val()
    }
    fn z(&self) -> f32 {
        self.height.val()
    }
}

impl UniqueWithDelta for Vec3 {
    fn x(&self) -> f32 {
        self.x
    }
    fn y(&self) -> f32 {
        self.y
    }
    fn z(&self) -> f32 {
        self.z
    }
}

impl UniqueWithDelta for RawDVec3 {
    fn x(&self) -> f32 {
        self.x as f32
    }
    fn y(&self) -> f32 {
        self.y as f32
    }
    fn z(&self) -> f32 {
        self.z as f32
    }
}

fn decimal(v: f64) -> f64 {
    v.abs() - v.abs().floor()
}

/// This is used to filter a duplicated struct by delta of epsilon.
pub fn unique_with_delta_e<V>(a: &[V], e: u32) -> Vec<V>
where
    V: UniqueWithDelta + Clone,
{
    #[derive(Eq, PartialEq, Hash)]
    struct Multiplied {
        x: SeparatedFloat,
        y: SeparatedFloat,
        z: SeparatedFloat,
    }

    if e >= 20 {
        panic!("Unexpected exponent");
    }

    let e = 10u64.pow(e) as f64;
    a.iter()
        .unique_by(|v| Multiplied {
            x: SeparatedFloat {
                v: v.x().floor() as i32,
                f: (decimal(v.x() as f64) * e).floor() as i32,
            },
            y: SeparatedFloat {
                v: v.y().floor() as i32,
                f: (decimal(v.y() as f64) * e).floor() as i32,
            },
            z: SeparatedFloat {
                v: v.z().floor() as i32,
                f: (decimal(v.z() as f64) * e).floor() as i32,
            },
        })
        .cloned()
        .collect::<Vec<V>>()
}

pub fn append_flatten_vec3(a: &mut Vec<f32>, b: &Vec3) {
    a.append(&mut b.to_array().to_vec());
}

pub fn append_flatten_vec3_with_index(a: &mut [f32], b: &Vec3, i: usize) {
    a[i] = b.x;
    a[i + 1] = b.y;
    a[i + 2] = b.z;
}

pub fn unpack_flatten_vec3(v: &[f32], i: usize) -> Vec3 {
    Vec3::new(v[i], v[i + 1], v[i + 2])
}

pub fn get_position(ellipsoid: Ellipsoid<f32>, cart: &LLE<f32, Radians>, height: f32) -> Vec3 {
    let mut cart = *cart;
    cart.height = Meters::new(height);
    xyz_to_vec3(cart.to_xyz(ellipsoid))
}

pub fn direction(a: Vec3, b: Vec3) -> Vec3 {
    (a - b).normalize()
}

pub fn tangent_direction(a: Vec3, b: Vec3, up: Vec3) -> Vec3 {
    up.cross(direction(a, b).cross(up).normalize())
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_core::LLE;
    use navara_math::{Vec3, EPSILON10};
    use radians::Radians;

    use crate::helpers::vec::UniqueWithDelta;

    use super::unique_with_delta_e;

    #[test]
    fn it_should_unique_lle_vec() {
        fn assert_lle_vec(result: Vec<LLE<f32, Radians>>, expects: Vec<LLE<f32, Radians>>) {
            assert_eq!(result.len(), expects.len());
            for (i, r) in result.iter().enumerate() {
                assert_abs_diff_eq!(r.lng.val(), expects[i].lng.val(), epsilon = EPSILON10);
                assert_abs_diff_eq!(r.lat.val(), expects[i].lat.val(), epsilon = EPSILON10);
                assert_abs_diff_eq!(r.height.val(), expects[i].height.val(), epsilon = EPSILON10);
            }
        }

        let input_vec: Vec<LLE<f32, Radians>> = vec![
            LLE::from_float(1.2345, 1.2345, 0.),
            LLE::from_float(1.234, 1.234, 0.),
            LLE::from_float(1.234, 1.234, 1.),
            LLE::from_float(1.23, 1.23, 0.),
            LLE::from_float(1.2, 1.2, 0.),
            LLE::from_float(1., 1., 0.),
            LLE::from_float(1., 0., 0.),
        ];

        let expects: Vec<LLE<f32, Radians>> = vec![
            input_vec[0],
            input_vec[1],
            input_vec[2],
            input_vec[3],
            input_vec[4],
            input_vec[5],
            input_vec[6],
        ];
        let result = unique_with_delta_e(&input_vec, 3);
        assert_lle_vec(result, expects);

        let expects: Vec<LLE<f32, Radians>> = vec![
            input_vec[0],
            input_vec[2],
            input_vec[4],
            input_vec[5],
            input_vec[6],
        ];
        let result = unique_with_delta_e(&input_vec, 2);
        assert_lle_vec(result, expects);

        let expects: Vec<LLE<f32, Radians>> =
            vec![input_vec[0], input_vec[2], input_vec[5], input_vec[6]];
        let result = unique_with_delta_e(&input_vec, 1);
        assert_lle_vec(result, expects);
    }

    #[test]
    fn it_should_unique_vec3() {
        fn assert_lle_vec(result: Vec<Vec3>, expects: Vec<Vec3>) {
            assert_eq!(result.len(), expects.len());
            for (i, r) in result.iter().enumerate() {
                assert_abs_diff_eq!(r.x(), expects[i].x(), epsilon = EPSILON10);
                assert_abs_diff_eq!(r.y(), expects[i].y(), epsilon = EPSILON10);
                assert_abs_diff_eq!(r.z(), expects[i].z(), epsilon = EPSILON10);
            }
        }

        let input_vec: Vec<Vec3> = vec![
            Vec3::new(1.2345, 1.2345, 0.),
            Vec3::new(1.234, 1.234, 0.),
            Vec3::new(1.234, 1.234, 1.),
            Vec3::new(1.23, 1.23, 0.),
            Vec3::new(1.2, 1.2, 0.),
            Vec3::new(1., 1., 0.),
            Vec3::new(1., 0., 0.),
            Vec3::new(0.1234, 0.1234, 0.),
            Vec3::new(0.123, 0.123, 0.),
            Vec3::new(0.12, 0.12, 0.),
            Vec3::new(0.1, 0.1, 0.),
            Vec3::new(-0.1234, -0.1234, 0.),
            Vec3::new(-0.123, -0.123, 0.),
            Vec3::new(-0.12, -0.12, 0.),
            Vec3::new(-0.1, -0.1, 0.),
        ];

        let expects: Vec<Vec3> = vec![
            input_vec[0],
            input_vec[1],
            input_vec[2],
            input_vec[3],
            input_vec[4],
            input_vec[5],
            input_vec[6],
            input_vec[7],
            input_vec[9],
            input_vec[10],
            input_vec[11],
            input_vec[13],
            input_vec[14],
        ];
        let result = unique_with_delta_e(&input_vec, 3);
        assert_lle_vec(result, expects);

        let expects: Vec<Vec3> = vec![
            input_vec[0],
            input_vec[2],
            input_vec[4],
            input_vec[5],
            input_vec[6],
            input_vec[7],
            input_vec[9],
            input_vec[10],
            input_vec[11],
            input_vec[13],
            input_vec[14],
        ];
        let result = unique_with_delta_e(&input_vec, 2);
        assert_lle_vec(result, expects);

        let expects: Vec<Vec3> = vec![
            input_vec[0],
            input_vec[2],
            input_vec[5],
            input_vec[6],
            input_vec[7],
            input_vec[11],
        ];
        let result = unique_with_delta_e(&input_vec, 1);
        assert_lle_vec(result, expects);
    }
}
