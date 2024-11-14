export const DRACO_LOADER_CONCURRENCY = Math.floor(
  navigator.hardwareConcurrency / 3,
);
export const MAIN_CONCURRENCY =
  navigator.hardwareConcurrency - DRACO_LOADER_CONCURRENCY;
