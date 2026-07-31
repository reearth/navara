import { AstroTime, Body, HourAngle, Observer } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import {
  dateForSolarTime,
  getSolarTime,
  getSunElevation,
  shiftDateToElevation,
  shiftDateToHourAngle,
} from "./solar";

// Summer solstice — well-defined sun positions at all test locations
const BASE_DATE = new Date("2024-06-21T00:00:00Z");

function sunHourAngle(date: Date, lng: number): number {
  return HourAngle(Body.Sun, new AstroTime(date), new Observer(0, lng, 0));
}

describe("shiftDateToHourAngle", () => {
  it("preserves hour angle when moving from Tokyo to London", () => {
    const haBefore = sunHourAngle(BASE_DATE, 139.69);
    const result = shiftDateToHourAngle(BASE_DATE, 139.69, -0.12);
    expect(sunHourAngle(result, -0.12)).toBeCloseTo(haBefore, 2);
  });

  it("preserves hour angle when moving from London to New York", () => {
    const date = new Date("2024-06-21T08:00:00Z");
    const haBefore = sunHourAngle(date, -0.12);
    const result = shiftDateToHourAngle(date, -0.12, -74.01);
    expect(sunHourAngle(result, -74.01)).toBeCloseTo(haBefore, 2);
  });

  it("is a no-op when target longitude equals source longitude", () => {
    const result = shiftDateToHourAngle(BASE_DATE, 139.69, 139.69);
    expect(result.getTime()).toBeCloseTo(BASE_DATE.getTime(), -3); // within ~1s
  });

  it("handles crossing the date line (Tokyo → Honolulu)", () => {
    const haBefore = sunHourAngle(BASE_DATE, 139.69);
    const result = shiftDateToHourAngle(BASE_DATE, 139.69, -157.85);
    expect(sunHourAngle(result, -157.85)).toBeCloseTo(haBefore, 2);
  });
});

describe("shiftDateToElevation", () => {
  it("preserves sun elevation when moving from Tokyo to London (morning)", () => {
    // ~8 AM solar at Tokyo
    const date = new Date("2024-06-20T22:40:00Z");
    const elevBefore = getSunElevation(date, 35.68, 139.69);
    const result = shiftDateToElevation(date, 35.68, 139.69, 51.5, -0.12);
    expect(getSunElevation(result, 51.5, -0.12)).toBeCloseTo(elevBefore, 1);
  });

  it("preserves sun elevation when moving from Tokyo to London (afternoon)", () => {
    // ~4 PM solar at Tokyo
    const date = new Date("2024-06-21T07:00:00Z");
    const elevBefore = getSunElevation(date, 35.68, 139.69);
    const result = shiftDateToElevation(date, 35.68, 139.69, 51.5, -0.12);
    expect(getSunElevation(result, 51.5, -0.12)).toBeCloseTo(elevBefore, 1);
  });

  it("clamps to solar noon when target elevation exceeds location maximum", () => {
    // High elevation at equator around noon in December — unreachable at Reykjavik (~3° max)
    const date = new Date("2024-12-21T12:00:00Z");
    const result = shiftDateToElevation(date, 0, 0, 64.1, -22.0);
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});

describe("getSolarTime / dateForSolarTime", () => {
  it("reads ~12 (solar noon) at Tokyo solar noon", () => {
    // Tokyo solar noon ≈ 02:43 UTC on 2024-06-21
    const date = new Date("2024-06-21T02:43:00Z");
    expect(getSolarTime(date, 139.69)).toBeCloseTo(12, 1);
  });

  it("reads ~0 (solar midnight) at Tokyo solar midnight", () => {
    // Tokyo solar midnight ≈ 14:43 UTC on 2024-06-21
    const date = new Date("2024-06-21T14:43:00Z");
    const t = getSolarTime(date, 139.69);
    expect(Math.min(t, 24 - t)).toBeCloseTo(0, 1);
  });

  it("round-trips: dateForSolarTime then getSolarTime returns the input", () => {
    for (const hours of [0, 6.3, 12, 18.75]) {
      const date = dateForSolarTime(BASE_DATE, 139.69, hours);
      // Compare on the 24h circle so 0 and 24 count as equal.
      const diff = Math.abs(getSolarTime(date, 139.69) - hours);
      expect(Math.min(diff, 24 - diff)).toBeCloseTo(0, 2);
    }
  });

  it("puts the sun above the horizon at midday and below at midnight", () => {
    const noon = dateForSolarTime(BASE_DATE, 139.69, 12);
    expect(getSunElevation(noon, 35.68, 139.69)).toBeGreaterThan(0);
    const midnight = dateForSolarTime(BASE_DATE, 139.69, 0);
    expect(getSunElevation(midnight, 35.68, 139.69)).toBeLessThan(0);
  });
});

describe("getSunElevation", () => {
  it("returns positive elevation at solar noon", () => {
    // Tokyo solar noon ≈ 02:43 UTC on 2024-06-21
    const date = new Date("2024-06-21T02:43:00Z");
    expect(getSunElevation(date, 35.68, 139.69)).toBeGreaterThan(0);
  });

  it("returns negative elevation at solar midnight", () => {
    // Tokyo solar midnight ≈ 14:43 UTC on 2024-06-21
    const date = new Date("2024-06-21T14:43:00Z");
    expect(getSunElevation(date, 35.68, 139.69)).toBeLessThan(0);
  });
});
