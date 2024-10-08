use std::hash::Hash;

use itertools::Itertools;
use navara_core::{xyz_to_vec3, Ellipsoid, Meters, LLE};
use navara_math::Vec3;
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

fn decimal(v: f32) -> f32 {
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
    let e = 10u32.pow(e) as f32;
    a.iter()
        .unique_by(|v| Multiplied {
            x: SeparatedFloat {
                v: v.x().floor() as i32,
                f: (decimal(v.x()) * e).floor() as i32,
            },
            y: SeparatedFloat {
                v: v.y().floor() as i32,
                f: (decimal(v.y()) * e).floor() as i32,
            },
            z: SeparatedFloat {
                v: v.z().floor() as i32,
                f: (decimal(v.z()) * e).floor() as i32,
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
    use navara_math::EPSILON10;
    use radians::Radians;

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
}
