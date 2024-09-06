use cfg_if::cfg_if;

pub use bevy_math::{
    DQuat as RawDQuat, DVec2 as RawDVec2, DVec3 as RawDVec3, DVec4 as RawDVec4, Dir2 as RawDir2,
    Dir3A as RawDir3, Quat as RawQuat, Vec2 as RawVec2, Vec3 as RawVec3, Vec4 as RawVec4,
};

cfg_if! {
    if #[cfg(all(not(feature = "use_f32"), feature = "use_f64"))] {
        pub type Vec4 = RawDVec4;
        pub type Vec3 = RawDVec3;
        pub type Vec2 = RawDVec2;
        pub type Quat = RawDQuat;
        pub type Dir2 = RawDir2;
        pub type Dir3 = RawDir3;
    } else {
        pub type Vec4 = RawVec4;
        pub type Vec3 = RawVec3;
        pub type Vec2 = RawVec2;
        pub type Quat = RawQuat;
        pub type Dir2 = RawDir2;
        pub type Dir3 = RawDir3;
    }
}
