export const ATMOSPHERE_ASSETS_URL = new URL(
  `${import.meta.env.BASE_URL}assets/atmosphere`,
  import.meta.url,
).toString();

export const CLOUD_ASSETS_URL = new URL(
  `${import.meta.env.BASE_URL}assets/cloud`,
  import.meta.url,
).toString();

export const NOISE_ASSETS_URL = new URL(
  `${import.meta.env.BASE_URL}assets/noise`,
  import.meta.url,
).toString();

export const STARS_ASSETS_URL = `${ATMOSPHERE_ASSETS_URL}/stars.bin`;

export const STBN_URL = `${NOISE_ASSETS_URL}/stbn.bin`;
