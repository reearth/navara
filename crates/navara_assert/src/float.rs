use std::fmt::Display;

use radians::Float;

/// Assert a delta of a float if it's delts is expected or not.
pub fn assert_delta<F: Float + PartialOrd + Display>(a: F, b: F, d: F) {
    if (a - b).abs() < d {
    } else {
        panic!("a: {}  b: {} d: {}", a, b, d);
    }
}

#[cfg(test)]
mod test {
    use super::assert_delta;

    #[test]
    fn it_should_assert_float_delta() {
        assert_delta(0.01, 0.02, 0.011);
        assert_delta(0.02, 0.01, 0.011);
    }
}
