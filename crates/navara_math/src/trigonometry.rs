use radians::Float;

use crate::Two;

pub fn chord_length<F: Float + Two<F>>(angle: F, radius: F) -> F {
    F::two() * radius * (angle / F::two()).sin()
}

#[cfg(test)]
mod test {
    use std::f64::consts::PI;

    use approx::assert_abs_diff_eq;

    use crate::EPSILON6;

    use super::chord_length;

    #[test]
    fn it_calculates_chord_length() {
        assert_abs_diff_eq!(chord_length(PI / 3., 1.), 1., epsilon = EPSILON6);
        assert_abs_diff_eq!(chord_length(PI / 3., 5.), 5., epsilon = EPSILON6);
        assert_abs_diff_eq!(
            chord_length(PI / 3. * 2., 1.),
            3.0f64.sqrt(),
            epsilon = EPSILON6
        );
        assert_abs_diff_eq!(
            chord_length(PI / 3. * 2., 5.),
            5.0 * 3.0f64.sqrt(),
            epsilon = EPSILON6
        );
        assert_abs_diff_eq!(chord_length(PI, 10.), 2.0 * 10.0, epsilon = EPSILON6);
    }
}
