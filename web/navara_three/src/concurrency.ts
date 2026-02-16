import { createConcurrencyManager } from "@navara/worker";

import { isMobileDevice } from "./device";

/** Maximum workers on mobile to prevent thermal throttling */
const MOBILE_MAX_WORKERS = 4;

const hardwareConcurrency = Math.max(navigator.hardwareConcurrency, 1);
const TOTAL_CONCURRENCY = isMobileDevice()
  ? Math.min(hardwareConcurrency, MOBILE_MAX_WORKERS)
  : hardwareConcurrency;

export const createDefaultConcurrencyManager = () =>
  createConcurrencyManager(TOTAL_CONCURRENCY);
