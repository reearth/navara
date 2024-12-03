const TOTAL_CONCURRENCY = Math.max(navigator.hardwareConcurrency, 1);
export const FEATURE_CONCURRENCY = Math.max(
  Math.floor(TOTAL_CONCURRENCY / 3),
  1,
);
export const MAP_CONCURRENCY = Math.max(
  TOTAL_CONCURRENCY - FEATURE_CONCURRENCY,
  1,
);
