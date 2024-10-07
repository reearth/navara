use navara_math::{FloatType, RawDVec3, Vec3, EPSILON12};

// Ref: https://github.com/CesiumGS/cesium/blob/8016d9f99f0dd8c661f3f7f7f80d17fc0ef082be/packages/engine/Source/Core/scaleToGeodeticSurface.js#L147
pub fn scale_to_geodetic_surface(
    p: Vec3,
    one_over_radii: &[FloatType; 3],
    one_over_radii_squared: &[FloatType; 3],
    center_tolerance_squared: f64,
) -> Option<Vec3> {
    // NOTE: This solves an optimization problem, and precision is important, so we need to force cast f64.
    let position_x = p.x as f64;
    let position_y = p.y as f64;
    let position_z = p.z as f64;

    let one_over_radii_x = one_over_radii[0] as f64;
    let one_over_radii_y = one_over_radii[1] as f64;
    let one_over_radii_z = one_over_radii[2] as f64;

    let x2 = position_x * position_x * one_over_radii_x * one_over_radii_x;
    let y2 = position_y * position_y * one_over_radii_y * one_over_radii_y;
    let z2 = position_z * position_z * one_over_radii_z * one_over_radii_z;

    // Compute the squared ellipsoid norm.
    let squared_norm = x2 + y2 + z2;
    let ratio = (1.0 / squared_norm).sqrt();

    // As an initial approximation, assume that the radial intersection is the projection point.
    let intersection = p * ratio as FloatType;

    // If the position is near the center, the iteration will not converge.
    if squared_norm < center_tolerance_squared {
        return if !ratio.is_finite() {
            None
        } else {
            Some(intersection)
        };
    }

    let one_over_radii_squared_x = one_over_radii_squared[0] as f64;
    let one_over_radii_squared_y = one_over_radii_squared[1] as f64;
    let one_over_radii_squared_z = one_over_radii_squared[2] as f64;

    // Use the gradient at the intersection point in place of the true unit normal.
    // The difference in magnitude will be absorbed in the multiplier.
    let gradient = RawDVec3::new(
        intersection.x as f64 * one_over_radii_squared_x * 2.0,
        intersection.y as f64 * one_over_radii_squared_y * 2.0,
        intersection.z as f64 * one_over_radii_squared_z * 2.0,
    );

    // Compute the initial guess at the normal vector multiplier, lambda.
    let mut lambda = ((1.0 - ratio) * p.length() as f64) / (0.5 * gradient.length());
    let mut correction = 0.0;

    let mut func;
    let mut denominator;
    let mut x_multiplier;
    let mut y_multiplier;
    let mut z_multiplier;
    let mut x_multiplier2;
    let mut y_multiplier2;
    let mut z_multiplier2;
    let mut x_multiplier3;
    let mut y_multiplier3;
    let mut z_multiplier3;

    loop {
        lambda -= correction;

        x_multiplier = 1.0 / (1.0 + lambda * one_over_radii_squared_x);
        y_multiplier = 1.0 / (1.0 + lambda * one_over_radii_squared_y);
        z_multiplier = 1.0 / (1.0 + lambda * one_over_radii_squared_z);

        x_multiplier2 = x_multiplier * x_multiplier;
        y_multiplier2 = y_multiplier * y_multiplier;
        z_multiplier2 = z_multiplier * z_multiplier;

        x_multiplier3 = x_multiplier2 * x_multiplier;
        y_multiplier3 = y_multiplier2 * y_multiplier;
        z_multiplier3 = z_multiplier2 * z_multiplier;

        func = x2 * x_multiplier2 + y2 * y_multiplier2 + z2 * z_multiplier2 - 1.0;

        // "denominator" here refers to the use of this expression in the velocity and acceleration
        // computations in the sections to follow.
        denominator = x2 * x_multiplier3 * one_over_radii_squared_x
            + y2 * y_multiplier3 * one_over_radii_squared_y
            + z2 * z_multiplier3 * one_over_radii_squared_z;

        let derivative = -2.0 * denominator;

        correction = func / derivative;

        if func.abs() <= EPSILON12 as f64 {
            break;
        }
    }

    Some(Vec3::new(
        (position_x * x_multiplier) as FloatType,
        (position_y * y_multiplier) as FloatType,
        (position_z * z_multiplier) as FloatType,
    ))
}
