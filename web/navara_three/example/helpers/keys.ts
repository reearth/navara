export const GOOGLE_MAPS_API_KEY = import.meta.env.PROD
  ? (import.meta.env.NAVARA_GOOGLE_MAPS_API_KEY_PUBLIC ?? "")
  : (import.meta.env.NAVARA_GOOGLE_MAPS_API_KEY ?? "");
