pub trait ToU8 {
    fn to_u8(&self) -> u8;
}

impl ToU8 for bool {
    fn to_u8(&self) -> u8 {
        u8::from(*self)
    }
}
