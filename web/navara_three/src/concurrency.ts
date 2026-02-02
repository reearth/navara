import { createConcurrencyManager } from "@navara/worker";

import { isMobileDevice } from "./device";

/** Maximum workers on mobile to prevent thermal throttling */
const MOBILE_MAX_WORKERS = 4;

const hardwareConcurrency = Math.max(navigator.hardwareConcurrency, 1);
const TOTAL_CONCURRENCY = isMobileDevice()
  ? Math.min(hardwareConcurrency, MOBILE_MAX_WORKERS)
  : hardwareConcurrency;

// const FEATURE_CONCURRENCY = Math.max(Math.floor(TOTAL_CONCURRENCY), 1);
const MAP_CONCURRENCY = Math.max(TOTAL_CONCURRENCY, 1);

export const createDefaultConcurrencyManager = () =>
  createConcurrencyManager(MAP_CONCURRENCY);
