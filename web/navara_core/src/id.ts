import type { EntityEvent } from "@navaramap/engine";

export function generate_id_from_entity(entity: EntityEvent) {
  return generate_id_from_ind_gen(entity.ind, entity.gen);
}

/** Same id as {@link generate_id_from_entity} for callers that carry the entity
 * index/generation as plain numbers (e.g. `RasterTileState`'s fragment fields)
 * instead of an `EntityEvent` instance. */
export function generate_id_from_ind_gen(ind: number, gen: number) {
  return `${ind}_${gen}`;
}

export function isEntityEvent(v: unknown): v is EntityEvent {
  return !!v && typeof v === "object" && "ind" in v && "gen" in v;
}
