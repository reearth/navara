import { createConcurrencyManager } from "@navara/worker";

/** Maximum workers on mobile to prevent thermal throttling */
const MOBILE_MAX_WORKERS = 4;

export const createDefaultConcurrencyManager = (mobileOptimized: boolean) => {
  const hardwareConcurrency = Math.max(navigator.hardwareConcurrency, 1);
  const totalConcurrency = mobileOptimized
    ? Math.min(hardwareConcurrency, MOBILE_MAX_WORKERS)
    : hardwareConcurrency;
  return createConcurrencyManager(totalConcurrency);
};
