import type { EntityEvent } from "@navara/engine";

export function generate_id_from_entity(entity: EntityEvent) {
  return `${entity.ind}_${entity.gen}`;
}

export function isEntityEvent(v: unknown): v is EntityEvent {
  return !!v && typeof v === "object" && "ind" in v && "gen" in v;
}
