mod process;

pub use process::{MatchedLayerInfo, construct_geometry_multi_layer};

#[cfg(feature = "delegated_worker")]
mod async_finalize;
#[cfg(feature = "delegated_worker")]
pub(crate) use async_finalize::{
    cancel_evicted_parse_tasks, finalize_parsed_mvt, spawn_parse_mvt_task,
};
