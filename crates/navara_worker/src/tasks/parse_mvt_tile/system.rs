/// Non-delegated (local) MVT parse system.
///
/// When the `delegated_worker` feature is disabled the parse runs synchronously
/// inside `navara_mvt` (`construct_geometry_multi_layer`), so there is nothing
/// to do here. This stub exists to satisfy the plugin's system chain.
pub(crate) fn parse_mvt_tile() {}
