import type { TerrainHeightUpdatedEvent } from "@navaramap/engine";

/**
 * Whether a terrain-height event carries a usable height for the observer
 * registered as `entityBits`.
 *
 * `height` is the engine's `Option<f64>` (`TerrainHeightObserver.height` in
 * `navara_tile_component`): `undefined` means no tile covering the position has
 * resolved a height yet, which is the case this filters out.
 *
 * **Deliberately `!= null` and not a truthiness check.** `0` is sea level — a
 * perfectly valid computed height, and the engine only emits an event when the
 * height actually changed. Dropping it would leave a mesh placed with
 * `geodetic.heightReference: "terrain"` stranded at its previous altitude
 * whenever a refinement resolved to the sea.
 */
export function hasObservedTerrainHeight(
  ev: TerrainHeightUpdatedEvent,
  entityBits: bigint,
): ev is TerrainHeightUpdatedEvent & { height: number } {
  return ev.bits === entityBits && ev.height != null;
}
