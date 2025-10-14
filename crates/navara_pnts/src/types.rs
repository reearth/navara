// TODO: unify with navara_b3dm/src/types.rs
pub enum DataType {
    Scalar,
    Vec2,
    Vec3,
    Vec4,
}

impl DataType {
    pub fn from_str(v: &str) -> Self {
        match v {
            "SCALAR" => DataType::Scalar,
            "VEC2" => DataType::Vec2,
            "VEC3" => DataType::Vec3,
            "VEC4" => DataType::Vec4,
            _ => unimplemented!(),
        }
    }

    pub fn size(&self) -> usize {
        match self {
            Self::Scalar => 1,
            Self::Vec2 => 2,
            Self::Vec3 => 3,
            Self::Vec4 => 4,
        }
    }
}

pub enum ComponentType {
    Byte,
    UnsignedByte,
    Short,
    UnsignedShort,
    Int,
    UnsignedInt,
    Float,
    Double,
}

impl ComponentType {
    pub fn from_str(v: &str) -> Self {
        match v {
            "BYTE" => ComponentType::Byte,
            "UNSIGNED_BYTE" => ComponentType::UnsignedByte,
            "SHORT" => ComponentType::Short,
            "UNSIGNED_SHORT" => ComponentType::UnsignedShort,
            "INT" => ComponentType::Int,
            "UNSIGNED_INT" => ComponentType::UnsignedInt,
            "FLOAT" => ComponentType::Float,
            "DOUBLE" => ComponentType::Double,
            _ => unimplemented!(),
        }
    }

    pub fn size(&self) -> usize {
        match self {
            Self::Byte => 1,
            Self::UnsignedByte => 1,
            Self::Short => 2,
            Self::UnsignedShort => 2,
            Self::Int => 4,
            Self::UnsignedInt => 4,
            Self::Float => 4,
            Self::Double => 8,
        }
    }
}
