use navara_math::FloatType;

pub fn ease_linear(t: FloatType) -> FloatType {
    t
}

// Ref: https://easings.net#easeInOutQuad
pub fn ease_in_out_quad(t: FloatType) -> FloatType {
    if t < 0.5 {
        2. * t * t
    } else {
        1. - (-2. * t + 2.).powi(2) / 2.
    }
}

// Ref: https://easings.net#easeInOutCubic
pub fn ease_in_out_cubic(t: FloatType) -> FloatType {
    if t < 0.5 {
        4. * t * t * t
    } else {
        1. - (-2. * t + 2.).powi(3) / 2.
    }
}

// Ref: https://easings.net#easeOutCubic
pub fn ease_out_cubic(t: FloatType) -> FloatType {
    1. - (1. - t).powi(3)
}

// Ref: https://easings.net#easeInOutQuint
pub fn ease_in_out_quint(t: FloatType) -> FloatType {
    if t < 0.5 {
        16. * t.powi(5)
    } else {
        1. - (-2. * t + 2.).powi(5) / 2.
    }
}

// Ref: https://easings.net#easeOutCirc
pub fn ease_out_circ(t: f32) -> f32 {
    let v = (1. - (t - 1.).powf(2.)).sqrt();
    if v.is_nan() {
        return 0.;
    }
    v
}

// Ref: https://easings.net#easeOutQuint
pub fn ease_out_quint(t: f32) -> f32 {
    1. - (1. - t).powf(5.)
}

#[cfg(test)]
mod test {
    use approx::assert_abs_diff_eq;

    use super::*;

    #[test]
    fn easings_hit_endpoints_and_midpoints() {
        for f in [
            ease_linear,
            ease_in_out_quad,
            ease_in_out_cubic,
            ease_out_cubic,
            ease_in_out_quint,
        ] {
            assert_abs_diff_eq!(f(0.), 0.);
            assert_abs_diff_eq!(f(1.), 1.);
            // All in/out easings pass through (0.5, 0.5); out easings are above.
            assert!(f(0.5) >= 0.5 - 1e-12);
        }

        assert_abs_diff_eq!(ease_in_out_quad(0.5), 0.5);
        assert_abs_diff_eq!(ease_in_out_quad(0.25), 0.125);
        assert_abs_diff_eq!(ease_in_out_cubic(0.25), 0.0625);
        assert_abs_diff_eq!(ease_out_cubic(0.5), 0.875);
        assert_abs_diff_eq!(ease_in_out_quint(0.25), 0.015625);
    }

    #[test]
    fn easings_are_monotonic() {
        for f in [
            ease_linear,
            ease_in_out_quad,
            ease_in_out_cubic,
            ease_out_cubic,
            ease_in_out_quint,
        ] {
            let mut prev = f(0.);
            for i in 1..=100 {
                let v = f(i as f64 / 100.);
                assert!(v >= prev);
                prev = v;
            }
        }
    }
}
