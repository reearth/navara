mod helpers;
pub(crate) mod hillshade_backfill_system;
pub(crate) mod system;

pub(crate) use helpers::*;
pub use hillshade_backfill_system::{
    HillshadeDEMState, HillshadeTextureMarker, backfill_hillshade_on_loaded,
    cleanup_hillshade_backfilled_buffers, filter_requestable_hillshade_data_requester,
};
