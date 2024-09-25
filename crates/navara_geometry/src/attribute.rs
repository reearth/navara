use navara_buffer_store::Handle;
use navara_math::FloatType;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct FloatAttribute {
    pub data: Vec<FloatType>,
    pub size: u8,
}

impl FloatAttribute {
    pub fn new(data: Vec<FloatType>, size: u8) -> Self {
        Self { data, size }
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct TransferableFloatAttribute {
    pub data: Handle,
    pub size: u8,
}
