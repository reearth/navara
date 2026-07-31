// Geodetic points of three vertical loops advancing along a heading.
// Open Pacific, far from any coastline, so only the sea sits behind the loops.
export const CENTER = { lng: 150, lat: 32 };

const LOOPS = 3;
const SAMPLES_PER_LOOP = 28;
const RX = 350; // along-heading loop radius, meters
const RY = 520; // vertical loop radius, meters
const ADVANCE_PER_LOOP = 700; // along-heading advance per loop, meters
const BASE_ALTITUDE = 220; // altitude of the loop bottoms, meters

/** Altitude at the middle of the loops — a convenient camera target. */
export const MID_HEIGHT = BASE_ALTITUDE + RY;

const M_PER_DEG_LNG = 111320 * Math.cos((CENTER.lat * Math.PI) / 180);
const HALF_SPAN = (LOOPS * ADVANCE_PER_LOOP) / 2;

export const loopTrajectory: { lng: number; lat: number; height: number }[] =
  [];
for (let i = 0; i <= LOOPS * SAMPLES_PER_LOOP; i++) {
  const t = (i / SAMPLES_PER_LOOP) * Math.PI * 2;
  // Prolate cycloid (RX > steady advance), so the path forms real loops.
  const east =
    (ADVANCE_PER_LOOP / (Math.PI * 2)) * t + RX * Math.sin(t) - HALF_SPAN;
  const up = RY * (1 - Math.cos(t));
  loopTrajectory.push({
    lng: CENTER.lng + east / M_PER_DEG_LNG,
    lat: CENTER.lat,
    height: BASE_ALTITUDE + up,
  });
}
