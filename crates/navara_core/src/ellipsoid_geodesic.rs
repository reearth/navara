use navara_math::EPSILON12;
use radians::{Angle, Radians};

use crate::{Ellipsoid, Meters, LLE, WGS84_FE_32};

// Ref: https://github.com/CesiumGS/cesium/blob/16696798115dbc7412453f3ea589f3f42a666315/packages/engine/Source/Core/EllipsoidGeodesic.js
pub struct EllipsoidGeodesic {
    pub start: LLE<f32, Radians>,
    pub end: LLE<f32, Radians>,
    pub distance: f32,
    pub start_heading: f32,
    pub end_heading: f32,
    pub constants: VincentyDirectFormulaConstants,
}

impl EllipsoidGeodesic {
    pub fn new(
        start: LLE<f32, Radians>,
        end: LLE<f32, Radians>,
        ellipsoid: &Ellipsoid<f32>,
    ) -> Self {
        let inverse_formula_result =
            vincenty_inverse_formula(ellipsoid.a, ellipsoid.b, &start, &end);
        let constants =
            prepare_vincenty_direct_formula_constants(start.lat.val(), &inverse_formula_result);

        Self {
            start,
            end,
            constants,
            distance: inverse_formula_result.distance,
            start_heading: inverse_formula_result.start_heading,
            end_heading: inverse_formula_result.end_heading,
        }
    }

    pub fn from(
        start: LLE<f32, Radians>,
        end: LLE<f32, Radians>,
        distance: f32,
        start_heading: f32,
        end_heading: f32,
        constants: VincentyDirectFormulaConstants,
    ) -> Self {
        Self {
            start,
            end,
            distance,
            start_heading,
            end_heading,
            constants,
        }
    }

    pub fn interpolate_distance(
        &self,
        ellipsoid: &Ellipsoid<f32>,
        distance: f32,
    ) -> LLE<f32, Radians> {
        let constants = &self.constants;

        let s = constants.distance_ratio + distance / ellipsoid.b;

        let cosine_2s = (2. * s).cos();
        let cosine_4s = (4. * s).cos();
        let cosine_6s = (6. * s).cos();
        let sine_2s = (2. * s).sin();
        let sine_4s = (4. * s).sin();
        let sine_6s = (6. * s).sin();
        let sine_8s = (8. * s).sin();

        let s2 = s * s;
        let s3 = s * s2;

        let u2_over4 = constants.u2_over4;
        let u4_over16 = constants.u4_over16;
        let u6_over64 = constants.u6_over64;
        let u8_over256 = constants.u8_over256;

        let sigma = (2. * s3 * u8_over256 * cosine_2s) / 3.
            + s * (1. - u2_over4 + (7. * u4_over16) / 4. - (15. * u6_over64) / 4.
                + (579. * u8_over256) / 64.
                - (u4_over16 - (15. * u6_over64) / 4. + (187. * u8_over256) / 16.) * cosine_2s
                - ((5. * u6_over64) / 4. - (115. * u8_over256) / 16.) * cosine_4s
                - (29. * u8_over256 * cosine_6s) / 16.)
            + (u2_over4 / 2. - u4_over16 + (71. * u6_over64) / 32. - (85. * u8_over256) / 16.)
                * sine_2s
            + ((5. * u4_over16) / 16. - (5. * u6_over64) / 4. + (383. * u8_over256) / 96.)
                * sine_4s
            - s2 * ((u6_over64 - (11. * u8_over256) / 2.) * sine_2s
                + (5. * u8_over256 * sine_4s) / 2.)
            + ((29. * u6_over64) / 96. - (29. * u8_over256) / 16.) * sine_6s
            + (539. * u8_over256 * sine_8s) / 1536.;

        let theta = (sigma.sin() * constants.cosine_alpha).asin();
        let latitude = ((ellipsoid.a / ellipsoid.b) * theta.tan()).atan();

        // Redefine in terms of relative argument of latitude.
        let sigma = sigma - constants.sigma;

        let cosine_twice_sigma_midpoint = (2. * constants.sigma + sigma).cos();

        let sine_sigma = sigma.sin();
        let cosine_sigma = sigma.cos();

        let cc = constants.cosine_u * cosine_sigma;
        let ss = constants.sine_u * sine_sigma;

        let lambda =
            (sine_sigma * constants.sine_heading).atan2(cc - ss * constants.cosine_heading) as f64;

        let l = (lambda
            - compute_delta_lambda(
                constants.f as f64,
                constants.sine_alpha as f64,
                constants.cosine_squared_alpha as f64,
                sigma as f64,
                sine_sigma as f64,
                cosine_sigma as f64,
                cosine_twice_sigma_midpoint as f64,
            )) as f32;

        LLE {
            lng: Angle::new(self.start.lng.val() + l),
            lat: Angle::new(latitude),
            height: Meters::new(0.),
        }
    }
}

struct VincentyInverseFormulaResult {
    distance: f32,
    start_heading: f32,
    end_heading: f32,
    u_squared: f32,
    eff: f32,
}

// Ref: https://en.wikipedia.org/wiki/Vincenty%27s_formulae#Inverse%20problem:~:text=and%20the%20equator-,Inverse%20problem,-%5Bedit%5D
fn vincenty_inverse_formula(
    a: f32,
    b: f32,
    first: &LLE<f32, Radians>,
    second: &LLE<f32, Radians>,
) -> VincentyInverseFormulaResult {
    let eff = WGS84_FE_32;
    let l = (second.lng.val() - first.lng.val()) as f64;

    let u1 = ((1. - eff) * first.lat.tan()).atan();
    let u2 = ((1. - eff) * second.lat.tan()).atan();

    let cosine_u1 = u1.cos();
    let sine_u1 = u1.sin();
    let cosine_u2 = u2.cos();
    let sine_u2 = u2.sin();

    let cc = cosine_u1 * cosine_u2;
    let cs = cosine_u1 * sine_u2;
    let ss = sine_u1 * sine_u2;
    let sc = sine_u1 * cosine_u2;

    let mut lambda = l;
    let mut lambda_dot: f64;

    let mut cosine_lambda: f32;
    let mut sine_lambda: f32;

    let mut sigma: f32;
    let mut cosine_sigma: f32;
    let mut sine_sigma: f32;
    let mut cosine_squared_alpha: f32;
    let mut cosine_twice_sigma_midpoint: f32;

    loop {
        cosine_lambda = lambda.cos() as f32;
        sine_lambda = lambda.sin() as f32;

        let temp = cs - sc * cosine_lambda;
        sine_sigma = (cosine_u2 * cosine_u2 * sine_lambda * sine_lambda + temp * temp).sqrt();
        cosine_sigma = ss + cc * cosine_lambda;

        sigma = sine_sigma.atan2(cosine_sigma);

        let sine_alpha: f32;

        if sine_sigma == 0. {
            sine_alpha = 0.;
            cosine_squared_alpha = 1.;
        } else {
            sine_alpha = (cc * sine_lambda) / sine_sigma;
            cosine_squared_alpha = 1. - sine_alpha * sine_alpha;
        }

        lambda_dot = lambda;

        cosine_twice_sigma_midpoint = cosine_sigma - (2. * ss) / cosine_squared_alpha;

        if !cosine_twice_sigma_midpoint.is_finite() {
            cosine_twice_sigma_midpoint = 0.;
        }

        lambda = l + compute_delta_lambda(
            eff as f64,
            sine_alpha as f64,
            cosine_squared_alpha as f64,
            sigma as f64,
            sine_sigma as f64,
            cosine_sigma as f64,
            cosine_twice_sigma_midpoint as f64,
        );

        if ((lambda - lambda_dot).abs() as f32) <= EPSILON12 {
            break;
        }
    }

    let u_squared = (cosine_squared_alpha * (a * a - b * b)) / (b * b);

    #[allow(non_snake_case)]
    let A: f32 = 1.
        + (u_squared * (4096. + u_squared * (u_squared * (320. - 175. * u_squared) - 768.)))
            / 16384.;
    #[allow(non_snake_case)]
    let B = (u_squared * (256. + u_squared * (u_squared * (74. - 47. * u_squared) - 128.))) / 1024.;

    let cosine_squared_twice_sigma_midpoint =
        cosine_twice_sigma_midpoint * cosine_twice_sigma_midpoint;
    let delta_sigma = B
        * sine_sigma
        * (cosine_twice_sigma_midpoint
            + (B * (cosine_sigma * (2. * cosine_squared_twice_sigma_midpoint - 1.)
                - (B * cosine_twice_sigma_midpoint
                    * (4. * sine_sigma * sine_sigma - 3.)
                    * (4. * cosine_squared_twice_sigma_midpoint - 3.))
                    / 6.))
                / 4.);

    let distance = b * A * (sigma - delta_sigma);

    let start_heading = (cosine_u2 * sine_lambda).atan2(cs - sc * cosine_lambda);
    let end_heading = (cosine_u1 * sine_lambda).atan2(cs * cosine_lambda - sc);

    VincentyInverseFormulaResult {
        distance,
        start_heading,
        end_heading,
        u_squared,
        eff,
    }
}

fn compute_delta_lambda(
    f: f64,
    sine_alpha: f64,
    cosine_squared_alpha: f64,
    sigma: f64,
    sine_sigma: f64,
    cosine_sigma: f64,
    cosine_twice_sigma_midpoint: f64,
) -> f64 {
    let c = compute_c(f, cosine_squared_alpha);

    (1. - c)
        * f
        * sine_alpha
        * (sigma
            + c * sine_sigma
                * (cosine_twice_sigma_midpoint
                    + c * cosine_sigma
                        * (2. * cosine_twice_sigma_midpoint * cosine_twice_sigma_midpoint - 1.)))
}

fn compute_c(f: f64, cosine_squared_alpha: f64) -> f64 {
    (f * cosine_squared_alpha * (4. + f * (4. - 3. * cosine_squared_alpha))) / 16.
}

#[derive(Clone)]
pub struct VincentyDirectFormulaConstants {
    f: f32,
    cosine_heading: f32,
    sine_heading: f32,
    cosine_u: f32,
    sine_u: f32,
    sigma: f32,
    sine_alpha: f32,
    cosine_squared_alpha: f32,
    cosine_alpha: f32,
    u2_over4: f32,
    u4_over16: f32,
    u6_over64: f32,
    u8_over256: f32,
    distance_ratio: f32,
}

// Calculate constants of vincenty direct formula.
// Ref: https://en.wikipedia.org/wiki/Vincenty%27s_formulae#Inverse%20problem:~:text=in%20absolute%20value.-,Direct%20problem,-%5Bedit%5D
fn prepare_vincenty_direct_formula_constants(
    start_lat: f32,
    inverse_formula: &VincentyInverseFormulaResult,
) -> VincentyDirectFormulaConstants {
    let u_squared = inverse_formula.u_squared;
    let f = inverse_formula.eff;

    let cosine_heading = inverse_formula.start_heading.cos();
    let sine_heading = inverse_formula.start_heading.sin();

    let tan_u = (1. - f) * start_lat.tan();

    let cosine_u = 1. / (1. + tan_u * tan_u).sqrt();
    let sine_u = cosine_u * tan_u;

    let sigma = tan_u.atan2(cosine_heading);

    let sine_alpha = cosine_u * sine_heading;
    let sine_squared_alpha = sine_alpha * sine_alpha;

    let cosine_squared_alpha = 1. - sine_squared_alpha;
    let cosine_alpha = cosine_squared_alpha.sqrt();

    let u2_over4 = u_squared / 4.;
    let u4_over16 = u2_over4 * u2_over4;
    let u6_over64 = u4_over16 * u4_over16;
    let u8_over256 = u6_over64 * u6_over64;

    let a0 =
        1. + u2_over4 - (3. * u4_over16) / 4. + (5. * u6_over64) / 4. - (175. * u8_over256) / 64.;
    let a1 = 1. - u2_over4 + (15. * u4_over16) / 8. - (35. * u6_over64) / 8.;
    let a2 = 1. - 3. * u2_over4 + (35. * u4_over16) / 4.;
    let a3 = 1. - 5. * u2_over4;

    let distance_ratio = a0 * sigma
        - (a1 * (2. * sigma).sin() * u2_over4) / 2.
        - (a2 * (4. * sigma).sin() * u4_over16) / 16.
        - (a3 * (6. * sigma).sin() * u6_over64) / 48.
        - ((8. * sigma).sin() * 5. * u8_over256) / 512.;

    VincentyDirectFormulaConstants {
        f,
        cosine_heading,
        sine_heading,
        cosine_u,
        sine_u,
        sigma,
        sine_alpha,
        cosine_squared_alpha,
        cosine_alpha,
        u2_over4,
        u4_over16,
        u6_over64,
        u8_over256,
        distance_ratio,
    }
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;
    use navara_math::{std_float::consts::PI, EPSILON11, EPSILON7};
    use radians::Angle;

    use crate::{Meters, LLE, WGS84_32};

    use super::EllipsoidGeodesic;

    #[test]
    fn it_should_get_zero_distance_if_zero() {
        let start = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(0.),
            height: Meters::new(0.),
        };
        let end = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(0.),
            height: Meters::new(0.),
        };
        let g = EllipsoidGeodesic::new(start, end, &WGS84_32);

        assert_eq!(g.distance, 0.);
    }

    #[test]
    fn it_computes_distance_at_equator() {
        let pi_over_two = PI / 2.;
        let start = LLE {
            lng: Angle::new(pi_over_two),
            lat: Angle::new(0.),
            height: Meters::new(0.),
        };
        let end = LLE {
            lng: Angle::new(PI),
            lat: Angle::new(0.),
            height: Meters::new(0.),
        };
        let g = EllipsoidGeodesic::new(start, end, &WGS84_32);

        assert_abs_diff_eq!(g.start_heading, pi_over_two, epsilon = EPSILON11);
        assert_abs_diff_eq!(g.end_heading, pi_over_two, epsilon = EPSILON11);
        assert_abs_diff_eq!(g.distance, 10018754., epsilon = 1.);
    }

    #[test]
    fn it_computes_distance_at_meridian() {
        let pi_over_two = PI / 2.;
        let start = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(pi_over_two),
            height: Meters::new(0.),
        };
        let end = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(PI),
            height: Meters::new(0.),
        };
        let g = EllipsoidGeodesic::new(start, end, &WGS84_32);

        assert_abs_diff_eq!(g.start_heading, 0., epsilon = EPSILON11);
        assert_abs_diff_eq!(g.end_heading, 0., epsilon = EPSILON11);
        assert_abs_diff_eq!(g.distance, 10001966., epsilon = 1.1);
    }

    #[test]
    fn it_compute_distance_at_meridian() {
        let pi_over_two = PI / 2.;
        let start = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(pi_over_two),
            height: Meters::new(0.),
        };
        let end = LLE {
            lng: Angle::new(0.),
            lat: Angle::new(PI),
            height: Meters::new(0.),
        };
        let g = EllipsoidGeodesic::new(start, end, &WGS84_32);

        assert_abs_diff_eq!(g.start_heading, 0., epsilon = EPSILON11);
        assert_abs_diff_eq!(g.end_heading, 0., epsilon = EPSILON11);
        assert_abs_diff_eq!(g.distance, 10001966., epsilon = 1.1);
    }

    #[test]
    fn it_interpolate_distance() {
        let fifteen_degrees = PI / 12.;
        let start = LLE {
            lng: Angle::new(fifteen_degrees),
            lat: Angle::new(fifteen_degrees),
            height: Meters::new(0.),
        };
        let thirty_degrees = PI / 6.;
        let end = LLE {
            lng: Angle::new(thirty_degrees),
            lat: Angle::new(thirty_degrees),
            height: Meters::new(0.),
        };
        let g = EllipsoidGeodesic::new(start, end, &WGS84_32);

        let first = g.interpolate_distance(&WGS84_32, 0.);
        let last = g.interpolate_distance(&WGS84_32, g.distance);

        assert_abs_diff_eq!(start.lng.val(), first.lng.val(), epsilon = EPSILON7);
        assert_abs_diff_eq!(start.lat.val(), first.lat.val(), epsilon = EPSILON7);
        assert_abs_diff_eq!(end.lng.val(), last.lng.val(), epsilon = EPSILON7);
        assert_abs_diff_eq!(end.lat.val(), last.lat.val(), epsilon = EPSILON7);
    }
}
