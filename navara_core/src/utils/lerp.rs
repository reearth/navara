use crate::{Float, One};

pub fn lerp<F: Float + One<F>>(a: F, b: F, t: F) -> F {
    (F::one() - t) * a + t * b
}

#[cfg(test)]
mod test {
    use crate::utils::lerp::lerp;

    #[test]
    fn test_lerp() {
        debug_assert_eq!(lerp(10., 2., 0.3), 7.6);
    }
}
