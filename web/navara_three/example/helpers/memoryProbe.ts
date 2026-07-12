/**
 * Browser memory probes with feature detection (C7 measurement helper).
 *
 * All APIs degrade gracefully:
 * - `performance.memory` — Chrome-only JS-heap snapshot, synchronous.
 * - `performance.measureUserAgentSpecificMemory()` — Chrome, requires
 *   `crossOriginIsolated` (COOP/COEP headers). The example dev server does
 *   not send those headers today, so `sampleUA()` resolves `undefined`
 *   unless they are added.
 * - `navigator.deviceMemory` — Chrome-only, spec-clamped to [0.5, 8] GB.
 */

export type MemoryProbeCapabilities = {
  /** Chrome-only `performance.memory` is available. */
  performanceMemory: boolean;
  /** `measureUserAgentSpecificMemory` is callable (needs crossOriginIsolated). */
  uaSpecificMemory: boolean;
  crossOriginIsolated: boolean;
  /** Reported device memory in GB, when available. */
  deviceMemoryGB?: number;
};

export type MemorySample = {
  /** `performance.now()` timestamp of the sample. */
  at: number;
  jsHeapUsedMB?: number;
  jsHeapTotalMB?: number;
};

type PerformanceWithMemory = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
};

const MB = 1024 * 1024;
/** measureUserAgentSpecificMemory is expensive; rate-limit hard. */
const UA_SAMPLE_MIN_INTERVAL_MS = 10_000;

export function createMemoryProbe() {
  const perf = performance as PerformanceWithMemory;
  const isolated =
    typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;

  const capabilities: MemoryProbeCapabilities = {
    performanceMemory: !!perf.memory,
    uaSpecificMemory: !!perf.measureUserAgentSpecificMemory && isolated,
    crossOriginIsolated: isolated,
    deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory,
  };

  let lastUaSampleAt = -Infinity;
  let lastUaMB: number | undefined;

  return {
    capabilities,

    /** JS heap snapshot via `performance.memory`; empty sample elsewhere. */
    sampleSync(): MemorySample {
      const memory = perf.memory;
      return {
        at: performance.now(),
        jsHeapUsedMB: memory ? memory.usedJSHeapSize / MB : undefined,
        jsHeapTotalMB: memory ? memory.totalJSHeapSize / MB : undefined,
      };
    },

    /**
     * Total page memory in MB via `measureUserAgentSpecificMemory`,
     * internally rate-limited (>=10s); resolves the previous value between
     * samples and `undefined` when unsupported.
     */
    async sampleUA(): Promise<number | undefined> {
      const measure = perf.measureUserAgentSpecificMemory;
      if (!capabilities.uaSpecificMemory || !measure) return undefined;
      const now = performance.now();
      if (now - lastUaSampleAt < UA_SAMPLE_MIN_INTERVAL_MS) return lastUaMB;
      lastUaSampleAt = now;
      try {
        const result = await measure.call(perf);
        lastUaMB = result.bytes / MB;
      } catch {
        // Permission or isolation revoked at runtime — stop reporting.
        capabilities.uaSpecificMemory = false;
        lastUaMB = undefined;
      }
      return lastUaMB;
    },
  };
}
