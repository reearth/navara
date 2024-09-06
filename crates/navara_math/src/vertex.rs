use cfg_if::cfg_if;

cfg_if! {
    if #[cfg(all(not(feature = "use_f32"), feature = "use_f64"))] {
        use bevy_math::{
            DQuat as OriginDQuat, DVec2 as OriginDVec2, DVec3 as OriginDVec3, DVec4 as OriginDVec4,
        };

        pub type Vec4 = OriginDVec4;
        pub type Vec3 = OriginDVec3;
        pub type Vec2 = OriginDVec2;
        pub type Quat = OriginDQuat;
    } else {
        use bevy_math::{
            Quat as OriginQuat, Vec2 as OriginVec2, Vec3 as OriginVec3, Vec4 as OriginVec4,
        };

        pub type Vec4 = OriginVec4;
        pub type Vec3 = OriginVec3;
        pub type Vec2 = OriginVec2;
        pub type Quat = OriginQuat;
    }
}
