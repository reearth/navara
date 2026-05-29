import {
  AstroTime,
  Body,
  Equator,
  Horizon,
  HourAngle,
  Observer,
  SearchAltitude,
  SearchHourAngle,
} from "astronomy-engine";

/**
 * Returns the sun elevation angle in degrees at the given location and time.
 * Includes atmospheric refraction correction.
 */
export function getSunElevation(date: Date, lat: number, lng: number): number {
  const time = new AstroTime(date);
  const observer = new Observer(lat, lng, 0);
  const eq = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec, "normal").altitude;
}

/**
 * Returns a new Date such that the sun's hour angle at `targetLng` matches the
 * hour angle currently at `fromLng`.
 *
 * Hour angle is longitude-dependent and increases monotonically 0→24 over a
 * solar day, so there is exactly one solution per day — no morning/afternoon
 * ambiguity.
 */
export function shiftDateToHourAngle(
  date: Date,
  fromLng: number,
  targetLng: number,
  targetLat = 0,
): Date {
  const time = new AstroTime(date);
  const ha = HourAngle(Body.Sun, time, new Observer(0, fromLng, 0));
  const dayStart = new AstroTime(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  );
  return SearchHourAngle(
    Body.Sun,
    new Observer(targetLat, targetLng, 0),
    ha,
    dayStart,
    1,
  ).time.date;
}

/**
 * Returns a new Date such that the sun elevation at `(targetLat, targetLng)`
 * matches the elevation at `(fromLat, fromLng)` on the given date.
 *
 * Morning/afternoon context (rising vs setting) is inferred from the hour
 * angle at `fromLng`. If the target elevation exceeds the maximum achievable
 * at the location (e.g. polar night), the date is clamped to solar noon.
 */
export function shiftDateToElevation(
  date: Date,
  fromLat: number,
  fromLng: number,
  targetLat: number,
  targetLng: number,
): Date {
  const targetAltitude = getSunElevation(date, fromLat, fromLng);

  // HA > 12 means morning (0 = solar noon, 12 = solar midnight).
  const isMorning =
    HourAngle(Body.Sun, new AstroTime(date), new Observer(0, fromLng, 0)) > 12;

  const observer = new Observer(targetLat, targetLng, 0);
  const dayStart = new AstroTime(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  );

  const noonTime = SearchHourAngle(Body.Sun, observer, 0, dayStart, 1).time;
  const midnightTime = SearchHourAngle(
    Body.Sun,
    observer,
    12,
    new AstroTime(new Date(noonTime.date.getTime() - 13 * 3_600_000)),
    1,
  ).time;

  const searchStart = isMorning ? midnightTime : noonTime;
  const result = SearchAltitude(
    Body.Sun,
    observer,
    isMorning ? 1 : -1,
    searchStart,
    0.6,
    targetAltitude,
  );

  return result?.date ?? noonTime.date;
}
