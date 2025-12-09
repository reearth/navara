/**
 * Device detection and adaptive quality utilities for mobile optimization.
 */

/** Cached result of mobile device detection */
let cachedIsMobile: boolean | undefined;

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
  const mobileKeywords = [
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

  const isMobileUA = mobileKeywords.some((keyword) =>
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

/** Maximum pixel ratio for desktop (usually not needed but prevents extreme cases) */
const DESKTOP_MAX_PIXEL_RATIO = 3.0;

/**
 * Gets an appropriate pixel ratio for the current device.
 * Caps the ratio on mobile devices to prevent excessive rendering load.
 *
 * @param override - Optional user-specified pixel ratio (takes precedence)
 * @returns Capped pixel ratio appropriate for the device
 */
export function getDevicePixelRatio(override?: number): number {
  if (typeof override === "number") {
    return override;
  }

  if (typeof window === "undefined") {
    return 1;
  }

  const deviceRatio = window.devicePixelRatio ?? 1;
  const maxRatio = isMobileDevice()
    ? MOBILE_MAX_PIXEL_RATIO
    : DESKTOP_MAX_PIXEL_RATIO;

  return Math.min(deviceRatio, maxRatio);
}
