
pub trait ToU8 {
    fn to_u8(&self) -> u8;
}

impl ToU8 for bool {
    // This is alway valid.
    // Ref: https://doc.rust-lang.org/reference/types/boolean.html#bit-validity
    fn to_u8(&self) -> u8 {
        u8::from(*self)
    }
}
