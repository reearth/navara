/**
 * Device detection and adaptive quality utilities for mobile optimization.
 */

/** Cached result of mobile device detection */
let cachedIsMobile: boolean | undefined;

/** Keywords to detect mobile devices from user agent string */
const MOBILE_KEYWORDS = [
  "android",
  "webos",
  "iphone",
  "ipad",
  "ipod",
  "blackberry",
  "windows phone",
  "opera mini",
  "mobile",
];

/**
 * Detects if the current device is a mobile device.
 * Uses user agent and touch capability heuristics.
 * Result is memoized since it doesn't change during runtime.
 */
export function isMobileDevice(): boolean {
  if (cachedIsMobile !== undefined) return cachedIsMobile;

  if (typeof navigator === "undefined") {
    cachedIsMobile = false;
    return false;
  }

  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = MOBILE_KEYWORDS.some((keyword) =>
    userAgent.includes(keyword),
  );

  // Also check for touch capability + small screen as fallback
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  cachedIsMobile = isMobileUA || (hasTouch && isSmallScreen);
  return cachedIsMobile;
}

/** Maximum pixel ratio for mobile devices to balance quality vs performance */
const MOBILE_MAX_PIXEL_RATIO = 1.0;

export type DevicePixelRatioOptions = {
  /** User-specified pixel ratio override (takes precedence over all other settings) */
  override?: number;
  /** Enable mobile optimization to cap pixel ratio on mobile devices */
  mobileOptimization?: boolean;
};

/**
 * Gets an appropriate pixel ratio for the current device.
 * Caps the ratio on mobile devices only when mobileOptimization is enabled.
 *
 * @param options - Configuration options for pixel ratio
 * @returns Pixel ratio appropriate for the device
 */
export function getDevicePixelRatio(options?: DevicePixelRatioOptions): number {
  if (typeof options?.override === "number") {
    return options.override;
  }

  if (typeof window === "undefined") {
    return 1;
  }

  const deviceRatio = window.devicePixelRatio ?? 1;

  // Only cap pixel ratio on mobile when mobileOptimization is enabled
  if (options?.mobileOptimization && isMobileDevice()) {
    return Math.min(deviceRatio, MOBILE_MAX_PIXEL_RATIO);
  }

  return deviceRatio;
}
