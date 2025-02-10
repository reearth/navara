// Ref: https://easings.net/ja#easeOutCirc
pub fn ease_out_circ(t: f32) -> f32 {
    let v = (1. - (t - 1.).powf(2.)).sqrt();
    if v.is_nan() {
        return 0.;
    }
    v
}

// Ref: https://easings.net/ja#easeOutQuint
pub fn ease_out_quint(t: f32) -> f32 {
    1. - (1. - t).powf(5.)
}
