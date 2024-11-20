const TOTAL_CONCURRENCY = Manavigator.hardwareConcurrency - 1 || 1;
export const FEATURE_CONCURRENCY = Math.floor(TOTAL_CONCURRENCY / 3) || 1;
export const MAP_CONCURRENCY = TOTAL_CONCURRENCY - FEATURE_CONCURRENCY || 1;
